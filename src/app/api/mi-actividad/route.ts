import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { origenDeContacto, type ContactOrigin } from '@/lib/contact-origin';

export const dynamic = 'force-dynamic';

interface Fila { business_id: string; action_type: string | null; user_id: string | null; notes: string | null; created_at: string }

/** Día en Lima (YYYY-MM-DD) de un timestamp ISO. */
function diaLima(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

/** Lunes de la semana de una fecha, en Lima. */
function lunesDe(d: Date): string {
  const lima = new Date(d.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const dia = (lima.getDay() + 6) % 7; // 0 = lunes
  lima.setDate(lima.getDate() - dia);
  return lima.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

/**
 * Actividad comercial real, separada por quién la originó.
 *
 * Existe porque "Tu día" contaba `businesses.contacted_at`, y ese campo también
 * lo escribe el cron de auto-followup: al vendedor le aparecían como propios los
 * envíos automáticos. Acá contamos eventos del historial y los separamos.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const desde = url.searchParams.get('desde') || lunesDe(new Date());

  // Historial desde el inicio del rango pedido (paginado: Supabase corta en 1000).
  const eventos: Fila[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('contact_history')
      .select('business_id, action_type, user_id, notes, created_at')
      .gte('created_at', desde)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    eventos.push(...(data as Fila[]));
    if (data.length < PAGE) break;
  }

  // Dueño de cada negocio, para poder filtrar "lo mío".
  const ids = [...new Set(eventos.map(e => e.business_id))];
  const duenos = new Map<string, string | null>();
  const nombres = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 300) {
    const lote = ids.slice(i, i + 300);
    const { data } = await supabase.from('businesses').select('id, name, contacted_by').in('id', lote);
    data?.forEach(b => { duenos.set(b.id, b.contacted_by); nombres.set(b.id, b.name); });
  }

  const mios = userId ? eventos.filter(e => duenos.get(e.business_id) === userId) : eventos;

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const vacio = (): Record<ContactOrigin, number> => ({ humano: 0, agente: 0, cron: 0, cliente: 0 });

  const totales = vacio();
  const deHoy = vacio();
  const porDia: Record<string, Record<ContactOrigin, number>> = {};
  const negociosTrabajados = new Set<string>();
  const respuestas: { negocio: string; cuando: string; texto: string }[] = [];

  for (const e of mios) {
    const origen = origenDeContacto(e);
    const dia = diaLima(e.created_at);
    totales[origen]++;
    if (dia === hoy) deHoy[origen]++;
    (porDia[dia] ||= vacio())[origen]++;
    if (origen === 'humano' || origen === 'agente') negociosTrabajados.add(e.business_id);
    if (origen === 'cliente' && e.notes) {
      respuestas.push({ negocio: nombres.get(e.business_id) || '?', cuando: e.created_at, texto: e.notes.slice(0, 160) });
    }
  }

  return NextResponse.json({
    desde,
    hoy,
    // Lo que de verdad hizo el equipo: a mano + dirigido. El cron va aparte.
    trabajoNuestroHoy: deHoy.humano + deHoy.agente,
    trabajoNuestroRango: totales.humano + totales.agente,
    negociosTrabajados: negociosTrabajados.size,
    porOrigen: totales,
    porOrigenHoy: deHoy,
    porDia,
    respuestasRecibidas: respuestas.slice(-25).reverse(),
  });
}
