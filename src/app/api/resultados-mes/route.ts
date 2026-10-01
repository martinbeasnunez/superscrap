import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { origenDeContacto } from '@/lib/contact-origin';
import { isLikelyBotReply } from '@/lib/reply-classifier';

export const dynamic = 'force-dynamic';

/**
 * Resultados mes a mes del pipeline comercial.
 *
 * Nace de una pregunta del GM: "¿qué se hizo cada mes y qué resultados tuvo?".
 * La clave es separar lo que de verdad importa del ruido:
 *   - trabajo A MANO (humano/dirigido) vs envíos del BOT (cron auto-followup),
 *   - respuestas REALES de ellos vs autorespuestas de su propio bot,
 *   - cierres (ganado/perdido) hechos por una persona vs auto-cierres del cron.
 * Todo se deriva de `contact_history` (no hay columna de "mes"): la verdad está
 * en la actividad real, no en los campos congelados que el bot ensucia.
 */

interface Fila {
  business_id: string;
  action_type: string | null;
  user_id: string | null;
  notes: string | null;
  created_at: string;
}

// Comunicación SALIENTE nuestra (no el bot, no las respuestas entrantes).
const SALIENTE_NUESTRA = new Set(['whatsapp', 'email', 'call', 'ai_call']);
// Respuestas ENTRANTES (las escribe el prospecto, aunque sea su propio bot).
const ENTRANTE = new Set(['whatsapp_reply', 'auto_whatsapp_reply']);

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Mes en Lima (YYYY-MM) de un timestamp ISO. */
function mesLima(iso: string): string {
  // en-CA da YYYY-MM-DD; nos quedamos con YYYY-MM.
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Lima' }).slice(0, 7);
}

/** Etapa destino de una nota de cambio de etapa ("... → Cliente"). */
function etapaDestino(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/→\s*([A-Za-zÁÉÍÓÚáéíóúñ_]+)/);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  if (raw.startsWith('cliente')) return 'cliente';
  if (raw.startsWith('perdido')) return 'perdido';
  if (raw.startsWith('interesado')) return 'interesado';
  if (raw.startsWith('cotizado')) return 'cotizado';
  return raw;
}

interface TierBucket { trabajadas: Set<string>; respondieron: Set<string>; nuevas: number }
interface MesAcc {
  mes: string;
  trabajoHumano: number;
  cuentasTrabajadas: Set<string>;
  botEnvios: number;
  respuestasReales: Set<string>;
  orca: TierBucket;
  delfin: TierBucket;
  ganados: { name: string; tier: string | null; conOwner: boolean }[];
  perdidos: { humano: number; bot: number };
  // Respuestas humanas reales de orcas — lo más valioso del mes.
  hitos: { name: string; tier: string | null; texto: string; cuando: string }[];
}

function nuevoMes(mes: string): MesAcc {
  return {
    mes,
    trabajoHumano: 0,
    cuentasTrabajadas: new Set(),
    botEnvios: 0,
    respuestasReales: new Set(),
    orca: { trabajadas: new Set(), respondieron: new Set(), nuevas: 0 },
    delfin: { trabajadas: new Set(), respondieron: new Set(), nuevas: 0 },
    ganados: [],
    perdidos: { humano: 0, bot: 0 },
    hitos: [],
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Cuántos meses hacia atrás (incluye el actual). Por defecto 6.
  const meses = Math.min(24, Math.max(1, Number(url.searchParams.get('meses')) || 6));

  // Inicio del rango: primer día (Lima) del mes de hace `meses-1`.
  const ahora = new Date();
  const limaNow = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const desdeDate = new Date(limaNow.getFullYear(), limaNow.getMonth() - (meses - 1), 1);
  // A ISO en UTC con offset de Lima (-05:00) para comparar en el server.
  const y = desdeDate.getFullYear();
  const m = String(desdeDate.getMonth() + 1).padStart(2, '0');
  const desdeISO = `${y}-${m}-01T00:00:00-05:00`;

  // 1) Todo el historial desde el inicio del rango (paginado: Supabase corta en 1000).
  const eventos: Fila[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('contact_history')
      .select('business_id, action_type, user_id, notes, created_at')
      .gte('created_at', desdeISO)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    eventos.push(...(data as Fila[]));
    if (data.length < PAGE) break;
  }

  // 2) Tier y nombre de cada negocio referenciado.
  const ids = [...new Set(eventos.map((e) => e.business_id))];
  const tier = new Map<string, string | null>();
  const nombre = new Map<string, string>();
  const owner = new Map<string, string | null>();
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const { data } = await supabase
      .from('businesses')
      .select('id, name, contacted_by, service_analyses ( potential_tier )')
      .in('id', lote);
    for (const b of (data || []) as { id: string; name: string; contacted_by: string | null; service_analyses: { potential_tier: string | null } | { potential_tier: string | null }[] | null }[]) {
      const sa = Array.isArray(b.service_analyses) ? b.service_analyses[0] : b.service_analyses;
      tier.set(b.id, sa?.potential_tier ?? null);
      nombre.set(b.id, b.name);
      owner.set(b.id, b.contacted_by);
    }
  }

  // 3) Bucket por mes.
  const porMes = new Map<string, MesAcc>();
  const getMes = (k: string) => porMes.get(k) || (porMes.set(k, nuevoMes(k)), porMes.get(k)!);

  for (const e of eventos) {
    const k = mesLima(e.created_at);
    const acc = getMes(k);
    const origen = origenDeContacto(e);
    const t = tier.get(e.business_id) || null;
    const bucket = t === 'orca' ? acc.orca : t === 'delfin' ? acc.delfin : null;
    const tipo = e.action_type || '';

    // Envíos del bot (cron auto-followup).
    if (tipo === 'auto_whatsapp') acc.botEnvios++;

    // Trabajo a mano (humano o dirigido) + comunicación saliente nuestra.
    if ((origen === 'humano' || origen === 'agente') && SALIENTE_NUESTRA.has(tipo)) {
      acc.trabajoHumano++;
      acc.cuentasTrabajadas.add(e.business_id);
      if (bucket) bucket.trabajadas.add(e.business_id);
    }

    // Respuesta REAL de ellos (entrante y no autorespuesta de su bot).
    if (ENTRANTE.has(tipo) && !isLikelyBotReply(e.notes)) {
      acc.respuestasReales.add(e.business_id);
      if (bucket) bucket.respondieron.add(e.business_id);
      if (t === 'orca') {
        acc.hitos.push({
          name: nombre.get(e.business_id) || '?',
          tier: t,
          texto: (e.notes || '').replace(/\s+/g, ' ').trim().slice(0, 160),
          cuando: e.created_at,
        });
      }
    }

    // Cierres (cambio de etapa a cliente / perdido).
    if (tipo === 'stage_change') {
      const destino = etapaDestino(e.notes);
      if (destino === 'cliente') {
        acc.ganados.push({ name: nombre.get(e.business_id) || '?', tier: t, conOwner: !!owner.get(e.business_id) });
      } else if (destino === 'perdido') {
        if (origen === 'cron') acc.perdidos.bot++;
        else acc.perdidos.humano++;
      }
    }
  }

  // 4) Nuevas orcas/delfines sembrados por mes (negocios creados en el rango).
  const creados: { created_at: string; service_analyses: { potential_tier: string | null } | { potential_tier: string | null }[] | null }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from('businesses')
      .select('created_at, service_analyses!inner ( potential_tier )')
      .gte('created_at', desdeISO)
      .in('service_analyses.potential_tier', ['orca', 'delfin'])
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    creados.push(...(data as typeof creados));
    if (data.length < PAGE) break;
  }
  for (const b of creados) {
    if (!b.created_at) continue;
    const acc = getMes(mesLima(b.created_at));
    const sa = Array.isArray(b.service_analyses) ? b.service_analyses[0] : b.service_analyses;
    const t = sa?.potential_tier;
    if (t === 'orca') acc.orca.nuevas++;
    else if (t === 'delfin') acc.delfin.nuevas++;
  }

  // 5) Serializar — los últimos `meses` meses en orden descendente (más reciente arriba).
  const salida = [...porMes.values()]
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, meses)
    .map((a) => {
      const [yy, mm] = a.mes.split('-');
      return {
        mes: a.mes,
        label: `${MESES[Number(mm) - 1]} ${yy}`,
        trabajoHumano: a.trabajoHumano,
        cuentasTrabajadas: a.cuentasTrabajadas.size,
        botEnvios: a.botEnvios,
        respuestasReales: a.respuestasReales.size,
        orca: {
          trabajadas: a.orca.trabajadas.size,
          respondieron: a.orca.respondieron.size,
          nuevas: a.orca.nuevas,
        },
        delfin: {
          trabajadas: a.delfin.trabajadas.size,
          respondieron: a.delfin.respondieron.size,
          nuevas: a.delfin.nuevas,
        },
        ganados: a.ganados,
        perdidos: a.perdidos,
        hitos: a.hitos.slice(0, 6),
      };
    });

  return NextResponse.json({ meses: salida });
}
