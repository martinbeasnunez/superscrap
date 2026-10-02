'use client';

import { useEffect, useState } from 'react';

// Monthly scoreboard row (matches the reactivation_monthly table).
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

// One metric = one table row; each month is a column.
type Metric = {
  key: keyof MonthRow;
  label: string;
  fmt?: (v: number) => string;
  section?: boolean; // group header
};

const soles = (v: number) => `S/ ${v.toLocaleString('es-PE')}`;

const METRICS: Metric[] = [
  { key: 'clients', label: 'ACTIONS', section: true },
  { key: 'clients', label: 'Clients in list' },
  { key: 'control', label: 'Control group (untouched)' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'contacted_wa', label: '→ by WhatsApp' },
  { key: 'contacted_call', label: '→ by call' },
  { key: 'second_touch', label: '2nd round (follow-up)' },
  { key: 'untouched', label: 'Left untouched' },
  { key: 'recovered_real', label: 'RESULTS', section: true },
  { key: 'recovered_real', label: 'Real recoveries (admin)' },
  { key: 'recovered_marked', label: 'Marked in ORBIT' },
  { key: 'revenue_recovered', label: 'Revenue recovered', fmt: soles },
  { key: 'control_returned', label: 'Control that returned on its own' },
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
      .catch(() => setError('Could not load.'));
  }, [open, months]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">📅 Monthly summary</span>
        <span className="text-xs text-gray-400">{open ? 'hide ▲' : 'show ▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 overflow-x-auto">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!error && !months && <p className="text-sm text-gray-400">Loading…</p>}
          {months && months.length === 0 && (
            <p className="text-sm text-gray-400">No closed months yet.</p>
          )}
          {months && months.length > 0 && (
            <>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 w-56">Metric</th>
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
                  {/* Verdict as a text row */}
                  <tr className="bg-gray-50">
                    <td colSpan={months.length + 1} className="py-1.5 px-2 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                      Takeaway
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-4 text-gray-600 align-top">Did the campaign add extra?</td>
                    {months.map((m) => (
                      <td key={m.id} className="py-1.5 px-3 text-right text-gray-700 align-top max-w-xs">
                        {m.verdict || '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <p className="text-[11px] text-gray-400 mt-2">
                Recoveries and revenue = verified against real orders in the admin, not what the team marked.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
