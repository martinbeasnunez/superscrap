import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { SalesStage, PotentialTier } from '@/types';
import { isLikelyBotReply } from '@/lib/reply-classifier';

// Columnas del pipeline comercial con seguimiento
export type KanbanColumnId =
  | 'nuevo'
  | 'contactado'
  | 'seguimiento_1'  // 3-5 días sin respuesta
  | 'seguimiento_2'  // 6-8 días sin respuesta
  | 'seguimiento_3'  // 9+ días - último intento
  | 'interesado'
  | 'cotizado'
  | 'cliente'
  | 'perdido';

export interface DecisionMaker {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  position: string | null;
  seniority: string | null;
  department: string | null;
  confidence: number;
  linkedin: string | null;
  phone: string | null;
}

export interface AICallResult {
  outcome: 'wants_quote' | 'interested' | 'not_interested' | 'callback' | 'completed' | 'no_answer' | 'voicemail' | null;
  contactName: string | null;
  hasAICall: boolean;
  conversationId: string | null; // Para reproducir el audio de la llamada
  callDate: string | null; // Fecha de la llamada
  shortSummary: string | null; // Resumen corto de la llamada (ej: "Tiene proveedor", "Ocupado")
}

export interface KanbanBusiness {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  rating: number | null;
  reviews_count: number | null;
  description: string | null;
  website: string | null;
  thumbnail_url: string | null;
  contact_actions: string[] | null;
  lead_status: string | null;
  sales_stage: SalesStage | null;
  contacted_at: string | null;
  search_id: string;
  business_type: string | null;
  city: string | null;
  daysSinceContact: number | null;
  contactCount: number;
  decision_makers: DecisionMaker[] | null;
  aiCallResult: AICallResult | null;
  // Orca/Delfin scoring
  potential_tier: PotentialTier | null;
  potential_score: number | null;
  estimated_revenue_min: number | null;
  estimated_revenue_max: number | null;
  // v2 fields
  primary_dm_index: number | null;
  auto_followup_enabled: boolean;
  last_email_template_id: string | null;
  // Reply tracking
  has_unread_reply: boolean;     // Any reply (bot or human)
  has_human_reply: boolean;      // Real human reply (high-signal)
  last_reply_text: string | null;
  last_reply_date: string | null; // ISO date of latest reply — used to flag stale replies awaiting Alejandro
  // Today tracking
  contacted_today: boolean;
  // Free-text notes (why lost, additional context, etc)
  notes: string | null;
  // 'auto' (SerpAPI pipeline) or 'manual' (hand-added whale; no WhatsApp automation)
  source: 'auto' | 'manual';
  // Acquisition channel — only set on manual leads (auto leads all come from SerpAPI)
  lead_channel:
    | 'comercial' | 'google_seo' | 'google_sem' | 'laundryheap'
    | 'getlavado_b2c' | 'getlavado_b2b' | 'referido'
    | 'linkedin' | 'eventos' | 'otro' | null;
}

export interface WhatsAppStats {
  sentToday: number;
  sentManualToday: number;
  sentAutoToday: number;
  repliesUnread: number;       // Total inbound replies (humans + bots) — kept for backwards compat
  repliesHuman: number;        // Real human replies (signal)
  repliesBot: number;          // Auto-greetings from prospect's WhatsApp bot (noise)
}

export interface KanbanResponse {
  columns: Record<KanbanColumnId, KanbanBusiness[]>;
  counts: Record<KanbanColumnId, number>;
  whatsappStats: WhatsAppStats;
}

// Clasificar negocio en columna
// SIEMPRE respetar el sales_stage de la DB — el vendedor controla el pipeline
function classifyBusiness(business: KanbanBusiness): KanbanColumnId {
  const salesStage = business.sales_stage;

  // Si tiene un stage válido en DB, usarlo siempre
  const validStages: KanbanColumnId[] = [
    'nuevo', 'contactado', 'seguimiento_1', 'seguimiento_2',
    'seguimiento_3', 'interesado', 'cotizado', 'cliente', 'perdido'
  ];
  if (salesStage && validStages.includes(salesStage as KanbanColumnId)) {
    return salesStage as KanbanColumnId;
  }

  // Fallback: sin stage = nuevo
  return 'nuevo';
}

export async function GET() {
  try {
    // Obtener todos los businesses con sus searches y contact history
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select(`
        id,
        name,
        address,
        phone,
        rating,
        reviews_count,
        description,
        website,
        thumbnail_url,
        decision_makers,
        contact_actions,
        lead_status,
        sales_stage,
        contacted_at,
        search_id,
        primary_dm_index,
        auto_followup_enabled,
        last_email_template_id,
        notes,
        source,
        lead_channel,
        searches (
          business_type,
          city
        ),
        service_analyses (
          potential_score,
          potential_tier,
          estimated_revenue_min,
          estimated_revenue_max
        )
      `)
      .order('contacted_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching businesses for kanban:', error);
      return NextResponse.json({ error: 'Error al obtener negocios' }, { status: 500 });
    }

    // Fetch ALL contact history (paginated past PostgREST's 1000-row response cap), excluding
    // stage_change to reduce volume. Needed in full so contactCountMap is accurate for businesses
    // with many historical contacts. Ordered desc so replyMap/aiCallMap pick the latest entry.
    type ContactRow = { business_id: string; action_type: string | null; notes: string | null; created_at: string | null };
    const contactHistory: ContactRow[] = [];
    {
      const chunkSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('contact_history')
          .select('business_id, action_type, notes, created_at')
          .neq('action_type', 'stage_change')
          .order('created_at', { ascending: false })
          .range(from, from + chunkSize - 1);
        if (error || !data) break;
        contactHistory.push(...data);
        if (data.length < chunkSize) break;
        from += chunkSize;
      }
    }

    const contactCountMap: Record<string, number> = {};
    const aiCallMap: Record<string, AICallResult> = {};
    // Track unread WhatsApp replies: store latest reply per business
    const replyMap: Record<string, { text: string; date: string }> = {};
    // Track which businesses have at least one HUMAN reply (vs only bot auto-greetings)
    const humanReplyBizIds = new Set<string>();
    // Track businesses contacted today (todayStartISO set after `now` is declared below)
    const contactedTodaySet = new Set<string>();

    contactHistory?.forEach(c => {
      contactCountMap[c.business_id] = (contactCountMap[c.business_id] || 0) + 1;

      // Track WhatsApp replies
      if (c.action_type === 'whatsapp_reply') {
        const existing = replyMap[c.business_id];
        if (!existing || (c.created_at && c.created_at > existing.date)) {
          replyMap[c.business_id] = { text: c.notes || '', date: c.created_at || '' };
        }
        if (!isLikelyBotReply(c.notes)) {
          humanReplyBizIds.add(c.business_id);
        }
      }

      // Detectar llamadas IA (empiezan con 🤖)
      if (c.notes?.startsWith('🤖')) {
        // Extraer outcome de las notas
        let outcome: AICallResult['outcome'] = null;
        const notesLower = c.notes.toLowerCase();

        // Primero detectar voicemail (tiene prioridad)
        if (notesLower.includes('voicemail') || notesLower.includes('buzón de voz') ||
            notesLower.includes('casilla de voz') || notesLower.includes('contestadora') ||
            notesLower.includes('deje su mensaje') || notesLower.includes('entelev')) {
          outcome = 'voicemail';
        }
        else if (c.notes.includes('¡QUIERE COTIZACIÓN!')) outcome = 'wants_quote';
        else if (c.notes.includes('INTERESADO')) outcome = 'interested';
        else if (c.notes.includes('No interesado')) outcome = 'not_interested';
        else if (c.notes.includes('Llamar después')) outcome = 'callback';
        else if (c.notes.includes('No contestó') || c.notes.includes('Colgó')) outcome = 'no_answer';
        else outcome = 'completed';

        // Extraer nombre del contacto
        const nameMatch = c.notes.match(/👤 Contacto: ([^\n]+)/);
        const contactName = nameMatch ? nameMatch[1] : null;

        // Extraer conversation_id para reproducir audio
        const convIdMatch = c.notes.match(/conv_[a-z0-9]+/);
        const conversationId = convIdMatch ? convIdMatch[0] : null;

        // Extraer resumen corto (máx 2-3 palabras)
        let shortSummary: string | null = null;
        const summaryMatch = c.notes.match(/📋\s+([^\n]+)/);
        const elevenlabsSummary = summaryMatch ? summaryMatch[1].toLowerCase() : '';

        // Detectar situación (2-3 palabras)
        if (elevenlabsSummary.includes('proveedor') || elevenlabsSummary.includes('provider')) shortSummary = 'Tiene proveedor';
        else if (elevenlabsSummary.includes('interno') || elevenlabsSummary.includes('internal') || elevenlabsSummary.includes('in-house')) shortSummary = 'Lavado interno';
        else if (elevenlabsSummary.includes('unsatisfied') || elevenlabsSummary.includes('unhappy') || c.notes.includes('🔥 OPORTUNIDAD')) shortSummary = 'Insatisfecho';
        else if (elevenlabsSummary.includes('busy') || notesLower.includes('ocupado')) shortSummary = 'Ocupado';
        else if (elevenlabsSummary.includes('no time') || notesLower.includes('no tiene tiempo')) shortSummary = 'Sin tiempo';
        else if (elevenlabsSummary.includes('meeting') || notesLower.includes('reunión')) shortSummary = 'En reunión';
        else if (elevenlabsSummary.includes('quote') || elevenlabsSummary.includes('cotización') || elevenlabsSummary.includes('whatsapp')) shortSummary = 'Pidió cotización';
        else if (elevenlabsSummary.includes('not interested') || elevenlabsSummary.includes('no interest')) shortSummary = 'No interesa';
        else if (elevenlabsSummary.includes('interested') || elevenlabsSummary.includes('curious')) shortSummary = 'Interesado';
        else if (elevenlabsSummary.includes('call back') || elevenlabsSummary.includes('later') || elevenlabsSummary.includes('después')) shortSummary = 'Llamar después';
        else if (elevenlabsSummary.includes('hung up') || elevenlabsSummary.includes('colgó')) shortSummary = 'Colgó';
        else if (outcome === 'voicemail') shortSummary = 'Buzón de voz';
        else if (outcome === 'no_answer') shortSummary = 'No contestó';
        else if (outcome === 'wants_quote') shortSummary = 'Pidió cotización';
        else if (outcome === 'interested') shortSummary = 'Interesado';
        else if (outcome === 'not_interested') shortSummary = 'No interesa';
        else if (outcome === 'callback') shortSummary = 'Llamar después';
        else shortSummary = 'Conectó';

        aiCallMap[c.business_id] = {
          hasAICall: true,
          outcome,
          contactName,
          conversationId,
          callDate: c.created_at || null,
          shortSummary,
        };
      }
    });

    // Calcular días desde último contacto y clasificar
    const now = new Date();
    // Today start in Peru time (UTC-5)
    const peruOffset = -5 * 60;
    const peruNow = new Date(now.getTime() + (peruOffset - now.getTimezoneOffset()) * 60000);
    const peruToday = new Date(peruNow.getFullYear(), peruNow.getMonth(), peruNow.getDate());
    const todayStartISO = new Date(peruToday.getTime() - peruOffset * 60000).toISOString();

    // Today's WhatsApp sends — separate query so it's not subject to the 1000-row PostgREST cap
    // on contactHistory above. Also drives the WhatsApp stats below.
    const { data: todayHistory } = await supabase
      .from('contact_history')
      .select('business_id, action_type')
      .in('action_type', ['whatsapp', 'auto_whatsapp'])
      .gte('created_at', todayStartISO);

    todayHistory?.forEach(c => contactedTodaySet.add(c.business_id));
    const columns: Record<KanbanColumnId, KanbanBusiness[]> = {
      nuevo: [],
      contactado: [],
      seguimiento_1: [],
      seguimiento_2: [],
      seguimiento_3: [],
      interesado: [],
      cotizado: [],
      cliente: [],
      perdido: [],
    };

    businesses?.forEach((b: any) => {
      let daysSinceContact: number | null = null;
      if (b.contacted_at) {
        const contactDate = new Date(b.contacted_at);
        daysSinceContact = Math.floor((now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      // service_analyses is a 1:many relation but we only need the first record
      const analysis = Array.isArray(b.service_analyses) ? b.service_analyses[0] : null;

      const kanbanBusiness: KanbanBusiness = {
        id: b.id,
        name: b.name,
        address: b.address,
        phone: b.phone,
        rating: b.rating,
        reviews_count: b.reviews_count,
        description: b.description,
        website: b.website,
        thumbnail_url: b.thumbnail_url,
        decision_makers: b.decision_makers,
        contact_actions: b.contact_actions,
        lead_status: b.lead_status,
        sales_stage: b.sales_stage,
        contacted_at: b.contacted_at,
        search_id: b.search_id,
        business_type: b.searches?.business_type || null,
        city: b.searches?.city || null,
        daysSinceContact,
        contactCount: contactCountMap[b.id] || 0,
        aiCallResult: aiCallMap[b.id] || null,
        potential_tier: (analysis?.potential_tier as PotentialTier) || null,
        potential_score: analysis?.potential_score || null,
        estimated_revenue_min: analysis?.estimated_revenue_min || null,
        estimated_revenue_max: analysis?.estimated_revenue_max || null,
        primary_dm_index: b.primary_dm_index ?? null,
        auto_followup_enabled: b.auto_followup_enabled ?? false,
        last_email_template_id: b.last_email_template_id ?? null,
        has_unread_reply: !!replyMap[b.id],
        has_human_reply: humanReplyBizIds.has(b.id),
        last_reply_text: replyMap[b.id]?.text || null,
        last_reply_date: replyMap[b.id]?.date || null,
        contacted_today: contactedTodaySet.has(b.id),
        notes: b.notes ?? null,
        source: (b.source as 'auto' | 'manual') ?? 'auto',
        lead_channel: (b.lead_channel as KanbanBusiness['lead_channel']) ?? null,
      };

      const columnId = classifyBusiness(kanbanBusiness);
      columns[columnId].push(kanbanBusiness);
    });

    // Helpers for sorting
    const tierPriority = (b: KanbanBusiness) =>
      b.potential_tier === 'orca' ? 2 : b.potential_tier === 'delfin' ? 1 : 0;
    // Replies always float to top, then tier, then column-specific criteria
    const replyFirst = (a: KanbanBusiness, b: KanbanBusiness) => {
      const ar = a.has_unread_reply ? 1 : 0;
      const br = b.has_unread_reply ? 1 : 0;
      return br - ar;
    };

    const sortColumn = (col: KanbanBusiness[], tiebreak: (a: KanbanBusiness, b: KanbanBusiness) => number) => {
      col.sort((a, b) => {
        const rp = replyFirst(a, b);
        if (rp !== 0) return rp;
        const tp = tierPriority(b) - tierPriority(a);
        if (tp !== 0) return tp;
        return tiebreak(a, b);
      });
    };

    // Nuevos: replies → orcas → nombre
    sortColumn(columns.nuevo, (a, b) => a.name.localeCompare(b.name));
    // Contactados: replies → orcas → más antiguos
    sortColumn(columns.contactado, (a, b) => (b.daysSinceContact || 0) - (a.daysSinceContact || 0));
    // Seguimiento 1-3: replies → orcas → más antiguos
    sortColumn(columns.seguimiento_1, (a, b) => (b.daysSinceContact || 0) - (a.daysSinceContact || 0));
    sortColumn(columns.seguimiento_2, (a, b) => (b.daysSinceContact || 0) - (a.daysSinceContact || 0));
    sortColumn(columns.seguimiento_3, (a, b) => (b.daysSinceContact || 0) - (a.daysSinceContact || 0));
    // Interesados: replies → orcas → inbound → más recientes
    columns.interesado.sort((a, b) => {
      const rp = replyFirst(a, b);
      if (rp !== 0) return rp;
      const tp = tierPriority(b) - tierPriority(a);
      if (tp !== 0) return tp;
      const aInbound = a.lead_status === 'inbound' ? 1 : 0;
      const bInbound = b.lead_status === 'inbound' ? 1 : 0;
      if (aInbound !== bInbound) return bInbound - aInbound;
      return (a.daysSinceContact || 0) - (b.daysSinceContact || 0);
    });
    // Cotizados: replies → orcas → más recientes
    sortColumn(columns.cotizado, (a, b) => (a.daysSinceContact || 0) - (b.daysSinceContact || 0));
    // Clientes: replies → orcas → nombre
    sortColumn(columns.cliente, (a, b) => a.name.localeCompare(b.name));
    // Perdidos: por nombre
    columns.perdido.sort((a, b) => a.name.localeCompare(b.name));

    const counts: Record<KanbanColumnId, number> = {
      nuevo: columns.nuevo.length,
      contactado: columns.contactado.length,
      seguimiento_1: columns.seguimiento_1.length,
      seguimiento_2: columns.seguimiento_2.length,
      seguimiento_3: columns.seguimiento_3.length,
      interesado: columns.interesado.length,
      cotizado: columns.cotizado.length,
      cliente: columns.cliente.length,
      perdido: columns.perdido.length,
    };

    // WhatsApp stats — reuse todayHistory fetched above
    const sentToday = todayHistory?.length || 0;
    const sentManualToday = todayHistory?.filter(c => c.action_type === 'whatsapp').length || 0;
    const sentAutoToday = todayHistory?.filter(c => c.action_type === 'auto_whatsapp').length || 0;
    const repliesUnread = Object.keys(replyMap).length;
    const repliesHuman = humanReplyBizIds.size;
    const repliesBot = repliesUnread - repliesHuman;

    const whatsappStats: WhatsAppStats = {
      sentToday, sentManualToday, sentAutoToday,
      repliesUnread, repliesHuman, repliesBot,
    };

    return NextResponse.json({ columns, counts, whatsappStats });
  } catch (error) {
    console.error('Kanban error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
