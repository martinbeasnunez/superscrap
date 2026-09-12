'use client';

import { useEffect, useState, useMemo } from 'react';
import type { ReactClient } from '@/lib/reactivation';
import {
  CAMPAIGN,
  todayISO,
  currentWave,
  waveStatus,
  waveFor,
  touch1Done,
  overdue,
  daysBetween,
  nextCheckpoint,
  fmtShort,
  WAVE_STATUS_LABEL,
} from '@/lib/reactivation-campaign';

// Banner/timeline de la campaña en el Home de /reactivacion.
// Fase actual + deadline + cuenta regresiva + barra de progreso (toques hechos /
// total de la fase) + próximo checkpoint. Todo derivado de la data real.
export default function CampaignTimeline() {
  const [all, setAll] = useState<ReactClient[] | null>(null);
  const today = todayISO();

  useEffect(() => {
    // Trae TODAS las listas (reactivación + primera recompra + excluir) para
    // que el progreso de campaña sea exacto sin importar la sub-lista visible.
    fetch('/api/reactivation')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAll(d.clients ?? []))
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    if (!all) return null;
    const contactable = all.filter((c) => !c.is_control && c.list_type !== 'excluir');
    const perWave = (n: 1 | 2 | 3) => {
      const ws = contactable.filter((c) => waveFor(c) === n);
      return { total: ws.length, done: ws.filter(touch1Done).length };
    };
    // Desglose de la ola actual por rol: Tier A (llamadas · Fer) vs B/C (WhatsApp · Joaquín)
    const curN = currentWave(today).n;
    const inCur = contactable.filter((c) => waveFor(c) === curN);
    const done = (arr: typeof inCur) => arr.filter(touch1Done).length;
    const tierA = inCur.filter((c) => c.tier === 'A');
    const bc = inCur.filter((c) => c.tier !== 'A');
    return {
      waves: { 1: perWave(1), 2: perWave(2), 3: perWave(3) },
      overdue: contactable.filter((c) => overdue(c, today) !== null).length,
      totalDone: contactable.filter(touch1Done).length,
      total: contactable.length,
      curSplit: {
        bc: { done: done(bc), total: bc.length },
        tierA: { done: done(tierA), total: tierA.length },
      },
    };
  }, [all, today]);

  const cur = currentWave(today);
  const status = waveStatus(cur, today);
  const chk = nextCheckpoint(today);

  // Cuenta regresiva según el estado de la ola actual.
  const countdown = (() => {
    if (cur.n === 4 && today > cur.end) return 'Campaña cerrada';
    if (status === 'proxima') {
      const d = daysBetween(today, cur.start);
      return d <= 0 ? 'Arranca hoy' : `Arranca en ${d} día${d === 1 ? '' : 's'}`;
    }
    if (status === 'en_curso') {
      const d = daysBetween(today, cur.deadline ?? cur.end);
      return d <= 0 ? 'Cierra hoy' : `Cierra en ${d} día${d === 1 ? '' : 's'}`;
    }
    return 'Cerrada';
  })();

  const curProgress = cur.n <= 3 && stats ? stats.waves[cur.n as 1 | 2 | 3] : null;
  const pct = curProgress && curProgress.total > 0 ? Math.round((curProgress.done / curProgress.total) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div>
          <p className="font-bold text-gray-900">📅 {CAMPAIGN.name}</p>
          <p className="text-xs text-gray-500">{fmtShort(CAMPAIGN.start)} – {fmtShort(CAMPAIGN.end)} · envíos mar–jue, 8–10am / 12–2pm</p>
        </div>
        {stats && (
          <span className="text-xs text-gray-500">
{stats.totalDone}/{stats.total} ya contactados
            {stats.overdue > 0 && <span className="text-rose-600 font-semibold"> · {stats.overdue} vencidos</span>}
          </span>
        )}
      </div>

      {/* Olas como segmentos */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {CAMPAIGN.waves.map((w) => {
          const st = waveStatus(w, today);
          const isCur = w.n === cur.n;
          const wp = w.n <= 3 && stats ? stats.waves[w.n as 1 | 2 | 3] : null;
          return (
            <div
              key={w.n}
              className={`rounded-lg px-2 py-1.5 border text-center ${
                isCur ? 'border-[#0890F1] bg-[#0890F1]/5' : 'border-gray-200 bg-gray-50'
              }`}
              title={w.focus}
            >
              <p className={`text-[11px] font-semibold ${isCur ? 'text-[#0890F1]' : 'text-gray-600'}`}>{w.name}</p>
              <p className="text-[10px] text-gray-400">{fmtShort(w.start)}–{fmtShort(w.end)}</p>
              <p className={`text-[10px] mt-0.5 ${st === 'en_curso' ? 'text-emerald-600' : st === 'proxima' ? 'text-gray-400' : 'text-gray-400'}`}>
                {WAVE_STATUS_LABEL[st]}{wp ? ` · ${wp.done}/${wp.total}` : ''}
              </p>
            </div>
          );
        })}
      </div>

      {/* Fase actual: foco + countdown + progreso */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
          <span className="text-sm font-semibold text-gray-900">
            {cur.name}
            <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
              status === 'en_curso' ? 'bg-emerald-100 text-emerald-700' : status === 'proxima' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
            }`}>{WAVE_STATUS_LABEL[status]}</span>
          </span>
          <span className="text-xs font-semibold text-gray-700">⏳ {countdown} · fecha límite {fmtShort(cur.deadline ?? cur.end)}</span>
        </div>
        <p className="text-xs text-gray-500 mb-2">{cur.focus}</p>
        {curProgress && (
          <div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-[#0890F1] rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">{curProgress.done}/{curProgress.total} ya contactados · {pct}%</p>
            {curProgress.total - curProgress.done > 0 && (
              <p className="text-[11px] font-semibold text-[#0890F1] mt-0.5">⚡ Faltan {curProgress.total - curProgress.done} por tocar esta semana — ¡a avanzar!</p>
            )}
            {stats?.curSplit && (stats.curSplit.tierA.total > 0 || stats.curSplit.bc.total > 0) && (
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px]">
                <span className="text-gray-600">
                  💬 Joaquín (mensajes a medianos/chicos): <b className={stats.curSplit.bc.done >= stats.curSplit.bc.total && stats.curSplit.bc.total > 0 ? 'text-emerald-600' : ''}>{stats.curSplit.bc.done}/{stats.curSplit.bc.total}</b>
                </span>
                <span className="text-gray-600">
                  📞 Fernanda (llamadas a cuentas grandes): <b className={stats.curSplit.tierA.done >= stats.curSplit.tierA.total && stats.curSplit.tierA.total > 0 ? 'text-emerald-600' : 'text-amber-600'}>{stats.curSplit.tierA.done}/{stats.curSplit.tierA.total}</b>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lo que se arrastra: "vienes debiendo" — a avanzar primero */}
      {stats && stats.overdue > 0 && (
        <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm">
          <b className="text-rose-700">🔴 Vienes debiendo {stats.overdue}</b>
          <span className="text-rose-600"> — se les pasó la fecha y siguen sin contactar. Son lo atrasado de la semana pasada: <b>arranca por estos</b>. ¡A avanzar!</span>
        </div>
      )}

      {/* Checkpoint */}
      {chk && (
        <p className="text-xs text-gray-500 mt-2">
          🔎 Próximo checkpoint: <b>vie {fmtShort(chk)}</b> — es señal temprana; el lift casi no se ve al inicio (tardan días en re-pedir) y madura con los días.
        </p>
      )}
    </div>
  );
}
