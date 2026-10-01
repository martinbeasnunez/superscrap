'use client';

import { useEffect, useState } from 'react';

// Encabezado que separa claro el mes CERRADO (con sus resultados) del mes
// ACTIVO (lo que viene). Responde a "¿cómo le fue a septiembre?" vs "¿qué hago
// en octubre?" de un vistazo.

interface MonthRow {
  month: string;
  label: string;
  recovered_real: number | null;
  revenue_recovered: number | null;
  control_returned: number | null;
  control: number | null;
  contacted: number | null;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];

export default function MonthHeader({
  reconnectToday,
  fresh,
  onImport,
  onShowFirstBuy,
  onShowReconnect,
}: {
  reconnectToday: number;
  fresh: number;
  onImport: () => void;
  onShowFirstBuy: () => void;
  onShowReconnect: () => void;
}) {
  const [closed, setClosed] = useState<MonthRow | null>(null);
  const [firstBuy, setFirstBuy] = useState<number | null>(null);

  // Mes activo = el de hoy (local Lima).
  const now = new Date();
  const activeLabel = `${MESES[now.getMonth()].replace(/^\w/, (c) => c.toUpperCase())} ${now.getFullYear()}`;
  const activeYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    fetch('/api/reactivation/monthly')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.months) return;
        // El mes cerrado = el más reciente que NO es el mes activo.
        const prev = (d.months as MonthRow[]).find((m) => m.month.slice(0, 7) !== activeYm);
        setClosed(prev ?? null);
      })
      .catch(() => {});
    // "Compraron 1 vez" (primera recompra): su turno es este mes.
    fetch('/api/reactivation?list_type=primera_recompra')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.clients && setFirstBuy(d.clients.length))
      .catch(() => {});
  }, [activeYm]);

  const soles = (v: number | null) => (v == null ? '—' : `S/ ${v.toLocaleString('es-PE')}`);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      {/* Mes CERRADO — resultados */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">{closed ? closed.label : 'Mes anterior'}</span>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">✓ Cerrado</span>
        </div>
        {closed ? (
          <>
            <div className="mt-2 flex items-end gap-3">
              <div>
                <p className="text-2xl font-bold text-emerald-600">{closed.recovered_real ?? '—'}</p>
                <p className="text-[11px] text-gray-500">clientes recuperados</p>
              </div>
              <div className="pb-0.5">
                <p className="text-lg font-bold text-gray-800">{soles(closed.revenue_recovered)}</p>
                <p className="text-[11px] text-gray-500">recuperado (verificado)</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Control (sin tocar) volvió {closed.control_returned ?? 0} de {closed.control ?? 0}. El detalle está abajo en <b>Resumen por mes</b>.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400 mt-2">Sin mes cerrado todavía.</p>
        )}
      </div>

      {/* Mes ACTIVO — lo que viene */}
      <div className="rounded-xl border border-[#0890F1]/30 bg-[#0890F1]/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-800">{activeLabel}</span>
          <span className="text-[11px] font-semibold text-white bg-[#0890F1] rounded-full px-2 py-0.5">● En curso</span>
        </div>
        <p className="text-xs font-semibold text-gray-700 mt-2">Esto es lo que toca:</p>
        <ol className="mt-1.5 space-y-1.5">
          {firstBuy != null && firstBuy > 0 && (
            <li>
              <button onClick={onShowFirstBuy} className="text-left text-xs text-gray-700 hover:text-[#0890F1] w-full">
                <b>1.</b> 🌱 Los <b>{firstBuy}</b> que compraron 1 vez — su turno es ahora. <span className="text-[#0890F1]">empezar aquí →</span>
              </button>
            </li>
          )}
          {reconnectToday > 0 && (
            <li>
              <button onClick={onShowReconnect} className="text-left text-xs text-gray-700 hover:text-[#0890F1] w-full">
                <b>2.</b> 🔄 Los que dijeron &quot;próximo mes&quot; y ya toca hoy: <b>{reconnectToday}</b>. <span className="text-[#0890F1]">verlos →</span>
              </button>
            </li>
          )}
          <li className="text-xs text-gray-700">
            <b>{firstBuy ? '3' : reconnectToday ? '2' : '1'}.</b> ⬆ Sube la lista nueva del mes y ataca los <b>frescos</b> primero.
          </li>
        </ol>
        <button
          onClick={onImport}
          className="mt-3 w-full text-sm font-semibold px-3 py-2 rounded-lg bg-[#0890F1] text-white hover:bg-[#0770C5]"
        >
          ⬆ Cargar lista de {MESES[now.getMonth()]}
        </button>
      </div>
    </div>
  );
}
