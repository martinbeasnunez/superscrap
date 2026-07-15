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
  month: string;
  availableMonths: string[];
  grandTotal: number;
  inbound: SideData;
  outbound: SideData;
  unknown: { total: number; clientes: number };
}

// 'YYYY-MM' -> 'Junio 2026'
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Mes en curso ('YYYY-MM') — es el default del selector: por defecto muestras
// el mes actual, no todo el histórico.
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// % de cierre legible: muestra 1 decimal cuando es <1% pero no cero,
// para no mostrar "0%" cuando en realidad sí hubo cierres (ej. 3/1004 = 0.3%)
function convLabel(clientes: number, total: number): string {
  if (!total || clientes === 0) return '0%';
  const raw = (clientes / total) * 100;
  return raw < 1 ? `${raw.toFixed(1)}%` : `${Math.round(raw)}%`;
}

function ChannelBar({ item, max, color, track }: { item: ChannelItem; max: number; color: string; track: string }) {
  // Barra de leads: relativa al canal más grande del lado (volumen)
  const volWidth = max > 0 ? Math.round((item.total / max) * 100) : 0;
  // Barra de cierre: % de conversión real, sobre 100% (calidad)
  const convRaw = item.total > 0 ? (item.clientes / item.total) * 100 : 0;
  // mínimo visible cuando hay al menos 1 cierre, para que no desaparezca
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
      {/* Barra LEADS (volumen) — tono claro */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9px] text-gray-400 w-9 shrink-0">leads</span>
        <div className="flex-1 h-1.5 rounded-full" style={{ background: track }}>
          <div className="h-1.5 rounded-full" style={{ width: `${volWidth}%`, background: color, opacity: 0.45 }} />
        </div>
      </div>
      {/* Barra CIERRE (conversión %) — tono fuerte, escala 0-100% */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-gray-400 w-9 shrink-0">cierre</span>
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
          {data.clientes} clientes · {convLabel(data.clientes, data.total)} cierre
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
  const [month, setMonth] = useState(currentMonthKey);
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

  // En la primera carga aún no hay data
  if (!data && loading) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm mb-4 sm:mb-6 h-40 animate-pulse" />
    );
  }
  if (!data) return null;
  // Si el histórico completo está vacío, no mostrar nada
  if (month === 'all' && data.grandTotal === 0) return null;

  const inPct = data.inbound.pct;
  const outPct = data.outbound.pct;

  const periodLabel = month === 'all' ? `${data.grandTotal} leads en total` : `${data.grandTotal} leads en el mes`;

  // Garantiza que el mes seleccionado (por defecto, el mes en curso) siempre
  // sea una opción, aunque el API aún no lo devuelva por no tener leads.
  const monthOptions =
    month === 'all' || data.availableMonths.includes(month)
      ? data.availableMonths
      : [month, ...data.availableMonths];

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <h2 className="text-sm sm:text-lg font-semibold text-gray-900">¿De dónde vienen tus leads?</h2>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] sm:text-xs text-gray-400">{periodLabel}</span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-[11px] sm:text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Todo el tiempo</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {month !== 'all' && data.grandTotal === 0 ? (
        <div className="bg-white rounded-xl sm:rounded-2xl p-6 border border-gray-100 shadow-sm text-center text-sm text-gray-400">
          No entraron leads en {monthLabel(month)}
        </div>
      ) : (
      <>
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
      </>
      )}
    </div>
  );
}
