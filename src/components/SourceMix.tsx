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

interface SourceMixData {
  grandTotal: number;
  inbound: SideData;
  outbound: SideData;
  unknown: { total: number; clientes: number };
}

function ChannelBar({ item, max, color, track }: { item: ChannelItem; max: number; color: string; track: string }) {
  const width = max > 0 ? Math.round((item.total / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1 text-xs sm:text-sm">
        <span className="text-gray-700">{item.label}</span>
        <span className="text-gray-400 tabular-nums">{item.total}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: track }}>
        <div className="h-1.5 rounded-full" style={{ width: `${width}%`, background: color }} />
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
  const conv = data.total > 0 ? Math.round((data.clientes / data.total) * 100) : 0;
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
          {data.clientes} clientes · {conv}% cierre
        </span>
      </div>
      <div className="flex flex-col gap-2.5 sm:gap-3">
        {data.channels.length === 0 ? (
          <p className="text-xs text-gray-400">Sin datos</p>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/source-mix')
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setData(d);
      })
      .catch((e) => console.error('Error fetching source-mix:', e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm mb-4 sm:mb-6 h-40 animate-pulse" />
    );
  }
  if (!data || data.grandTotal === 0) return null;

  const inPct = data.inbound.pct;
  const outPct = data.outbound.pct;

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-sm sm:text-lg font-semibold text-gray-900">¿De dónde vienen tus leads?</h2>
        <span className="text-[10px] sm:text-xs text-gray-400">{data.grandTotal} leads en total</span>
      </div>

      {/* Barra resumen inbound vs outbound */}
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
          data={data.inbound}
          subtitle="vinieron solos"
        />
        <Side
          title="OUTBOUND"
          emoji="🔵"
          color="#2563eb"
          track="#eff6ff"
          data={data.outbound}
          subtitle="fuimos a buscarlos"
        />
      </div>
    </div>
  );
}
