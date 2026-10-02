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

// Campaign banner/timeline on the /reactivacion Home.
// Current phase + deadline + countdown + progress bar (touches done /
// phase total) + next checkpoint. All derived from real data.
export default function CampaignTimeline() {
  const [all, setAll] = useState<ReactClient[] | null>(null);
  const today = todayISO();

  useEffect(() => {
    // Fetch ALL lists (reactivation + first repurchase + exclude) so that
    // campaign progress is exact regardless of the visible sub-list.
    fetch('/api/reactivation')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAll(d.clients ?? []))
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    if (!all) return null;
    // "Parked": untouched and either marked dead, or scheduled for later
    // (future reconnect date, e.g. the "first-timers" going to October). They
    // don't count as pending TODAY (otherwise Joaquín sees "42 left").
    const parked = (c: ReactClient) =>
      !touch1Done(c) && (c.outcome === 'muerto' || c.outcome === 'octubre' || (!!c.recontact_date && c.recontact_date > today));
    const contactable = all.filter((c) => !c.is_control && c.list_type !== 'excluir' && !parked(c));
    const perWave = (n: 1 | 2 | 3) => {
      const ws = contactable.filter((c) => waveFor(c) === n);
      return { total: ws.length, done: ws.filter(touch1Done).length };
    };
    // Breakdown by PERSON, accumulated for what's due up to this week
    // (not per isolated wave) — so Fer's backlog shows and updates on its own.
    const curN = currentWave(today).n;
    const done = (arr: typeof contactable) => arr.filter(touch1Done).length;
    const due = contactable.filter((c) => (waveFor(c) ?? 99) <= curN); // already due
    const tierA = contactable.filter((c) => c.tier === 'A'); // Fer: all big accounts (wave 1)
    const bc = due.filter((c) => c.tier !== 'A');            // Joaquín: medium/small accounts already due
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

  // Countdown based on the current wave's status.
  const countdown = (() => {
    if (cur.n === 4 && today > cur.end) return 'Campaign closed';
    if (status === 'proxima') {
      const d = daysBetween(today, cur.start);
      return d <= 0 ? 'Starts today' : `Starts in ${d} day${d === 1 ? '' : 's'}`;
    }
    if (status === 'en_curso') {
      const d = daysBetween(today, cur.deadline ?? cur.end);
      return d <= 0 ? 'Closes today' : `Closes in ${d} day${d === 1 ? '' : 's'}`;
    }
    return 'Closed';
  })();

  const totalSemanas = CAMPAIGN.waves.length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-4">
      {/* Where we are, in one line */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
        <p className="font-bold text-gray-900">📅 Week {cur.n} of {totalSemanas}</p>
        <p className="text-sm font-semibold text-gray-600">{countdown}{cur.n <= 3 ? ` · closes ${fmtShort(cur.deadline ?? cur.end)}` : ''}</p>
      </div>

      {/* Each person, one simple bar */}
      {stats && (
        <div className="space-y-2.5">
          <PersonRow icon="💬" label="Joaquín · messages" done={stats.curSplit.bc.done} total={stats.curSplit.bc.total} />
          <PersonRow icon="📞" label="Fernanda · calls to big accounts" done={stats.curSplit.tierA.done} total={stats.curSplit.tierA.total} />
        </div>
      )}

      {/* What's overdue, in one line */}
      {stats && stats.overdue > 0 && (
        <p className="mt-3 text-sm font-semibold text-rose-600">
          🔴 {stats.overdue} left over from before — start with those.
        </p>
      )}
    </div>
  );
}

// One row per person: name, how many done, and a bar.
function PersonRow({ icon, label, done, total }: { icon: string; label: string; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const falta = total - done;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1 text-sm">
        <span className="font-semibold text-gray-800">{icon} {label}</span>
        <span className="text-gray-500">
          <b className="text-gray-900">{done}</b> of {total}
          {falta > 0 ? <span className="text-[#0890F1] font-medium"> · {falta} left</span> : total > 0 ? <span className="text-emerald-600 font-medium"> · ✅ done</span> : null}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full bg-[#0890F1] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
