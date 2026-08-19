import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { origenDeContacto, type ContactOrigin } from '@/lib/contact-origin';

export const dynamic = 'force-dynamic';

interface Fila { business_id: string; action_type: string | null; user_id: string | null; notes: string | null; created_at: string }

/** Acciones de comunicación saliente que cuentan como "toque" (whatsapp/email/call). */
const ACCIONES_SALIENTES = new Set(['whatsapp', 'email', 'call', 'ai_call']);
/**
 * Cualquier contacto saliente que ya "tocó" al negocio, incluido el bot. Sirve
 * para saber si un negocio era virgen (nuevo) o ya venía trabajado (follow):
 * si el auto-followup ya le escribió, el mensaje de la persona es un follow.
 */
const ACCIONES_SALIENTES_HIST = new Set(['whatsapp', 'email', 'call', 'ai_call', 'auto_whatsapp']);

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

  // ── Nuevos vs Follows por día ──────────────────────────────────────────────
  // Solo trabajo real (a mano / dirigido) y solo comunicación saliente.
  // Un evento es "nuevo" si es el PRIMER contacto saliente del negocio en toda
  // su historia; si ya había un toque anterior (aunque fuera del bot), es "follow".
  const eventosSalientes = mios.filter(e => {
    const o = origenDeContacto(e);
    return (o === 'humano' || o === 'agente') && ACCIONES_SALIENTES.has(e.action_type || '');
  });

  // Primer contacto saliente de cada negocio, mirando TODA la historia (no solo
  // el rango): una consulta por lotes de business_id, el primero que aparece
  // (orden ascendente) es el más antiguo.
  const idsSalientes = [...new Set(eventosSalientes.map(e => e.business_id))];
  const primerToque = new Map<string, string>();
  const SALIENTES_ARR = [...ACCIONES_SALIENTES_HIST];
  for (let i = 0; i < idsSalientes.length; i += 200) {
    const lote = idsSalientes.slice(i, i + 200);
    for (let from = 0; ; from += PAGE) {
      const { data } = await supabase
        .from('contact_history')
        .select('business_id, created_at')
        .in('business_id', lote)
        .in('action_type', SALIENTES_ARR)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      for (const r of data as { business_id: string; created_at: string }[]) {
        if (!primerToque.has(r.business_id)) primerToque.set(r.business_id, r.created_at);
      }
      if (data.length < PAGE) break;
    }
  }

  const porDiaNuevoFollow: Record<string, { nuevos: number; follows: number }> = {};
  for (const e of eventosSalientes) {
    const dia = diaLima(e.created_at);
    const primero = primerToque.get(e.business_id);
    // Nuevo si este evento ES el primer toque de la historia (sin toque anterior).
    const esNuevo = !primero || e.created_at <= primero;
    const bucket = (porDiaNuevoFollow[dia] ||= { nuevos: 0, follows: 0 });
    if (esNuevo) bucket.nuevos++;
    else bucket.follows++;
  }

  // Lista de vendedores con trabajo real en el rango, para poblar el selector.
  const idsDueno = [...new Set(
    eventos.filter(e => { const o = origenDeContacto(e); return o === 'humano' || o === 'agente'; })
      .map(e => duenos.get(e.business_id))
      .filter((v): v is string => !!v)
  )];
  const nombresUsuario = new Map<string, string>();
  if (idsDueno.length > 0) {
    const { data } = await supabase.from('users').select('id, name').in('id', idsDueno);
    data?.forEach(u => nombresUsuario.set(u.id, u.name));
  }
  const vendedores = idsDueno
    .map(id => ({ id, name: nombresUsuario.get(id) || 'Otro' }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
    // Nuevos vs follows por día (solo trabajo real y comunicación saliente).
    porDiaNuevoFollow,
    // Vendedores con trabajo real en el rango (para el selector del tracker).
    vendedores,
    respuestasRecibidas: respuestas.slice(-25).reverse(),
  });
}
