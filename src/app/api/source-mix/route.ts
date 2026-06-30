import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/*
 * Inbound vs Outbound mix.
 *
 * OJO: el campo `source` ('manual'/'auto') NO sirve para saber el origen.
 * Cuando Alejandro "toma" un lead que encontró el bot, el sistema lo marca
 * 'manual' solo para apagar el auto-followup — no porque lo haya traído un humano.
 *
 * Por eso el origen real se deduce así (en orden de prioridad):
 *   1. Si Alejandro le puso un canal inbound (SEO, Donna, referido...) -> INBOUND
 *   2. Si entró por el formulario web (lead_status='inbound')          -> INBOUND
 *   3. Si tiene huella del bot (place_id de Google o rating)           -> OUTBOUND (bot)
 *   4. Si tiene canal comercial/linkedin/eventos                       -> OUTBOUND
 *   5. Resto                                                            -> desconocido
 */

const INBOUND_CHANNELS = [
  'google_seo', 'google_sem', 'laundryheap', 'referido', 'getlavado_b2c', 'getlavado_b2b',
];
const OUTBOUND_CHANNELS = ['comercial', 'linkedin', 'eventos'];

const CHANNEL_LABELS: Record<string, string> = {
  google_seo: '🌱 Google SEO',
  google_sem: '💸 Google SEM',
  laundryheap: '🧺 Laundryheap',
  referido: '👥 Referido',
  getlavado_b2c: '🌐 getlavado B2C',
  getlavado_b2b: '🏢 getlavado B2B',
  web: '🌐 Formulario web',
  bot: '🤖 Bot (auto)',
  comercial: '🤝 Comercial',
  linkedin: '💼 LinkedIn',
  eventos: '🎪 Eventos',
};

interface LeadRow {
  external_id: string | null;
  rating: number | null;
  lead_channel: string | null;
  lead_status: string | null;
  sales_stage: string | null;
  created_at: string | null;
}

function hasBotFingerprint(b: LeadRow): boolean {
  return (b.external_id || '').startsWith('ChIJ') || b.rating != null;
}

// Devuelve { type: 'inbound' | 'outbound' | 'unknown', channel: string }
function classify(b: LeadRow): { type: 'inbound' | 'outbound' | 'unknown'; channel: string } {
  if (b.lead_channel && INBOUND_CHANNELS.includes(b.lead_channel)) {
    return { type: 'inbound', channel: b.lead_channel };
  }
  if (b.lead_status === 'inbound') {
    return { type: 'inbound', channel: 'web' };
  }
  if (hasBotFingerprint(b)) {
    return { type: 'outbound', channel: 'bot' };
  }
  if (b.lead_channel && OUTBOUND_CHANNELS.includes(b.lead_channel)) {
    return { type: 'outbound', channel: b.lead_channel };
  }
  return { type: 'unknown', channel: 'unknown' };
}

// 'YYYY-MM' del created_at (en hora Perú, UTC-5)
function monthKey(createdAt: string | null): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return null;
  const peru = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  return `${peru.getUTCFullYear()}-${String(peru.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get('month') || 'all';

    // Traer TODOS los leads (paginado, el límite por defecto es 1000)
    const allLeads: LeadRow[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('businesses')
        .select('external_id, rating, lead_channel, lead_status, sales_stage, created_at')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allLeads.push(...(data as LeadRow[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Lista de meses disponibles (desc) para el selector
    const availableMonths = Array.from(
      new Set(allLeads.map((b) => monthKey(b.created_at)).filter((m): m is string => !!m))
    ).sort((a, b) => b.localeCompare(a));

    // Filtrar al mes seleccionado ('all' = todo el histórico)
    const all = month === 'all' ? allLeads : allLeads.filter((b) => monthKey(b.created_at) === month);

    type Bucket = { total: number; clientes: number };
    const channelAgg: Record<string, { type: string; channel: string } & Bucket> = {};
    const totals = {
      inbound: { total: 0, clientes: 0 },
      outbound: { total: 0, clientes: 0 },
      unknown: { total: 0, clientes: 0 },
    };

    for (const b of all) {
      const { type, channel } = classify(b);
      const won = b.sales_stage === 'cliente' ? 1 : 0;
      totals[type].total += 1;
      totals[type].clientes += won;
      if (type === 'unknown') continue;
      const key = `${type}:${channel}`;
      if (!channelAgg[key]) channelAgg[key] = { type, channel, total: 0, clientes: 0 };
      channelAgg[key].total += 1;
      channelAgg[key].clientes += won;
    }

    const channels = Object.values(channelAgg)
      .map((c) => ({
        type: c.type,
        channel: c.channel,
        label: CHANNEL_LABELS[c.channel] ?? c.channel,
        total: c.total,
        clientes: c.clientes,
      }))
      .sort((a, b) => b.total - a.total);

    const grandTotal = all.length;

    return NextResponse.json({
      month,
      availableMonths,
      grandTotal,
      inbound: {
        ...totals.inbound,
        pct: grandTotal ? Math.round((totals.inbound.total / grandTotal) * 100) : 0,
        channels: channels.filter((c) => c.type === 'inbound'),
      },
      outbound: {
        ...totals.outbound,
        pct: grandTotal ? Math.round((totals.outbound.total / grandTotal) * 100) : 0,
        channels: channels.filter((c) => c.type === 'outbound'),
      },
      unknown: totals.unknown,
    });
  } catch (error) {
    console.error('Error in source-mix:', error);
    return NextResponse.json({ error: 'Failed to compute source mix' }, { status: 500 });
  }
}
