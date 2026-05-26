'use client';

import { useEffect, useState } from 'react';

interface DayPoint {
  date: string;       // YYYY-MM-DD (Lima local)
  manual: number;     // sent by Alejandro
  auto: number;       // sent by the cron
  reply: number;      // inbound replies
}

interface DailyResponse {
  days: number;
  series: DayPoint[];
  totals: { manual: number; auto: number; reply: number };
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

export default function WhatsAppDailyChart({ days = 14 }: { days?: number }) {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
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
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-orange-500"></span>
            <span className="text-gray-700">✋ Alejandro <strong>{data.totals.manual}</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500"></span>
            <span className="text-gray-700">💬 Respuestas <strong>{data.totals.reply}</strong></span>
          </span>
        </div>
      </div>

      {/* Tooltip */}
      <div className="h-5 text-xs text-gray-600 mb-1">
        {hover && (
          <span>
            <strong>{formatDayLabel(hover.date)}</strong>
            <span className="text-purple-700 ml-2">🤖 {hover.auto}</span>
            <span className="text-orange-700 ml-2">✋ {hover.manual}</span>
            <span className="text-emerald-700 ml-2">💬 {hover.reply}</span>
            <span className="text-gray-500 ml-2">· Total enviado: {hover.auto + hover.manual}</span>
          </span>
        )}
      </div>

      {/* Bars */}
      <div className="flex items-end gap-1 h-40 border-b border-gray-200">
        {series.map((d, i) => {
          const sentTotal = d.manual + d.auto;
          const heightPct = (sentTotal / yMax) * 100;
          const autoPct = sentTotal > 0 ? (d.auto / sentTotal) * heightPct : 0;
          const manualPct = sentTotal > 0 ? (d.manual / sentTotal) * heightPct : 0;
          const replyHeightPct = (d.reply / yMax) * 100;
          const weekend = isWeekend(d.date);
          return (
            <div
              key={d.date}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className={`flex-1 flex flex-col-reverse min-w-0 relative cursor-pointer group ${
                weekend ? 'opacity-60' : ''
              }`}
              title={`${formatDayLabel(d.date)} — 🤖${d.auto} ✋${d.manual} 💬${d.reply}`}
            >
              {/* Stacked sends bar */}
              <div className="w-full flex flex-col-reverse" style={{ height: `${heightPct}%` }}>
                <div
                  className="w-full bg-purple-500 group-hover:bg-purple-600 transition-colors rounded-b-sm"
                  style={{ height: `${(autoPct / Math.max(heightPct, 0.01)) * 100}%` }}
                />
                <div
                  className="w-full bg-orange-500 group-hover:bg-orange-600 transition-colors"
                  style={{ height: `${(manualPct / Math.max(heightPct, 0.01)) * 100}%` }}
                />
              </div>
              {/* Reply marker — thin emerald line on top */}
              {d.reply > 0 && (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-emerald-500 pointer-events-none"
                  style={{ bottom: `${replyHeightPct}%` }}
                />
              )}
              {/* Hover halo */}
              <div className="absolute inset-0 group-hover:bg-gray-50 pointer-events-none -z-10" />
            </div>
          );
        })}
      </div>

      {/* X labels */}
      <div className="flex items-start gap-1 mt-1 text-[9px] text-gray-400">
        {series.map((d) => (
          <div key={d.date} className="flex-1 text-center min-w-0 truncate">
            {formatDayLabel(d.date)}
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-[10px] text-gray-400 mt-2">
        Promedio enviados/día: <strong>{(totalSent / days).toFixed(1)}</strong>
        {' '}· Días sin enviar: <strong>{series.filter(d => d.auto + d.manual === 0).length}</strong>
        {' '}· Fines de semana atenuados (cron salta sábado/domingo)
      </p>
    </div>
  );
}
