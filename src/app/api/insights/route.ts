import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Maps the human-readable stage names used in stage_change notes back to
// the canonical stage IDs. The note format is:
//   "📋 Cambio de etapa: <fromName> → <toName>"
const STAGE_NAME_TO_ID: Record<string, string> = {
  'Nuevos': 'nuevo',
  'Nuevo': 'nuevo',
  'Contactado': 'contactado',
  'Seguimiento 1': 'seguimiento_1',
  'Seguimiento 2': 'seguimiento_2',
  'Último Intento': 'seguimiento_3',
  'Seguimiento 3': 'seguimiento_3',
  'Interesado': 'interesado',
  'Cotizado': 'cotizado',
  'Cliente': 'cliente',
  'Perdido': 'perdido',
};

const STAGE_LABELS: Record<string, string> = {
  nuevo: 'Nuevos',
  contactado: 'Contactado',
  seguimiento_1: 'Seguimiento 1',
  seguimiento_2: 'Seguimiento 2',
  seguimiento_3: 'Último Intento',
  interesado: 'Interesado',
  cotizado: 'Cotizado',
  cliente: 'Cliente',
  perdido: 'Perdido',
};

const REASON_LABELS: Record<string, string> = {
  precio: '💰 Precio',
  lavado_interno: '🏠 Lavado interno',
  tiene_proveedor: '🤝 Tiene proveedor',
  mal_timing: '⏰ Mal timing',
  no_interesado: '🚫 No interesado',
  no_contesta: '📵 No contesta',
  no_decisor: '🚪 No es decisor',
  otro: '❓ Otro',
};

const CHANNEL_LABELS: Record<string, string> = {
  comercial: '🤝 Comercial',
  google_seo: '🌱 Google SEO',
  google_sem: '💸 Google SEM',
  laundryheap: '🧺 Laundryheap',
  getlavado_b2c: '🌐 getlavado B2C',
  getlavado_b2b: '🏢 getlavado B2B',
  referido: '👥 Referido',
  linkedin: '💼 LinkedIn',
  eventos: '🎪 Eventos',
  otro: '❓ Otro',
};

function parseStageTransition(noteText: string | null): { from: string; to: string } | null {
  if (!noteText) return null;
  // Match "Cambio de etapa: X → Y" — note that → might come from the literal symbol
  const m = noteText.match(/Cambio de etapa:\s*(.+?)\s*[→→]\s*(.+?)$/m);
  if (!m) return null;
  const fromName = m[1].trim();
  const toName = m[2].trim();
  const from = STAGE_NAME_TO_ID[fromName];
  const to = STAGE_NAME_TO_ID[toName];
  if (!from || !to) return null;
  return { from, to };
}

export async function GET() {
  try {
    // 1) All businesses (only the fields we need)
    const { data: businesses, error: bizErr } = await supabase
      .from('businesses')
      .select('id, name, phone, sales_stage, lost_reason, lead_channel, source, created_at');

    if (bizErr || !businesses) {
      console.error('insights: error fetching businesses', bizErr);
      return NextResponse.json({ error: 'Error al obtener insights' }, { status: 500 });
    }

    // 2) Stage change history — paginated
    type ChangeRow = { business_id: string; notes: string | null; created_at: string };
    const stageChanges: ChangeRow[] = [];
    {
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('contact_history')
          .select('business_id, notes, created_at')
          .eq('action_type', 'stage_change')
          .order('created_at', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error || !data) break;
        stageChanges.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
    }

    // 3) ── Summary ──
    const totalLeads = businesses.length;
    const wonClientes = businesses.filter(b => b.sales_stage === 'cliente').length;
    const lostPerdidos = businesses.filter(b => b.sales_stage === 'perdido').length;
    const activeLeads = totalLeads - wonClientes - lostPerdidos;
    const decided = wonClientes + lostPerdidos;
    const winRate = decided > 0 ? wonClientes / decided : 0;

    // 4) ── Loss by previous stage ──
    // For each business currently in 'perdido', find the stage_change entry that landed it there
    // and bucket by the from-stage.
    const lostBusinessIds = new Set(
      businesses.filter(b => b.sales_stage === 'perdido').map(b => b.id)
    );
    const reasonByBusinessId: Record<string, string | null> = {};
    businesses.forEach(b => { if (lostBusinessIds.has(b.id)) reasonByBusinessId[b.id] = b.lost_reason ?? null; });

    // For each lost lead, find its latest "→ Perdido" stage_change to know where it came from.
    const lossPrevStageByBiz: Record<string, string> = {};
    for (const ch of stageChanges) {
      if (!lostBusinessIds.has(ch.business_id)) continue;
      const t = parseStageTransition(ch.notes);
      if (!t || t.to !== 'perdido') continue;
      // Always overwrite — stageChanges is sorted ascending, so the last write is the latest
      lossPrevStageByBiz[ch.business_id] = t.from;
    }

    const lossPrevAgg: Record<string, { count: number; reasons: Record<string, number> }> = {};
    Object.entries(lossPrevStageByBiz).forEach(([bizId, prevStage]) => {
      if (!lossPrevAgg[prevStage]) lossPrevAgg[prevStage] = { count: 0, reasons: {} };
      lossPrevAgg[prevStage].count += 1;
      const reason = reasonByBusinessId[bizId];
      if (reason) {
        lossPrevAgg[prevStage].reasons[reason] = (lossPrevAgg[prevStage].reasons[reason] ?? 0) + 1;
      }
    });

    const lossByPreviousStage = Object.entries(lossPrevAgg)
      .map(([stage, v]) => {
        const topReasonEntry = Object.entries(v.reasons).sort((a, b) => b[1] - a[1])[0];
        return {
          stage,
          label: STAGE_LABELS[stage] ?? stage,
          count: v.count,
          topReason: topReasonEntry ? topReasonEntry[0] : null,
          topReasonLabel: topReasonEntry ? REASON_LABELS[topReasonEntry[0]] : null,
        };
      })
      .sort((a, b) => b.count - a.count);

    // 5) ── Top loss reasons ──
    const reasonAgg: Record<string, number> = {};
    businesses.forEach(b => {
      if (b.sales_stage !== 'perdido') return;
      const r = b.lost_reason ?? 'unset';
      reasonAgg[r] = (reasonAgg[r] ?? 0) + 1;
    });
    const lossByReason = Object.entries(reasonAgg)
      .map(([reason, count]) => ({
        reason,
        label: reason === 'unset' ? '❌ Sin razón' : (REASON_LABELS[reason] ?? reason),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // 6) ── Channel performance (manual leads only) ──
    const channelAgg: Record<string, { total: number; won: number; lost: number; active: number }> = {};
    businesses.forEach(b => {
      if (b.source !== 'manual' || !b.lead_channel) return;
      if (!channelAgg[b.lead_channel]) channelAgg[b.lead_channel] = { total: 0, won: 0, lost: 0, active: 0 };
      const bucket = channelAgg[b.lead_channel];
      bucket.total += 1;
      if (b.sales_stage === 'cliente') bucket.won += 1;
      else if (b.sales_stage === 'perdido') bucket.lost += 1;
      else bucket.active += 1;
    });
    const channelPerformance = Object.entries(channelAgg)
      .map(([channel, v]) => {
        const dec = v.won + v.lost;
        return {
          channel,
          label: CHANNEL_LABELS[channel] ?? channel,
          ...v,
          winRate: dec > 0 ? v.won / dec : null,
        };
      })
      .sort((a, b) => b.total - a.total);

    // 7) ── Duplicate detection ──
    // Group by phone (digits only) and by normalized name. Any group with 2+ leads
    // is flagged. Phone duplicates are higher signal (same number = almost certainly
    // the same business) than name duplicates ("Restaurante El Sol" exists 5 times).
    type Biz = typeof businesses[number];
    const byPhone: Record<string, Biz[]> = {};
    const byName: Record<string, Biz[]> = {};
    businesses.forEach(b => {
      const phoneDigits = (b.phone || '').replace(/\D/g, '');
      if (phoneDigits.length >= 7) {
        // Use last 9 digits (Peru mobile) to match "+51..." vs "..." vs "9..."
        const key = phoneDigits.slice(-9);
        (byPhone[key] = byPhone[key] || []).push(b);
      }
      const nameKey = (b.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (nameKey.length >= 3) {
        (byName[nameKey] = byName[nameKey] || []).push(b);
      }
    });

    const phoneDuplicates = Object.entries(byPhone)
      .filter(([, group]) => group.length >= 2)
      .map(([key, group]) => ({
        key,
        kind: 'phone' as const,
        count: group.length,
        leads: group.map(b => ({
          id: b.id,
          name: b.name,
          phone: b.phone,
          sales_stage: b.sales_stage,
          created_at: b.created_at,
        })),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    // Skip name duplicates that are already caught by phone (avoid double-listing)
    const phoneDupIds = new Set(phoneDuplicates.flatMap(d => d.leads.map(l => l.id)));
    const nameDuplicates = Object.entries(byName)
      .filter(([, group]) => group.length >= 2 && !group.every(b => phoneDupIds.has(b.id)))
      .map(([key, group]) => ({
        key,
        kind: 'name' as const,
        count: group.length,
        leads: group.map(b => ({
          id: b.id,
          name: b.name,
          phone: b.phone,
          sales_stage: b.sales_stage,
          created_at: b.created_at,
        })),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    return NextResponse.json({
      summary: { totalLeads, wonClientes, lostPerdidos, activeLeads, winRate },
      lossByPreviousStage,
      lossByReason,
      channelPerformance,
      duplicates: {
        phoneGroups: phoneDuplicates,
        nameGroups: nameDuplicates,
        totalDuplicateLeads:
          phoneDuplicates.reduce((s, g) => s + g.count, 0) +
          nameDuplicates.reduce((s, g) => s + g.count, 0),
      },
    });
  } catch (err) {
    console.error('insights error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
