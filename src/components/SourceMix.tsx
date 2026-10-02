'use client';

import { useEffect, useState } from 'react';

interface ChannelItem {
  channel: string;
  label: string;
  total: number;
  clientes: number;
}

interface SideData {
  total: number;
  clientes: number;
  pct: number;
  channels: ChannelItem[];
}

interface Mix {
  grandTotal: number;
  inbound: SideData;
  outbound: SideData;
  unknown: { total: number; clientes: number };
}

type Tier = 'all' | 'orca' | 'delfin';
type Source = 'all' | 'auto' | 'manual';

// Tier × source matrix: each cell is a complete inbound/outbound mix.
type BySource = Record<Source, Mix>;

interface SourceMixData extends Mix {
  month: string;
  availableMonths: string[];
  byTierSource: Record<Tier, BySource>;
}

// 'YYYY-MM' -> 'June 2026'
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Current month ('YYYY-MM') — the selector default: by default you show
// the current month, not the full history.
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Readable close %: shows 1 decimal when it's <1% but not zero,
// so we don't show "0%" when there actually were closes (e.g. 3/1004 = 0.3%)
function convLabel(clientes: number, total: number): string {
  if (!total || clientes === 0) return '0%';
  const raw = (clientes / total) * 100;
  return raw < 1 ? `${raw.toFixed(1)}%` : `${Math.round(raw)}%`;
}

function ChannelBar({ item, max, color, track }: { item: ChannelItem; max: number; color: string; track: string }) {
  // Leads bar: relative to the largest channel on the side (volume)
  const volWidth = max > 0 ? Math.round((item.total / max) * 100) : 0;
  // Close bar: real conversion %, over 100% (quality)
  const convRaw = item.total > 0 ? (item.clientes / item.total) * 100 : 0;
  // minimum visible when there's at least 1 close, so it doesn't disappear
  const convWidth = item.clientes > 0 ? Math.max(3, Math.round(convRaw)) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5 text-xs sm:text-sm gap-2">
        <span className="text-gray-700 truncate">{item.label}</span>
        <span className="text-gray-400 tabular-nums whitespace-nowrap">
          {item.total} <span className="text-gray-300">·</span>{' '}
          <span style={{ color }} className="font-semibold">{item.clientes} ✓</span>{' '}
          <span className="text-gray-400">{convLabel(item.clientes, item.total)}</span>
        </span>
      </div>
      {/* LEADS bar (volume) — light tone */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9px] text-gray-400 w-9 shrink-0">leads</span>
        <div className="flex-1 h-1.5 rounded-full" style={{ background: track }}>
          <div className="h-1.5 rounded-full" style={{ width: `${volWidth}%`, background: color, opacity: 0.45 }} />
        </div>
      </div>
      {/* CLOSE bar (conversion %) — strong tone, 0-100% scale */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-gray-400 w-9 shrink-0">close</span>
        <div className="flex-1 h-1.5 rounded-full" style={{ background: track }}>
          <div className="h-1.5 rounded-full" style={{ width: `${convWidth}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

function Side({
  title,
  emoji,
  color,
  track,
  data,
  subtitle,
}: {
  title: string;
  emoji: string;
  color: string;
  track: string;
  data: SideData;
  subtitle: string;
}) {
  const max = Math.max(1, ...data.channels.map((c) => c.total));
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm">
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-xs sm:text-sm font-bold" style={{ color }}>
          {emoji} {title}
        </span>
        <span className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">{data.total}</span>
      </div>
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <span className="text-[10px] sm:text-xs text-gray-400">{subtitle}</span>
        <span
          className="text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-full"
          style={{ color, background: track }}
        >
          {data.clientes} clients · {convLabel(data.clientes, data.total)} close
        </span>
      </div>
      <div className="flex flex-col gap-2.5 sm:gap-3">
        {data.channels.length === 0 ? (
          <p className="text-xs text-gray-400">No data</p>
        ) : (
          data.channels.map((c) => (
            <ChannelBar key={c.channel} item={c} max={max} color={color} track={track} />
          ))
        )}
      </div>
    </div>
  );
}

export default function SourceMix() {
  const [data, setData] = useState<SourceMixData | null>(null);
  const [month, setMonth] = useState(currentMonthKey);
  const [tier, setTier] = useState<Tier>('all');
  const [source, setSource] = useState<Source>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/source-mix?month=${encodeURIComponent(month)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setData(d);
      })
      .catch((e) => console.error('Error fetching source-mix:', e))
      .finally(() => setLoading(false));
  }, [month]);

  // On the first load there's no data yet
  if (!data && loading) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm mb-4 sm:mb-6 h-40 animate-pulse" />
    );
  }
  if (!data) return null;
  // If the full history is empty, don't show anything
  if (month === 'all' && data.grandTotal === 0) return null;

  // Active cell of the tier × source matrix. The two filters intersect: e.g.
  // 🐋 orcas + 🤖 automatic. The whole source mix comes from here.
  const activeMix: Mix = data.byTierSource[tier][source];
  const inPct = activeMix.inbound.pct;
  const outPct = activeMix.outbound.pct;

  // Contextual counters: each pill is counted within the OTHER active filter,
  // so the two rows' numbers always match what's on screen.
  const tierCount = (t: Tier) => data.byTierSource[t][source].grandTotal;
  const sourceCount = (s: Source) => data.byTierSource[tier][s].grandTotal;

  const periodLabel =
    month === 'all' ? `${activeMix.grandTotal} leads total` : `${activeMix.grandTotal} leads this month`;

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

  // Ensures the selected month (the current month by default) is always
  // an option, even if the API doesn't return it yet for lack of leads.
  const monthOptions =
    month === 'all' || data.availableMonths.includes(month)
      ? data.availableMonths
      : [month, ...data.availableMonths];

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <h2 className="text-sm sm:text-lg font-semibold text-gray-900">Where do your leads come from?</h2>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] sm:text-xs text-gray-400">{periodLabel}</span>
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

      {activeMix.grandTotal === 0 ? (
        <div className="bg-white rounded-xl sm:rounded-2xl p-6 border border-gray-100 shadow-sm text-center text-sm text-gray-400">
          No leads came in with that filter{month === 'all' ? ' in all time' : ` in ${monthLabel(month)}`}
        </div>
      ) : (
      <>
      {/* Summary bar inbound vs outbound */}
      <div className="flex h-3 sm:h-3.5 rounded-full overflow-hidden mb-1.5">
        {inPct > 0 && <div style={{ width: `${inPct}%`, background: '#10b981' }} />}
        {outPct > 0 && <div style={{ width: `${outPct}%`, background: '#3b82f6' }} />}
      </div>
      <div className="flex justify-between text-[11px] sm:text-xs font-semibold mb-4 sm:mb-5">
        <span className="text-emerald-600">🟢 Inbound {inPct}%</span>
        <span className="text-blue-600">Outbound {outPct}% 🔵</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Side
          title="INBOUND"
          emoji="🟢"
          color="#059669"
          track="#ecfdf5"
          data={activeMix.inbound}
          subtitle="came on their own"
        />
        <Side
          title="OUTBOUND"
          emoji="🔵"
          color="#2563eb"
          track="#eff6ff"
          data={activeMix.outbound}
          subtitle="we went after them"
        />
      </div>
      </>
      )}
    </div>
  );
}
