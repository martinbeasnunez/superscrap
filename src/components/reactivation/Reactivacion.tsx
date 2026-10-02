'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  REACT_STATUS_LABEL,
  REACT_STATUS_ORDER,
  TIER_LABEL,
  OUTCOME_META,
  type ReactOutcome,
  type ReactClient,
  type ReactStatus,
  type ReactListType,
} from '@/lib/reactivation';
import DetailDrawer from './DetailDrawer';
import ImportModal from './ImportModal';
import CampaignTimeline from './CampaignTimeline';
import MonthlySummary from './MonthlySummary';
import MonthHeader from './MonthHeader';
import {
  waveFor,
  targetTouch1,
  overdue,
  currentWave,
  todayISO,
  fmtShort,
  daysBetween,
  CAMPAIGN,
} from '@/lib/reactivation-campaign';

type ViewMode = 'tabla' | 'tablero';
type SortDir = 'asc' | 'desc';
type SortKey = 'priority' | 'days';

// Priority rank: High first. (unknown goes last)
const PRIORITY_RANK: Record<string, number> = { alta: 0, media: 1, fria: 2 };
const prioRank = (p: string | null) => (p && p in PRIORITY_RANK ? PRIORITY_RANK[p] : 9);

const PRIORITY_LABEL: Record<string, string> = { alta: 'High', media: 'Medium', fria: 'Cold' };
const PRIORITY_STYLE: Record<string, string> = {
  alta: 'bg-red-50 text-red-700 border border-red-200',
  media: 'bg-amber-50 text-amber-700 border border-amber-200',
  fria: 'bg-slate-100 text-slate-600 border border-slate-200',
};
const TIER_STYLE: Record<string, string> = {
  A: 'bg-purple-100 text-purple-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-gray-100 text-gray-600',
};
const STATUS_STYLE: Record<ReactStatus, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  toque1: 'bg-blue-50 text-blue-700',
  respondio: 'bg-amber-50 text-amber-700',
  reservo: 'bg-emerald-100 text-emerald-700',
  no_reservo: 'bg-rose-50 text-rose-600',
};

const LIST_TABS: { key: ReactListType; label: string }[] = [
  { key: 'reactivacion', label: '♻️ Frequent clients' },
  { key: 'primera_recompra', label: '🌱 Bought once' },
  { key: 'excluir', label: '🚫 Do not contact' },
];

// Is a 2nd touch due? (1st touch done, no reply, +7 days, no 2nd touch)
function needsSecondTouch(c: ReactClient): boolean {
  if (!c.touch1_date || c.responded || c.touch2_date || c.is_control) return false;
  const days = Math.floor((Date.now() - new Date(c.touch1_date).getTime()) / 86400000);
  return days >= 7;
}

export default function Reactivacion() {
  const [listType, setListType] = useState<ReactListType>('reactivacion');
  const [clients, setClients] = useState<ReactClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('tabla');

  // filtros
  const [fTier, setFTier] = useState<string>('all');
  const [fPriority, setFPriority] = useState<string>('all');
  const [fOwner, setFOwner] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');
  const [fOutcome, setFOutcome] = useState<string>('all');
  // Default: High priority first (and within that, the most dormant on top).
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [selected, setSelected] = useState<ReactClient | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  // Joaquín's queue: Tier A pending verification (regardless of owner)
  const [verifyQueue, setVerifyQueue] = useState(false);
  // "Overdue" lens: what's owed from before (date passed and still not touched)
  const [overdueLens, setOverdueLens] = useState(false);
  // "2nd round" lens: messaged 7+ days ago with no reply → time to call
  const [secondTouchLens, setSecondTouchLens] = useState(false);
  // "Reconnect today" lens: those scheduled for today or earlier (the "next month" that has arrived)
  const [recontactLens, setRecontactLens] = useState(false);
  // "Fresh" lens: left recently (≤90d) and untouched → the most likely to return
  const [freshLens, setFreshLens] = useState(false);
  // Filter by summary card (Pending / Reactivated / Control)
  const [cardFilter, setCardFilter] = useState<'none' | 'pendientes' | 'reactivados' | 'control'>('none');
  // Turns off all lenses (the cards and lenses are mutually exclusive).
  const clearLenses = () => { setOverdueLens(false); setVerifyQueue(false); setSecondTouchLens(false); setRecontactLens(false); setFreshLens(false); };
  // Logged-in salesperson (for the personalized "👉 Now" line)
  const [meOwner, setMeOwner] = useState<string | null>(null);

  // Auto-detect the logged-in salesperson (Joaquín/Fernanda) → opens THEIR week only.
  // Martín/GM or any other name → sees everything (no filter).
  useEffect(() => {
    try {
      const raw = localStorage.getItem('orbit_user');
      if (!raw) return;
      const n = String(JSON.parse(raw)?.name || '')
        .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const mapped = n.includes('joaquin') ? 'Joaquín' : n.includes('fernanda') ? 'Fernanda' : null;
      if (mapped) { setFOwner(mapped); setMeOwner(mapped); }
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reactivation?list_type=${listType}`);
      const data = await res.json();
      setClients(data.clients ?? []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [listType]);

  useEffect(() => { load(); }, [load]);

  const owners = useMemo(
    () => [...new Set(clients.map((c) => c.owner).filter(Boolean))] as string[],
    [clients]
  );

  // Tier A that Joaquín hasn't verified yet (verification queue, across owners)
  const tierAPending = useMemo(
    () => clients.filter((c) => c.tier === 'A' && c.needs_verify && !c.verified_at && !c.is_control),
    [clients]
  );

  // Overdue: date passed and still not contacted (what's "owed")
  const overdueList = useMemo(
    () => clients.filter((c) => overdue(c, todayISO()) !== null),
    [clients]
  );

  // 2nd round: messaged 7+ days ago, no reply, no 2nd touch → call
  const secondTouchList = useMemo(
    () => clients.filter((c) => needsSecondTouch(c) && c.list_type !== 'excluir'),
    [clients]
  );

  // Reconnect today: scheduled for today or earlier (the "next month" that's now due)
  const recontactList = useMemo(
    () => clients.filter((c) => c.recontact_date && c.recontact_date <= todayISO() && !c.is_control && c.list_type !== 'excluir'),
    [clients]
  );

  // Fresh: left ≤90 days ago and still untouched → the most likely (hit these first)
  const freshList = useMemo(
    () => clients.filter((c) => !c.is_control && c.list_type === 'reactivacion' && !c.touch1_date && (c.days_inactive ?? 999) <= 90),
    [clients]
  );

  // "👉 Now": the highest-value play for the logged-in salesperson
  const nextStep = useMemo(() => {
    const curWaveN = currentWave(todayISO()).n;
    const activo = (c: ReactClient) => !c.is_control && c.list_type !== 'excluir';
    const goLens = () => { setOverdueLens(false); setVerifyQueue(false); setSecondTouchLens(false); setRecontactLens(false); setCardFilter('none'); };
    // Priority #1 for everyone: reconnect with those who asked you to call today
    const myRecontacts = recontactList.filter((c) => !meOwner || c.owner === meOwner);
    if (meOwner && myRecontacts.length > 0)
      return { text: `🔄 Today you need to reconnect with ${myRecontacts.length} — they asked you to call today.`, action: () => { goLens(); setRecontactLens(true); } };
    if (meOwner === 'Joaquín') {
      if (secondTouchList.length > 0)
        return { text: `📞 Today: ${secondTouchList.length} 2nd-round calls — those close better than another message.`, action: () => { goLens(); setSecondTouchLens(true); } };
      const msgs = clients.filter((c) => activo(c) && c.owner === 'Joaquín' && c.tier !== 'A' && !c.touch1_date && (waveFor(c) ?? 99) <= curWaveN);
      if (msgs.length > 0)
        return { text: `💬 You have ${msgs.length} messages left to send — start from the top.`, action: () => { goLens(); setFOwner('Joaquín'); } };
      return { text: '✅ All caught up. Keep contacting top to bottom.', action: undefined };
    }
    if (meOwner === 'Fernanda') {
      const grandes = clients.filter((c) => activo(c) && c.tier === 'A' && !c.touch1_date);
      if (grandes.length > 0)
        return { text: `📞 You have ${grandes.length} big accounts left to call — start from the top.`, action: () => { goLens(); setFOwner('Fernanda'); } };
      return { text: '✅ You\'ve called all your big accounts. Great 🙌', action: undefined };
    }
    return null; // GM or other: no personal line
  }, [meOwner, clients, secondTouchList, recontactList]);

  const filtered = useMemo(() => {
    // Verification queue: ignores the other filters, sorted by freshest
    if (verifyQueue) {
      return [...tierAPending].sort((a, b) => (a.days_inactive ?? Infinity) - (b.days_inactive ?? Infinity));
    }
    // Overdue: what's owed, sorted by freshest (best chance)
    if (overdueLens) {
      return [...overdueList].sort((a, b) => (a.days_inactive ?? Infinity) - (b.days_inactive ?? Infinity));
    }
    // 2nd round: those due for a call, freshest first
    if (secondTouchLens) {
      return [...secondTouchList].sort((a, b) => (a.days_inactive ?? Infinity) - (b.days_inactive ?? Infinity));
    }
    // Reconnect today: the scheduled ones now due, oldest (most urgent) first
    if (recontactLens) {
      return [...recontactList].sort((a, b) => (a.recontact_date ?? '').localeCompare(b.recontact_date ?? ''));
    }
    // Fresh: those who left most recently, freshest first (best chance of returning)
    if (freshLens) {
      return [...freshList].sort((aa, bb) => (aa.days_inactive ?? Infinity) - (bb.days_inactive ?? Infinity));
    }
    let arr = clients.filter((c) => {
      // Filter by summary card
      if (cardFilter === 'pendientes' && !(c.status === 'pendiente' && !c.is_control)) return false;
      if (cardFilter === 'reactivados' && c.reserved !== true) return false;
      if (cardFilter === 'control' && !c.is_control) return false;
      if (fTier !== 'all' && c.tier !== fTier) return false;
      if (fPriority !== 'all' && c.priority !== fPriority) return false;
      if (fOwner !== 'all' && c.owner !== fOwner) return false;
      if (fStatus !== 'all' && c.status !== fStatus) return false;
      if (fOutcome !== 'all' && (fOutcome === 'sin' ? c.outcome != null : c.outcome !== fOutcome)) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      if (sortKey === 'days') {
        const av = a.days_inactive ?? -1;
        const bv = b.days_inactive ?? -1;
        return sortDir === 'desc' ? bv - av : av - bv;
      }
      // Priority: High → Medium → Cold; within that, the FRESHEST first
      // (fewer days since last order = better chance they return). No data → last.
      const pr = prioRank(a.priority) - prioRank(b.priority);
      if (pr !== 0) return pr;
      return (a.days_inactive ?? Infinity) - (b.days_inactive ?? Infinity);
    });
    return arr;
  }, [clients, fTier, fPriority, fOwner, fStatus, fOutcome, sortKey, sortDir, verifyQueue, tierAPending, overdueLens, overdueList, secondTouchLens, secondTouchList, recontactLens, recontactList, freshLens, freshList, cardFilter]);

  const onUpdated = (updated: ReactClient) => {
    setClients((cur) => cur.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(updated);
  };

  // Real KPI: reactivation rate Contacted vs Control (the number that justifies everything)
  const [kpi, setKpi] = useState<{
    contacted: { count: number; reactivated: number; rate: number };
    control: { count: number; reactivated: number; rate: number };
    uplift: number;
  } | null>(null);
  useEffect(() => {
    if (listType !== 'reactivacion') { setKpi(null); return; }
    fetch('/api/reactivation/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setKpi(d))
      .catch(() => {});
  }, [listType, clients]);

  // quick summary of the current list
  const summary = useMemo(() => {
    const control = clients.filter((c) => c.is_control).length;
    // Campaign recoveries = reserved and NOT control (control is measured separately in the KPI).
    const reactivated = clients.filter((c) => c.reserved === true && !c.is_control).length;
    const pending = clients.filter((c) => !c.is_control && c.status === 'pendiente').length;
    return { total: clients.length, control, reactivated, pending };
  }, [clients]);

  return (
    <div>
      {/* List sub-tabs + actions */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {LIST_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setListType(tab.key)}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                listType === tab.key ? 'bg-[#0890F1] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setView('tabla')}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${view === 'tabla' ? 'bg-[#0890F1] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >☰ Table</button>
            <button
              onClick={() => setView('tablero')}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${view === 'tablero' ? 'bg-[#0890F1] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >▦ Board</button>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="text-sm font-medium px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >⬆ Import month</button>
        </div>
      </div>

      {/* 👉 Now: the highest-value play for the logged-in salesperson */}
      {nextStep && (
        <button
          onClick={nextStep.action}
          disabled={!nextStep.action}
          className={`w-full text-left mb-3 rounded-xl border px-4 py-2.5 transition-colors ${
            nextStep.action ? 'bg-[#0890F1]/10 border-[#0890F1]/30 hover:bg-[#0890F1]/15' : 'bg-emerald-50 border-emerald-200 cursor-default'
          }`}
        >
          <span className="text-[11px] font-bold text-[#0890F1] uppercase tracking-wide">👉 Now</span>
          <span className="text-sm text-gray-800 ml-2">{nextStep.text}</span>
          {nextStep.action && <span className="text-xs font-semibold text-[#0890F1] ml-1">→ view</span>}
        </button>
      )}

      {/* Month header: closed (results) vs active (what's coming) */}
      {listType === 'reactivacion' && (
        <MonthHeader
          reconnectToday={recontactList.length}
          fresh={freshList.length}
          onImport={() => setImportOpen(true)}
          onShowFirstBuy={() => setListType('primera_recompra')}
          onShowReconnect={() => { clearLenses(); setCardFilter('none'); setRecontactLens(true); }}
        />
      )}

      {/* Monthly summary (fixed scoreboard) — GM only */}
      {meOwner === null && <MonthlySummary />}

      {/* Campaign timeline — only while the month's campaign is still live */}
      {todayISO() <= CAMPAIGN.end && <CampaignTimeline />}

      {/* KPI Contacted vs Control — manager's number, GM only (not salespeople) */}
      {meOwner === null && listType === 'reactivacion' && kpi && (
        <div className={`rounded-xl border p-4 mb-4 ${kpi.uplift >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-medium text-gray-500">🎯 How many came back · those we contacted vs those we left alone</p>
              <p className="text-sm text-gray-600 mt-0.5">
                Contacted: <b>{(kpi.contacted.rate * 100).toFixed(0)}%</b> came back ({kpi.contacted.reactivated} of {kpi.contacted.count})
                {'  '}·  Control (untouched): <b>{(kpi.control.rate * 100).toFixed(0)}%</b> came back ({kpi.control.reactivated} of {kpi.control.count})
              </p>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-bold ${kpi.uplift >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {kpi.uplift >= 0 ? '+' : ''}{(kpi.uplift * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500">difference (what the campaign added)</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-black/5">
            <b>What is the Control group?</b> A group of clients we leave <b>deliberately uncontacted</b>. If the ones we do contact come back more than these, we know the campaign — and not luck — did the work. That's why the Control group <b>is left untouched</b>.
          </p>
        </div>
      )}

      {/* Note for "Bought once": their turn is October, not mandatory right now */}
      {listType === 'primera_recompra' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-3 flex items-start gap-2">
          <span className="text-lg leading-none">🗓️</span>
          <p className="text-sm text-amber-900">
            <b>Their turn is October.</b> These are clients who bought only once — the coldest. They don't count as pending this week.
            If you have a gap you can get ahead and message them (a bonus), but <b>first close the ones who already replied</b>.
          </p>
        </div>
      )}

      {/* Month-close strip: only while the month's campaign is still live (MonthHeader covers it once closed) */}
      {listType === 'reactivacion' && todayISO() <= CAMPAIGN.end && <MonthStrip reactivated={summary.reactivated} />}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="In list" value={summary.total} active={cardFilter === 'none'} onClick={() => { clearLenses(); setCardFilter('none'); setFreshLens(false); }} />
        <SummaryCard label="Pending" value={summary.pending} tone="blue" active={cardFilter === 'pendientes'} onClick={() => { clearLenses(); setCardFilter((v) => v === 'pendientes' ? 'none' : 'pendientes'); }} />
        <SummaryCard label="Reactivated" value={summary.reactivated} tone="emerald" active={cardFilter === 'reactivados'} onClick={() => { clearLenses(); setCardFilter((v) => v === 'reactivados' ? 'none' : 'reactivados'); }} />
        <SummaryCard label="Control (do not touch)" value={summary.control} tone="rose" hint="Clients we leave deliberately uncontacted, to compare and know whether the campaign is working." active={cardFilter === 'control'} onClick={() => { clearLenses(); setCardFilter((v) => v === 'control' ? 'none' : 'control'); }} />
      </div>

      {/* 🔄 Reconnect today: those scheduled for today (the "next month" that's now due) */}
      {(recontactList.length > 0 || recontactLens) && (
        <button
          onClick={() => { setRecontactLens((v) => !v); setSecondTouchLens(false); setOverdueLens(false); setVerifyQueue(false); setCardFilter('none'); setFreshLens(false); }}
          className={`mb-3 mr-2 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors ${
            recontactLens ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-800 hover:bg-teal-200 border border-teal-300'
          }`}
        >
          {recontactLens ? '✓ Viewing reconnect today' : `🔄 Reconnect today: ${recontactList.length}`}
          <span className={`ml-2 font-normal ${recontactLens ? 'text-white/80' : 'text-teal-600'}`}>· they asked you to call them today</span>
        </button>
      )}

      {/* Fresh: left recently (≤90d) and untouched — the most likely to return */}
      {(freshList.length > 0 || freshLens) && (
        <button
          onClick={() => { setFreshLens((v) => !v); setSecondTouchLens(false); setOverdueLens(false); setVerifyQueue(false); setRecontactLens(false); setCardFilter('none'); }}
          className={`mb-3 mr-2 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors ${
            freshLens ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
          }`}
        >
          {freshLens ? '✓ Viewing fresh' : `🌱 Fresh: ${freshList.length}`}
          <span className={`ml-2 font-normal ${freshLens ? 'text-white/80' : 'text-emerald-600'}`}>· left recently — the most likely</span>
        </button>
      )}

      {/* 2nd round: messaged 7+ days ago with no reply — time to call */}
      {meOwner !== 'Fernanda' && (secondTouchList.length > 0 || secondTouchLens) && (
        <button
          onClick={() => { setSecondTouchLens((v) => !v); setOverdueLens(false); setVerifyQueue(false); setRecontactLens(false); setCardFilter('none'); setFreshLens(false); }}
          className={`mb-3 mr-2 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors ${
            secondTouchLens ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-300'
          }`}
        >
          {secondTouchLens ? '✓ Viewing 2nd round' : `📞 2nd round: ${secondTouchList.length}`}
          <span className={`ml-2 font-normal ${secondTouchLens ? 'text-white/80' : 'text-orange-600'}`}>· they didn't reply to the message — call them</span>
        </button>
      )}

      {/* Overdue: what's owed from before — tackle first */}
      {meOwner !== 'Fernanda' && (overdueList.length > 0 || overdueLens) && (
        <button
          onClick={() => { setOverdueLens((v) => !v); setVerifyQueue(false); setSecondTouchLens(false); setRecontactLens(false); setCardFilter('none'); setFreshLens(false); }}
          className={`mb-3 mr-2 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors ${
            overdueLens ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-300'
          }`}
        >
          {overdueLens ? '✓ Viewing overdue' : `🔴 Overdue: ${overdueList.length}`}
          <span className={`ml-2 font-normal ${overdueLens ? 'text-white/80' : 'text-rose-600'}`}>· you should have touched them earlier — catch up</span>
        </button>
      )}

      {/* Joaquín's verification queue (Tier A to verify, across owners) */}
      {meOwner !== 'Fernanda' && (tierAPending.length > 0 || verifyQueue) && (
        <button
          onClick={() => { setVerifyQueue((v) => !v); setOverdueLens(false); setSecondTouchLens(false); setRecontactLens(false); setCardFilter('none'); setFreshLens(false); }}
          className={`mb-3 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors ${
            verifyQueue ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300'
          }`}
        >
          {verifyQueue ? '✓ Viewing big accounts to review' : `🔴 Big accounts to review (${tierAPending.length})`}
          <span className={`ml-2 font-normal ${verifyQueue ? 'text-white/80' : 'text-yellow-700'}`}>· Joaquín reviews them before Fer calls</span>
        </button>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Select label="Size" value={fTier} onChange={setFTier} options={[['all', 'All'], ['A', 'Large'], ['B', 'Medium'], ['C', 'Small']]} />
        <Select label="Priority" value={fPriority} onChange={setFPriority} options={[['all', 'All'], ['alta', 'High'], ['media', 'Medium'], ['fria', 'Cold']]} />
        <Select label="Owner" value={fOwner} onChange={setFOwner} options={[['all', 'All'], ...owners.map((o) => [o, o] as [string, string])]} />
        <Select label="Status" value={fStatus} onChange={setFStatus} options={[['all', 'All'], ...REACT_STATUS_ORDER.map((s) => [s, REACT_STATUS_LABEL[s]] as [string, string])]} />
        <Select label="Result" value={fOutcome} onChange={setFOutcome} options={[['all', 'All'], ['vivo', '🟢 Alive'], ['octubre', '🟡 October'], ['muerto', '⚫ Dead'], ['sin', 'Unmarked']]} />
        {(fTier !== 'all' || fPriority !== 'all' || fOwner !== 'all' || fStatus !== 'all' || fOutcome !== 'all') && (
          <button onClick={() => { setFTier('all'); setFPriority('all'); setFOwner('all'); setFStatus('all'); setFOutcome('all'); setOverdueLens(false); setVerifyQueue(false); setSecondTouchLens(false); setRecontactLens(false); setCardFilter('none'); setFreshLens(false); }} className="text-xs text-gray-400 hover:text-gray-600">✕ clear</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {clients.length}</span>
      </div>

      {sortKey === 'priority' && (
        <p className="text-xs text-gray-500 mb-3 -mt-1">
          👇 <b>Start from the top:</b> High priority first and, within that, the <b>freshest</b> (fewer days since last order) — they have the best chance.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-3 border-[#0890F1] border-t-transparent rounded-full" />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState onImport={() => setImportOpen(true)} />
      ) : view === 'tabla' ? (
        <TableView
          rows={filtered}
          sortKey={sortKey}
          sortDir={sortDir}
          onCycleDays={() => {
            // priority → days↓ → days↑ → priority
            if (sortKey !== 'days') { setSortKey('days'); setSortDir('desc'); }
            else if (sortDir === 'desc') setSortDir('asc');
            else { setSortKey('priority'); setSortDir('desc'); }
          }}
          onSortPriority={() => { setSortKey('priority'); setSortDir('desc'); }}
          onSelect={setSelected}
        />
      ) : (
        <BoardView rows={filtered} onSelect={setSelected} />
      )}

      {selected && (
        <DetailDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
          onDeleted={(id) => setClients((cur) => cur.filter((c) => c.id !== id))}
        />
      )}
      {importOpen && (
        <ImportModal onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />
      )}
    </div>
  );
}

/* ---------- pieces ---------- */

// Month-close strip: days left until September closes + clients
// recovered in the campaign (what "enters" the month). Turns red near the end.
function MonthStrip({ reactivated }: { reactivated: number }) {
  const today = todayISO();
  const daysLeft = Math.max(0, daysBetween(today, CAMPAIGN.end));
  const closed = today > CAMPAIGN.end;
  const urgent = daysLeft <= 7 && !closed;
  const bg = closed ? 'bg-gray-50 border-gray-200' : urgent ? 'bg-amber-50 border-amber-200' : 'bg-[#0890F1]/5 border-[#0890F1]/20';
  return (
    <div className={`rounded-xl border px-4 py-3 mb-3 flex items-center justify-between gap-3 ${bg}`}>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-lg">🏁</span>
        <span className="font-semibold text-gray-800">
          {closed ? 'September closed' : daysLeft === 0 ? 'September closes today' : `September closes in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`}
        </span>
        {urgent && <span className="text-xs bg-amber-500 text-white rounded px-1.5 py-0.5 font-medium">final stretch</span>}
      </div>
      <div className="text-right">
        <span className="text-xl font-bold text-emerald-600">{reactivated}</span>
        <span className="text-xs text-gray-500 ml-1.5">clients recovered this month</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = 'gray', hint, active, onClick }: { label: string; value: number; tone?: string; hint?: string; active?: boolean; onClick?: () => void }) {
  const color = tone === 'blue' ? 'text-[#0890F1]' : tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : 'text-gray-900';
  const ring = active && label !== 'In list' ? 'ring-2 ring-[#0890F1] border-[#0890F1]' : 'border-gray-100';
  return (
    <button onClick={onClick} title={hint} className={`text-left bg-white rounded-xl border shadow-sm px-4 py-3 transition-shadow hover:shadow-md ${ring}`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">
        {label}
        {hint && <span className="ml-1 text-gray-300">ⓘ</span>}
        {active && label !== 'In list' && <span className="ml-1 text-[#0890F1] font-medium">· viewing</span>}
      </p>
    </button>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="hidden sm:inline">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0890F1]/30"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Badges({ c }: { c: ReactClient }) {
  const wave = waveFor(c);
  const isOverdue = overdue(c, todayISO()) !== null;
  const t1 = targetTouch1(c);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {c.outcome && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold ${OUTCOME_META[c.outcome].chip}`}>{OUTCOME_META[c.outcome].label}</span>}
      {c.tier && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${TIER_STYLE[c.tier]}`}>{TIER_LABEL[c.tier]}</span>}
      {c.priority && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${PRIORITY_STYLE[c.priority]}`}>{PRIORITY_LABEL[c.priority]}</span>}
      {wave && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200" title={`Contact before ${fmtShort(t1)}`}>Week {wave} · before {fmtShort(t1)}</span>}
      {c.is_control && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-rose-600 text-white">CONTROL</span>}
      {!c.is_control && c.needs_verify && c.tier === 'A' && (
        c.verified_at
          ? <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-emerald-100 text-emerald-700">✅ Ready · call</span>
          : <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-yellow-100 text-yellow-800">⚠️ Verify</span>
      )}
      {isOverdue && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">⚠ Overdue</span>}
      {needsSecondTouch(c) && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-orange-100 text-orange-700">📞 2nd due</span>}
      {c.recontact_date && (
        c.recontact_date <= todayISO()
          ? <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-teal-600 text-white">🔄 Reconnect today</span>
          : <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">🔄 {fmtShort(c.recontact_date)}</span>
      )}
    </div>
  );
}

function TableView({ rows, sortKey, sortDir, onCycleDays, onSortPriority, onSelect }: {
  rows: ReactClient[]; sortKey: SortKey; sortDir: SortDir;
  onCycleDays: () => void; onSortPriority: () => void; onSelect: (c: ReactClient) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th className="px-4 py-3 font-medium">
              Company
              <button
                onClick={onSortPriority}
                className={`ml-2 font-normal ${sortKey === 'priority' ? 'text-[#0890F1]' : 'text-gray-400 hover:text-gray-600'}`}
                title="Sort by priority (High first)"
              >
                · priority{sortKey === 'priority' ? ' ↓' : ''}
              </button>
            </th>
            <th className="px-3 py-3 font-medium">Owner</th>
            <th className="px-3 py-3 font-medium cursor-pointer select-none hover:text-gray-700" onClick={onCycleDays}>
              Days since last order {sortKey === 'days' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </th>
            <th className="px-3 py-3 font-medium">Orders</th>
            <th className="px-3 py-3 font-medium">Size</th>
            <th className="px-3 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect(c)}
              className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${c.is_control ? 'bg-rose-50/40' : ''}`}
            >
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900">{c.company}</p>
                <p className="text-xs text-gray-400">{c.phone}</p>
                <div className="mt-1"><Badges c={c} /></div>
              </td>
              <td className="px-3 py-3 text-gray-600">{c.owner || '—'}</td>
              <td className="px-3 py-3">
                <span className={`font-semibold ${(c.days_inactive ?? 0) >= 180 ? 'text-rose-600' : (c.days_inactive ?? 0) >= 90 ? 'text-amber-600' : 'text-gray-700'}`}>
                  {c.days_inactive ?? '—'}
                </span>
              </td>
              <td className="px-3 py-3 text-gray-600">{c.total_orders ?? '—'}</td>
              <td className="px-3 py-3 text-gray-500 text-xs">{c.tier ? TIER_LABEL[c.tier] : (c.list_type === 'primera_recompra' ? 'Bought once' : '—')}</td>
              <td className="px-3 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[c.status]}`}>{REACT_STATUS_LABEL[c.status]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoardView({ rows, onSelect }: { rows: ReactClient[]; onSelect: (c: ReactClient) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {REACT_STATUS_ORDER.map((st) => {
        const col = rows.filter((c) => c.status === st);
        return (
          <div key={st} className="flex-shrink-0 w-64">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_STYLE[st]}`}>{REACT_STATUS_LABEL[st]}</span>
              <span className="text-xs text-gray-400">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className={`w-full text-left bg-white rounded-xl border shadow-sm p-3 hover:shadow-md transition-shadow ${c.is_control ? 'border-rose-200 bg-rose-50/40' : 'border-gray-100'}`}
                >
                  <p className="font-medium text-gray-900 text-sm truncate">{c.company}</p>
                  <p className="text-xs text-gray-400 mb-1.5">{c.days_inactive ?? '—'} days · {c.owner || '—'}</p>
                  <Badges c={c} />
                </button>
              ))}
              {col.length === 0 && <div className="text-xs text-gray-300 text-center py-4 border border-dashed border-gray-200 rounded-xl">empty</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
      <p className="text-4xl mb-3">♻️</p>
      <p className="font-semibold text-gray-900">No clients in this list yet</p>
      <p className="text-sm text-gray-500 mt-1 mb-4">Import the month's Excel to start the campaign.</p>
      <button onClick={onImport} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium">⬆ Import Excel</button>
    </div>
  );
}
