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
  fmtShort,
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
    // "Aparcados": sin tocar y marcados para octubre / muertos → no cuentan como
    // pendiente de HOY (si no, Joaquín ve "faltan 42" cuando 40 son de octubre).
    const parked = (c: ReactClient) => !touch1Done(c) && (c.outcome === 'octubre' || c.outcome === 'muerto');
    const contactable = all.filter((c) => !c.is_control && c.list_type !== 'excluir' && !parked(c));
    const perWave = (n: 1 | 2 | 3) => {
      const ws = contactable.filter((c) => waveFor(c) === n);
      return { total: ws.length, done: ws.filter(touch1Done).length };
    };
    // Desglose por PERSONA, acumulado de lo que ya toca hasta esta semana
    // (no por ola aislada) — así el arrastre de Fer se ve y se actualiza solo.
    const curN = currentWave(today).n;
    const done = (arr: typeof contactable) => arr.filter(touch1Done).length;
    const due = contactable.filter((c) => (waveFor(c) ?? 99) <= curN); // ya les toca
    const tierA = contactable.filter((c) => c.tier === 'A'); // Fer: todas las grandes (ola 1)
    const bc = due.filter((c) => c.tier !== 'A');            // Joaquín: medianos/chicos que ya tocan
    const dueTotal = tierA.length + bc.length;
    const dueDone = done(tierA) + done(bc);
    return {
      waves: { 1: perWave(1), 2: perWave(2), 3: perWave(3) },
      overdue: contactable.filter((c) => overdue(c, today) !== null).length,
      totalDone: contactable.filter(touch1Done).length,
      total: contactable.length,
      dueTotal,
      dueDone,
      curSplit: {
        bc: { done: done(bc), total: bc.length },
        tierA: { done: done(tierA), total: tierA.length },
      },
    };
  }, [all, today]);

  const cur = currentWave(today);
  const status = waveStatus(cur, today);

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

  const totalSemanas = CAMPAIGN.waves.length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-4">
      {/* Dónde estamos, en una línea */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
        <p className="font-bold text-gray-900">📅 Semana {cur.n} de {totalSemanas}</p>
        <p className="text-sm font-semibold text-gray-600">{countdown}{cur.n <= 3 ? ` · cierra ${fmtShort(cur.deadline ?? cur.end)}` : ''}</p>
      </div>

      {/* Cada persona, una barra simple */}
      {stats && (
        <div className="space-y-2.5">
          <PersonRow icon="💬" label="Joaquín · mensajes" done={stats.curSplit.bc.done} total={stats.curSplit.bc.total} />
          <PersonRow icon="📞" label="Fernanda · llamadas a grandes" done={stats.curSplit.tierA.done} total={stats.curSplit.tierA.total} />
        </div>
      )}

      {/* Lo atrasado, en una línea */}
      {stats && stats.overdue > 0 && (
        <p className="mt-3 text-sm font-semibold text-rose-600">
          🔴 {stats.overdue} quedaron de antes — empieza por esos.
        </p>
      )}
    </div>
  );
}

// Una fila por persona: nombre, cuántos van, y una barra.
function PersonRow({ icon, label, done, total }: { icon: string; label: string; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const falta = total - done;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1 text-sm">
        <span className="font-semibold text-gray-800">{icon} {label}</span>
        <span className="text-gray-500">
          <b className="text-gray-900">{done}</b> de {total}
          {falta > 0 ? <span className="text-[#0890F1] font-medium"> · faltan {falta}</span> : total > 0 ? <span className="text-emerald-600 font-medium"> · ✅ listo</span> : null}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full bg-[#0890F1] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
