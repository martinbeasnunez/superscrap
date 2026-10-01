'use client';

import { useEffect, useState } from 'react';

// Fila del marcador mensual (coincide con la tabla reactivation_monthly).
interface MonthRow {
  id: string;
  month: string;
  label: string;
  clients: number | null;
  control: number | null;
  contacted: number | null;
  contacted_wa: number | null;
  contacted_call: number | null;
  second_touch: number | null;
  untouched: number | null;
  recovered_real: number | null;
  recovered_marked: number | null;
  revenue_recovered: number | null;
  control_returned: number | null;
  verdict: string | null;
  notes: string | null;
}

// Una métrica = una fila de la tabla; cada mes es una columna.
type Metric = {
  key: keyof MonthRow;
  label: string;
  fmt?: (v: number) => string;
  section?: boolean; // encabezado de grupo
};

const soles = (v: number) => `S/ ${v.toLocaleString('es-PE')}`;

const METRICS: Metric[] = [
  { key: 'clients', label: 'ACCIONES', section: true },
  { key: 'clients', label: 'Clientes en lista' },
  { key: 'control', label: 'Grupo control (sin tocar)' },
  { key: 'contacted', label: 'Contactados' },
  { key: 'contacted_wa', label: '→ por WhatsApp' },
  { key: 'contacted_call', label: '→ por llamada' },
  { key: 'second_touch', label: '2da vuelta (insistencia)' },
  { key: 'untouched', label: 'Quedaron sin tocar' },
  { key: 'recovered_real', label: 'RESULTADOS', section: true },
  { key: 'recovered_real', label: 'Recuperados reales (admin)' },
  { key: 'recovered_marked', label: 'Marcados en ORBIT' },
  { key: 'revenue_recovered', label: 'Plata recuperada', fmt: soles },
  { key: 'control_returned', label: 'Control que volvió solo' },
];

export default function MonthlySummary() {
  const [months, setMonths] = useState<MonthRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || months) return;
    fetch('/api/reactivation/monthly')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setMonths(d.months ?? []);
      })
      .catch(() => setError('No se pudo cargar.'));
  }, [open, months]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">📅 Resumen por mes</span>
        <span className="text-xs text-gray-400">{open ? 'ocultar ▲' : 'ver ▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 overflow-x-auto">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!error && !months && <p className="text-sm text-gray-400">Cargando…</p>}
          {months && months.length === 0 && (
            <p className="text-sm text-gray-400">Aún no hay meses cerrados.</p>
          )}
          {months && months.length > 0 && (
            <>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 w-56">Métrica</th>
                    {months.map((m) => (
                      <th key={m.id} className="text-right py-2 px-3 font-semibold text-gray-900 whitespace-nowrap">
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((metric, i) =>
                    metric.section ? (
                      <tr key={`s-${i}`} className="bg-gray-50">
                        <td colSpan={months.length + 1} className="py-1.5 px-2 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                          {metric.label}
                        </td>
                      </tr>
                    ) : (
                      <tr key={`m-${i}`} className="border-b border-gray-50">
                        <td className="py-1.5 pr-4 text-gray-600">{metric.label}</td>
                        {months.map((m) => {
                          const raw = m[metric.key];
                          const v = typeof raw === 'number' ? raw : null;
                          return (
                            <td key={m.id} className="py-1.5 px-3 text-right tabular-nums text-gray-800">
                              {v == null ? '—' : metric.fmt ? metric.fmt(v) : v.toLocaleString('es-PE')}
                            </td>
                          );
                        })}
                      </tr>
                    )
                  )}
                  {/* Veredicto como fila de texto */}
                  <tr className="bg-gray-50">
                    <td colSpan={months.length + 1} className="py-1.5 px-2 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                      Lectura
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-4 text-gray-600 align-top">¿La campaña sumó de más?</td>
                    {months.map((m) => (
                      <td key={m.id} className="py-1.5 px-3 text-right text-gray-700 align-top max-w-xs">
                        {m.verdict || '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <p className="text-[11px] text-gray-400 mt-2">
                Recuperados y plata = verificados contra pedidos reales en el admin, no lo que marcó el equipo.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
