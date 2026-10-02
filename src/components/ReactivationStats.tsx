'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  total: number;
  contacted: { count: number; worked: number; reactivated: number; notReactivated: number; rate: number };
  control: { count: number; reactivated: number; rate: number };
  uplift: number;
  pending: number;
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

// Home card: reactivated vs not + the real KPI (Contacted vs Control).
export default function ReactivationStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/reactivation/stats')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setStats(d))
      .catch(() => setFailed(true));
  }, []);

  // No table created yet or no data: don't clutter the Home.
  if (failed || (stats && stats.total === 0)) return null;
  if (!stats) {
    return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-40 animate-pulse" />;
  }

  const upliftPositive = stats.uplift >= 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">♻️ B2B Reactivation</h3>
          <p className="text-xs text-gray-500">{stats.total} clients · {stats.pending} pending</p>
        </div>
        <Link href="/seguimiento" className="text-xs font-medium text-[#0890F1] hover:underline">Open →</Link>
      </div>

      {/* Real KPI: uplift Contacted vs Control */}
      <div className={`rounded-xl p-4 mb-4 border ${upliftPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
        <p className="text-xs font-medium text-gray-500">Contacted − Control differential (real KPI)</p>
        <p className={`text-3xl font-bold ${upliftPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
          {upliftPositive ? '+' : ''}{pct(stats.uplift)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Contacted {pct(stats.contacted.rate)} vs Control {pct(stats.control.rate)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xl font-bold text-emerald-600">{stats.contacted.reactivated}</p>
          <p className="text-xs text-gray-500">Reactivated</p>
        </div>
        <div>
          <p className="text-xl font-bold text-gray-400">{stats.contacted.notReactivated}</p>
          <p className="text-xs text-gray-500">Not reactivated</p>
        </div>
        <div>
          <p className="text-xl font-bold text-rose-600">{stats.control.count}</p>
          <p className="text-xs text-gray-500">In control</p>
        </div>
      </div>
    </div>
  );
}
