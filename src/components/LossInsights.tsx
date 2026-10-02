'use client';

import { useEffect, useState } from 'react';

interface LossByStage {
  stage: string;
  label: string;
  count: number;
  topReason: string | null;
  topReasonLabel: string | null;
}

interface LossByReason {
  reason: string;
  label: string;
  count: number;
}

interface TierBreakdown {
  lost: number;
  lossByReason: LossByReason[];
  lossByPreviousStage: LossByStage[];
}

type Tier = 'all' | 'orca' | 'delfin';
type Source = 'all' | 'auto' | 'manual';

// Tier × source matrix: each cell is a complete loss breakdown.
type BySource = Record<Source, TierBreakdown>;

interface Insights {
  month: string;
  availableMonths: string[];
  summary: {
    totalLeads: number;
    wonClientes: number;
    lostPerdidos: number;
    activeLeads: number;
    winRate: number;
  };
  lossByPreviousStage: LossByStage[];
  lossByReason: LossByReason[];
  lossByTierSource: Record<Tier, BySource>;
}

// 'YYYY-MM' -> 'June 2026'
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Current month ('YYYY-MM') — selector default: starts on the current month,
// not on the full history.
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Actionable recommendation for each loss reason.
// The point of the block isn't the chart, it's the "so what do I do now?".
const REASON_TIPS: Record<string, string> = {
  precio:
    'Offer an entry plan or volume pricing, and show them the real savings vs. doing laundry in-house.',
  lavado_interno:
    'Quantify their hidden cost (staff, water, space, damages) and sell them savings + consistency.',
  tiene_proveedor:
    'Offer a no-commitment pilot and compete on turnaround and service, not just price.',
  mal_timing:
    'Don\'t lose them: schedule a follow-up in 30–60 days. The interest is there, just not the timing.',
  no_interesado:
    'Review who you are prospecting — it may be a targeting problem, not a sales one.',
  no_contesta:
    'Try another channel and time, and combine WhatsApp with a call before giving them up.',
  no_decisor:
    'From the first contact, ask to speak with the owner or manager who makes the decision.',
};

function Bar({ value, max, color, track }: { value: number; max: number; color: string; track: string }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex-1 h-1.5 rounded-full" style={{ background: track }}>
      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function LossInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [month, setMonth] = useState(currentMonthKey);
  const [tier, setTier] = useState<Tier>('all');
  const [source, setSource] = useState<Source>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/insights?month=${encodeURIComponent(month)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((d: Insights) => {
        if (!('error' in d)) setData(d);
      })
      .catch((e) => console.error('Error fetching insights:', e))
      .finally(() => setLoading(false));
  }, [month]);

  if (!data && loading) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm mb-4 sm:mb-6 h-40 animate-pulse" />
    );
  }
  if (!data) return null;
  // In "all time" with no losses, we hide the whole block.
  // With a month selected we show the header + an empty state (so you can switch months).
  if (month === 'all' && data.summary.lostPerdidos === 0) return null;

  const { summary, lossByTierSource } = data;

  // Active cell of the tier × source matrix. The two filters intersect: e.g.
  // 🐋 orcas + ✋ manual. The report (reasons, stage, insight) comes from here.
  const active = lossByTierSource[tier][source];
  const activeLost = active.lost;
  const lossByReason = active.lossByReason;
  const lossByPreviousStage = active.lossByPreviousStage;

  // Contextual counters: each pill is counted within the OTHER active filter,
  // so the two rows' numbers always match what's on screen.
  const tierCount = (t: Tier) => lossByTierSource[t][source].lost;
  const sourceCount = (s: Source) => lossByTierSource[tier][s].lost;

  // Reasons with a recorded reason (excludes "No reason") for the recommendations.
  const reasonsWithLabel = lossByReason.filter((r) => r.reason !== 'unset');
  const unset = lossByReason.find((r) => r.reason === 'unset');
  const unsetShare = activeLost > 0 ? (unset?.count ?? 0) / activeLost : 0;

  const maxReason = Math.max(1, ...lossByReason.map((r) => r.count));
  const maxStage = Math.max(1, ...lossByPreviousStage.map((s) => s.count));

  // Top 3 actionable reasons for the recommendations.
  const topTips = reasonsWithLabel
    .filter((r) => REASON_TIPS[r.reason])
    .slice(0, 3);

  // Funnel insight: where do lost leads actually drop off?
  // Four moments, not two. The key detail: follow-up isn't a single bucket —
  // dropping at Follow-up 1-2 (you gave up too early) calls for MORE
  // persistence, but dropping at Last Attempt (you already exhausted the
  // sequence) calls for the opposite: the problem is no longer persistence,
  // it's who you prospect and whether the message hooks. Lumping them together
  // would give the advice backwards.
  const STAGE_BUCKET: Record<string, 'prospeccion' | 'seguimiento' | 'agotado' | 'cierre'> = {
    nuevo: 'prospeccion',
    contactado: 'prospeccion',
    seguimiento_1: 'seguimiento',
    seguimiento_2: 'seguimiento',
    seguimiento_3: 'agotado', // "Last Attempt" — pursued to the very end
    interesado: 'cierre',
    cotizado: 'cierre',
    cliente: 'cierre',
  };
  const bucketTotals = { prospeccion: 0, seguimiento: 0, agotado: 0, cierre: 0 };
  for (const s of lossByPreviousStage) {
    const b = STAGE_BUCKET[s.stage];
    if (b) bucketTotals[b] += s.count;
  }
  const stagedTotal =
    bucketTotals.prospeccion + bucketTotals.seguimiento + bucketTotals.agotado + bucketTotals.cierre;
  const dominantBucket = (['prospeccion', 'seguimiento', 'agotado', 'cierre'] as const).reduce((a, b) =>
    bucketTotals[b] > bucketTotals[a] ? b : a
  );
  const dominantShare = stagedTotal > 0 ? Math.round((bucketTotals[dominantBucket] / stagedTotal) * 100) : 0;

  const decided = summary.wonClientes + summary.lostPerdidos;
  const lostShare = decided > 0 ? Math.round((summary.lostPerdidos / decided) * 100) : 0;

  // The % of decided only makes sense on the unfiltered total.
  const headerCount =
    tier === 'all' && source === 'all'
      ? `${summary.lostPerdidos} lost · ${lostShare}% of decided`
      : `${activeLost} ${activeLost === 1 ? 'lost' : 'lost'}`;

  const TIER_PILLS: { key: Tier; label: string }[] = [
    { key: 'all', label: `All ${tierCount('all')}` },
    { key: 'orca', label: `🐋 Orcas ${tierCount('orca')}` },
    { key: 'delfin', label: `🐬 Dolphins ${tierCount('delfin')}` },
  ];
  const SOURCE_PILLS: { key: Source; label: string }[] = [
    { key: 'all', label: `All ${sourceCount('all')}` },
    { key: 'auto', label: `🤖 Auto ${sourceCount('auto')}` },
    { key: 'manual', label: `✋ Manual ${sourceCount('manual')}` },
  ];

  // Ensures the selected month (the current month by default) is always an
  // option, even if the API doesn't return it yet for lack of decided leads.
  const monthOptions =
    month === 'all' || data.availableMonths.includes(month)
      ? data.availableMonths
      : [month, ...data.availableMonths];

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <h2 className="text-sm sm:text-lg font-semibold text-gray-900">Why are we losing leads?</h2>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
            {headerCount}
          </span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-[11px] sm:text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All time</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Two filters that intersect: lead value (🐋/🐬) and who works it (🤖/✋) */}
      <div className="flex flex-col gap-1.5 mb-3">
        <div className="flex items-center gap-1.5">
          {TIER_PILLS.map((p) => (
            <button
              key={p.key}
              onClick={() => setTier(p.key)}
              className={`text-[11px] sm:text-xs px-2.5 py-1 rounded-full border transition-colors ${
                tier === p.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {SOURCE_PILLS.map((p) => (
            <button
              key={p.key}
              onClick={() => setSource(p.key)}
              className={`text-[11px] sm:text-xs px-2.5 py-1 rounded-full border transition-colors ${
                source === p.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {activeLost === 0 ? (
        <div className="bg-white rounded-xl sm:rounded-2xl p-6 border border-gray-100 shadow-sm text-center text-sm text-gray-400">
          No leads were lost with that filter{month === 'all' ? ' in all time' : ` in ${monthLabel(month)}`}
        </div>
      ) : (
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Rejection reasons */}
          <div>
            <div className="text-xs sm:text-sm font-bold text-gray-800 mb-3">🧨 Reason for rejection</div>
            <div className="flex flex-col gap-2.5">
              {lossByReason.slice(0, 7).map((r) => (
                <div key={r.reason}>
                  <div className="flex justify-between items-baseline mb-1 text-xs gap-2">
                    <span className="text-gray-700 truncate">{r.label}</span>
                    <span className="text-gray-400 tabular-nums">{r.count}</span>
                  </div>
                  <Bar value={r.count} max={maxReason} color="#ef4444" track="#fef2f2" />
                </div>
              ))}
            </div>
          </div>

          {/* What stage they drop off at */}
          <div>
            <div className="text-xs sm:text-sm font-bold text-gray-800 mb-3">💀 At what stage do they drop off?</div>
            {lossByPreviousStage.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No stage data yet.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {lossByPreviousStage.map((s) => (
                  <div key={s.stage}>
                    <div className="flex justify-between items-baseline mb-1 text-xs gap-2">
                      <span className="text-gray-700 truncate">{s.label}</span>
                      <span className="text-gray-400 tabular-nums">{s.count}</span>
                    </div>
                    <Bar value={s.count} max={maxStage} color="#f97316" track="#fff7ed" />
                    {s.topReasonLabel && (
                      <div className="text-[10px] text-gray-400 italic mt-0.5">↳ mostly due to {s.topReasonLabel}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Funnel insight */}
        {stagedTotal > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-600">
            {dominantBucket === 'cierre' ? (
              <span>
                📉 <strong>{dominantShare}%</strong> of losses happen late (interested or quoted). The
                problem is in <strong>closing</strong>, not prospecting — mind price, follow-up and
                objections in the home stretch.
              </span>
            ) : dominantBucket === 'agotado' ? (
              <span>
                📉 <strong>{dominantShare}%</strong> of losses happen at the <strong>Last Attempt</strong> —
                leads you chased until the follow-up sequence was exhausted and still didn't close. Pushing harder
                isn't the answer: the problem is <strong>upstream, in qualification</strong> — aim for better leads and
                an opener that hooks, so you don't burn the whole sequence on someone who was never going to buy.
              </span>
            ) : dominantBucket === 'seguimiento' ? (
              <span>
                📉 <strong>{dominantShare}%</strong> of losses happen mid <strong>follow-up</strong> —
                leads you stopped chasing too early. There's still room: add touches, vary channel and time, and
                combine WhatsApp with a call before giving them up.
              </span>
            ) : (
              <span>
                📉 Most losses are <strong>early</strong> (before real contact is established). The
                bottleneck is in <strong>prospecting and first contact</strong> — improve who you prospect and
                the opening message.
              </span>
            )}
          </div>
        )}

        {/* Actionable recommendations */}
        {topTips.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs sm:text-sm font-bold text-gray-800 mb-2">💡 What to do</div>
            <div className="flex flex-col gap-2">
              {topTips.map((r) => (
                <div key={r.reason} className="flex gap-2 text-xs">
                  <span className="text-gray-800 font-medium whitespace-nowrap">{r.label}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-gray-600">{REASON_TIPS[r.reason]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data-quality nudge: if many losses have no reason, the insights are worth little */}
        {unsetShare >= 0.3 && (
          <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            ⚠️ {Math.round(unsetShare * 100)}% of lost leads have no recorded reason. Ask the team to
            mark the reason when moving a card to <strong>Lost</strong> — that makes these insights far more
            useful.
          </div>
        )}
      </div>
      )}
    </div>
  );
}
