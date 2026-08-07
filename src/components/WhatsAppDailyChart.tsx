'use client';

import { useEffect, useState } from 'react';

interface DayPoint {
  date: string;       // YYYY-MM-DD (Lima local)
  manual: number;     // total manual sends (all sellers)
  auto: number;       // sent by the cron
  reply: number;      // inbound replies
  manualBy: Record<string, number>; // manual sends split by seller name
}

interface Sender { name: string; count: number; }

interface DailyResponse {
  days: number;
  series: DayPoint[];
  totals: { manual: number; auto: number; reply: number };
  senders: Sender[];  // sellers with manual sends, sorted by volume
}

// Color por vendedor (clases literales para que Tailwind las incluya).
const SENDER_COLORS: Record<string, string> = {
  'Alejandro': 'bg-orange-500',
  'Martin': 'bg-blue-500',
  'Martín': 'bg-blue-500',
};
const FALLBACK_COLORS = ['bg-teal-500', 'bg-pink-500', 'bg-amber-500', 'bg-indigo-500', 'bg-rose-500'];
function colorFor(name: string, idx: number): string {
  return SENDER_COLORS[name] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}
// Emoji por vendedor para la leyenda/tooltip.
function iconFor(name: string): string {
  if (name === 'Alejandro') return '✋';
  if (name === 'Martin' || name === 'Martín') return '👑';
  return '🧑';
}

function formatDayLabel(iso: string): string {
  // iso = "2026-05-26" → "26/05"
  const [, mm, dd] = iso.split('-');
  return `${dd}/${mm}`;
}

function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 || day === 6;
}

const RANGE_OPTIONS: { label: string; days: number }[] = [
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
];

export default function WhatsAppDailyChart({ days: defaultDays = 30 }: { days?: number }) {
  const [days, setDays] = useState<number>(defaultDays);
  const [data, setData] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stats/whatsapp-daily?days=${days}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then((d: DailyResponse) => setData(d))
      .catch(err => console.error('whatsapp-daily fetch error:', err))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">Cargando gráfico...</div>
      </div>
    );
  }
  if (!data || data.series.length === 0) {
    return null;
  }

  const series = data.series;
  const maxSent = Math.max(1, ...series.map(d => d.manual + d.auto));
  const maxReply = Math.max(1, ...series.map(d => d.reply));
  // Single Y axis based on sends; replies just overlay as a thin marker
  const yMax = Math.max(maxSent, maxReply);

  const totalSent = data.totals.manual + data.totals.auto;
  const hover = hoverIdx != null ? series[hoverIdx] : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-gray-900">📈 WhatsApps por día</h3>
          <p className="text-xs text-gray-500 mt-0.5">Últimos {days} días · Lima</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-purple-500"></span>
            <span className="text-gray-700">🤖 Auto <strong>{data.totals.auto}</strong></span>
          </span>
          {(data.senders || []).map((sd, i) => (
            <span key={sd.name} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded-sm ${colorFor(sd.name, i)}`}></span>
              <span className="text-gray-700">{iconFor(sd.name)} {sd.name} <strong>{sd.count}</strong></span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500"></span>
            <span className="text-gray-700">💬 Respuestas <strong>{data.totals.reply}</strong></span>
          </span>
        </div>
      </div>

      {/* Rango selector */}
      <div className="flex gap-1 mb-2">
        {RANGE_OPTIONS.map(opt => (
          <button
            key={opt.days}
            onClick={() => setDays(opt.days)}
            className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
              days === opt.days
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tooltip */}
      <div className="h-5 text-xs text-gray-600 mb-1">
        {hover && (
          <span>
            <strong>{formatDayLabel(hover.date)}</strong>
            <span className="text-purple-700 ml-2">🤖 {hover.auto}</span>
            {Object.entries(hover.manualBy || {}).map(([name, n]) => (
              <span key={name} className="text-gray-700 ml-2">{iconFor(name)} {name} {n}</span>
            ))}
            <span className="text-emerald-700 ml-2">💬 {hover.reply}</span>
            <span className="text-gray-500 ml-2">· Total enviado: {hover.auto + hover.manual}</span>
          </span>
        )}
      </div>

      {/* Bars — fixed pixel height so child px calculations land correctly */}
      {(() => {
        const CHART_H = 160; // h-40
        // With many days, tighten the gap so bars don't get hair-thin
        const gapClass = series.length > 40 ? 'gap-px' : series.length > 20 ? 'gap-0.5' : 'gap-1';
        return (
          <div className={`flex ${gapClass} border-b border-gray-200`} style={{ height: `${CHART_H}px` }}>
            {series.map((d, i) => {
              const sentTotal = d.manual + d.auto;
              const totalPx = Math.round((sentTotal / yMax) * CHART_H);
              const autoPx = sentTotal > 0 ? Math.round((d.auto / sentTotal) * totalPx) : 0;
              // Un segmento por vendedor (mismo orden que la leyenda).
              const senderSegs = (data.senders || [])
                .map((sd, si) => {
                  const c = d.manualBy?.[sd.name] || 0;
                  return { px: sentTotal > 0 ? Math.round((c / sentTotal) * totalPx) : 0, cls: colorFor(sd.name, si) };
                })
                .filter((s) => s.px > 0);
              const replyPx = Math.round((d.reply / yMax) * CHART_H);
              const weekend = isWeekend(d.date);
              return (
                <div
                  key={d.date}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  className={`flex-1 min-w-0 relative cursor-pointer group ${weekend ? 'opacity-60' : ''}`}
                  title={`${formatDayLabel(d.date)} — 🤖${d.auto} ✋${d.manual} 💬${d.reply}`}
                  style={{ height: `${CHART_H}px` }}
                >
                  {/* Hover halo */}
                  <div className="absolute inset-0 group-hover:bg-gray-50 pointer-events-none" />
                  {/* Stacked sends bar — anchored to bottom, absolute */}
                  {totalPx > 0 && (
                    <div
                      className="absolute left-0 right-0 bottom-0 flex flex-col-reverse rounded-t-sm overflow-hidden"
                      style={{ height: `${totalPx}px` }}
                    >
                      {autoPx > 0 && (
                        <div
                          className="bg-purple-500 transition-colors"
                          style={{ height: `${autoPx}px` }}
                        />
                      )}
                      {senderSegs.map((seg, si) => (
                        <div
                          key={si}
                          className={`${seg.cls} transition-colors`}
                          style={{ height: `${seg.px}px` }}
                        />
                      ))}
                    </div>
                  )}
                  {/* Reply marker — thin emerald line at the reply count height */}
                  {d.reply > 0 && (
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-emerald-500 pointer-events-none"
                      style={{ bottom: `${replyPx}px` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* X labels — show every Nth label to avoid overlap when range is wide */}
      {(() => {
        const labelStep = series.length > 60 ? 10 : series.length > 30 ? 5 : series.length > 16 ? 3 : 1;
        const gapClass = series.length > 40 ? 'gap-px' : series.length > 20 ? 'gap-0.5' : 'gap-1';
        return (
          <div className={`flex items-start ${gapClass} mt-1 text-[9px] text-gray-400`}>
            {series.map((d, i) => (
              <div key={d.date} className="flex-1 text-center min-w-0 truncate">
                {i % labelStep === 0 || i === series.length - 1 ? formatDayLabel(d.date) : ''}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Footer note */}
      <p className="text-[10px] text-gray-400 mt-2">
        Promedio enviados/día: <strong>{(totalSent / days).toFixed(1)}</strong>
        {' '}· Días sin enviar: <strong>{series.filter(d => d.auto + d.manual === 0).length}</strong>
        {' '}· Fines de semana atenuados (cron salta sábado/domingo)
      </p>
    </div>
  );
}
