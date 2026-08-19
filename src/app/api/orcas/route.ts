import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Vista "Cerrar Orcas": lista enfocada de leads tier=orca con dueño, stage,
// score y días sin contacto, para trabajar el cierre uno por uno.

export interface OrcaLead {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  businessType: string | null;
  city: string | null;
  score: number | null;
  revenueMin: number | null;
  revenueMax: number | null;
  stage: string;
  contacted: boolean;
  ownerId: string | null;
  ownerName: string | null;
  contactedAt: string | null;
  daysSinceContact: number | null;
  // --- Actividad REAL (contact_history), no el congelado contacted_at ---
  daysSinceActivity: number | null; // días desde la última comunicación real
  awaitingReply: boolean;           // lo último fue un whatsapp_reply real del prospecto
  temp: 'caliente' | 'tibio' | 'frio' | 'encurso'; // clasificación honesta por actividad
  source: string | null;
  nextAction: string | null; // "Próxima acción" curada por el humano (texto libre)
}

const STAGES = [
  'nuevo', 'contactado', 'seguimiento_1', 'seguimiento_2',
  'seguimiento_3', 'interesado', 'cotizado', 'cliente', 'perdido',
];
const CLOSED = ['cliente', 'perdido'];
const HOT_STAGES = ['interesado', 'cotizado'];

// Tipos de contact_history que son comunicación real (excluye note/stage_change).
const COMM = new Set(['whatsapp_reply', 'whatsapp', 'email', 'auto_whatsapp', 'call', 'ai_call']);
// Único tipo INBOUND (lo dijo el prospecto). Si es lo último → la bola está en tu cancha.
const INBOUND = 'whatsapp_reply';
// Filtro rápido de autorespuestas de negocio (bienvenida/horario/agradecimiento) para no
// contarlas como "te respondieron". Espejo de scripts/orcas-parte.mjs (referencia canónica).
const BOT_REPLY = /bienvenid|te saluda|gracias por (tu|su)|horario de atenci|canal de reservas|para reservar|no estamos respond|estamos cerrando|placer atender|indicarme tu nombre|en qu[eé] podemos ayudar|somos .* atenci[oó]n/i;
const isRealReply = (txt: string | null): boolean => {
  const t = (txt || '').trim();
  if (!/[a-záéíóúñ]/i.test(t)) return false;                 // solo emojis/símbolos
  if (/^(gracias|muchas gracias|ok|oki|listo|perfecto|de nada)[\s.!¡]*$/i.test(t)) return false;
  if (BOT_REPLY.test(t)) return false;
  return true;
};

export async function GET(request: Request) {
  try {
    // ?owner=<userId> → además de las orcas, traemos TODOS los leads de ese
    // usuario (incluye delfines) + su resumen del día, para la vista "Tu día".
    const owner = new URL(request.url).searchParams.get('owner');

    // Supabase corta en 1000 filas — paginamos aunque hoy sean ~481 orcas,
    // a prueba de crecimiento.
    const fetchAll = async (
      make: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
    ): Promise<any[]> => {
      const pageSize = 1000;
      const rows: any[] = [];
      let page = 0;
      while (true) {
        const { data, error } = await make(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < pageSize) break;
        page += 1;
      }
      return rows;
    };

    const { data: users } = await supabase.from('users').select('id, name');
    const userMap = new Map<string, string>((users || []).map((u) => [u.id, u.name]));

    const now = Date.now();
    const one = (v: any) => (Array.isArray(v) ? v[0] : v) || {};
    const daysAgo = (iso: string | null): number | null =>
      iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : null;

    // histByBiz se llena tras traer las orcas (abajo). toLead lo consulta; para filas
    // sin historial (ej. delfines de "Tu día") cae a contacted_at.
    const histByBiz = new Map<string, any[]>();

    const toLead = (b: any): OrcaLead => {
      const a = one(b.service_analyses);
      const s = one(b.searches);
      const stage = STAGES.includes(b.sales_stage) ? b.sales_stage : 'nuevo';
      const actions: string[] = Array.isArray(b.contact_actions) ? b.contact_actions : [];
      const contacted = actions.length > 0 || (b.sales_stage && b.sales_stage !== 'nuevo');
      const daysContact = daysAgo(b.contacted_at || null);

      // --- Actividad real desde contact_history (desc por fecha) ---
      const hist = histByBiz.get(b.id) || [];
      const comms = hist.filter((e) => COMM.has(e.action_type));
      const lastComm = comms[0] || null; // comunicación más reciente (in/out)
      // Actividad = última comunicación real; si no hay evidencia, cae a contacted_at.
      const activityAt = lastComm?.created_at || b.contacted_at || null;
      const daysActivity = daysAgo(activityAt);
      // Bola en tu cancha: lo último fue que ELLOS respondieron (no una autorespuesta de bot).
      const awaiting = !!lastComm && lastComm.action_type === INBOUND && isRealReply(lastComm.notes);
      // ¿Alguna vez respondieron de verdad (no autorespuesta de bot)? = engagement real.
      const hasEngaged = comms.some((e) => e.action_type === INBOUND && isRealReply(e.notes));

      // Temperatura por INTENCIÓN de ellos, no por días (los días son urgencia, no ocultan).
      // El bot ya no mueve stages → interesado/cotizado = interés humano real y confiable.
      const isOpen = !CLOSED.includes(stage);
      const isHot = HOT_STAGES.includes(stage);
      let temp: OrcaLead['temp'] = 'encurso';
      if (isOpen && (awaiting || isHot)) {
        // 🔥 respuesta pendiente de ellos, o un humano marcó interesado/cotizado. Sin filtro de días.
        temp = 'caliente';
      } else if (isOpen && hasEngaged) {
        // 🌡️ respondieron algo real alguna vez, pero aún sin interés marcado.
        temp = 'tibio';
      } else if (isOpen && daysActivity !== null && daysActivity >= 21) {
        temp = 'frio';
      }

      return {
        id: b.id,
        name: b.name,
        phone: b.phone,
        address: b.address,
        businessType: s.business_type || null,
        city: s.city || null,
        score: a.potential_score ?? null,
        revenueMin: a.estimated_revenue_min ?? null,
        revenueMax: a.estimated_revenue_max ?? null,
        stage,
        contacted: !!contacted,
        ownerId: b.contacted_by || null,
        ownerName: b.contacted_by ? (userMap.get(b.contacted_by) || 'Desconocido') : null,
        contactedAt: b.contacted_at || null,
        daysSinceContact: daysContact,
        daysSinceActivity: daysActivity,
        awaitingReply: awaiting,
        temp,
        source: b.source || null,
        nextAction: b.next_action || null,
      };
    };

    const SELECT = `
      id, name, phone, address, contact_actions, sales_stage, contacted_at, contacted_by, source, next_action,
      searches ( business_type, city ),
      service_analyses ( potential_tier, potential_score, estimated_revenue_min, estimated_revenue_max )`;

    // !inner filtra el padre (businesses) por el tier del hijo (service_analyses).
    const rows = await fetchAll((from, to) =>
      supabase
        .from('businesses')
        .select(SELECT.replace('service_analyses (', 'service_analyses!inner ('))
        .eq('service_analyses.potential_tier', 'orca')
        .range(from, to));

    // Actividad real: traemos contact_history en lotes de 150 ids (Supabase corta en 1000).
    const ids: string[] = rows.map((b) => b.id);
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150);
      const { data, error } = await supabase
        .from('contact_history')
        .select('business_id, action_type, notes, created_at, user_id')
        .in('business_id', chunk)
        .order('created_at', { ascending: false });
      if (error) throw error;
      for (const e of (data || [])) {
        if (!histByBiz.has(e.business_id)) histByBiz.set(e.business_id, []);
        histByBiz.get(e.business_id)!.push(e);
      }
    }

    const orcas: OrcaLead[] = rows.map(toLead);

    // Orden por defecto: score desc (nulls al final), luego más frío arriba (por actividad real).
    orcas.sort((a, b) => {
      const sa = a.score ?? -1, sb = b.score ?? -1;
      if (sb !== sa) return sb - sa;
      return (b.daysSinceActivity ?? -1) - (a.daysSinceActivity ?? -1);
    });

    const open = orcas.filter((o) => !CLOSED.includes(o.stage));
    // Clasificación por INTENCIÓN de ellos (no por días; los días son urgencia):
    //  🔥 caliente = respuesta humana pendiente  Ó  interesado/cotizado (interés humano real)
    //  🌡️ tibio    = alguna vez respondieron de verdad, pero aún sin interés marcado
    //  🧊 frío      = abierto Y actividad ≥ 21d
    const summary = {
      total: orcas.length,
      open: open.length,
      won: orcas.filter((o) => o.stage === 'cliente').length,
      lost: orcas.filter((o) => o.stage === 'perdido').length,
      hot: orcas.filter((o) => o.temp === 'caliente').length,
      tibio: orcas.filter((o) => o.temp === 'tibio').length,
      frio: orcas.filter((o) => o.temp === 'frio').length,
      awaiting: orcas.filter((o) => o.awaitingReply && !CLOSED.includes(o.stage)).length,
      untouched: orcas.filter((o) => !o.contacted).length,
      sinDueno: open.filter((o) => !o.ownerId).length,
      revenueMin: open.reduce((s, o) => s + (o.revenueMin || 0), 0),
      revenueMax: open.reduce((s, o) => s + (o.revenueMax || 0), 0),
      byStage: Object.fromEntries(STAGES.map((s) => [s, orcas.filter((o) => o.stage === s).length])),
    };

    // ---- Vista "Tu día": leads del usuario que NO son orca (delfines/otros) + su resumen ----
    let mine: OrcaLead[] = [];
    let myStats: {
      total: number; orcas: number; contactedToday: number; prospects: number;
    } | null = null;
    if (owner) {
      const ownerRows = await fetchAll((from, to) =>
        supabase.from('businesses').select(SELECT).eq('contacted_by', owner).range(from, to));
      const orcaIds = new Set(orcas.map((o) => o.id));
      mine = ownerRows
        .filter((b) => one(b.service_analyses).potential_tier !== 'orca' && !orcaIds.has(b.id))
        .map(toLead);

      // todayISO en hora Perú (UTC-5), como el resto del app
      const peruOffset = -5 * 60;
      const peru = new Date(now + (peruOffset - new Date().getTimezoneOffset()) * 60000);
      const startPeru = new Date(peru.getFullYear(), peru.getMonth(), peru.getDate());
      const todayISO = new Date(startPeru.getTime() - peruOffset * 60000).toISOString();

      const myLeads = [...orcas.filter((o) => o.ownerId === owner), ...mine];
      myStats = {
        total: myLeads.length,
        orcas: orcas.filter((o) => o.ownerId === owner).length,
        contactedToday: myLeads.filter((o) => o.contactedAt && o.contactedAt >= todayISO).length,
        prospects: myLeads.filter((o) => o.stage === 'interesado' || o.stage === 'cotizado').length,
      };
    }

    return NextResponse.json({ orcas, mine, summary, myStats });
  } catch (error) {
    console.error('Orcas endpoint error:', error);
    return NextResponse.json({ error: 'Error al obtener orcas' }, { status: 500 });
  }
}
