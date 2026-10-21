'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  REACT_STATUS_LABEL,
  REACT_STATUS_ORDER,
  TIER_LABEL,
  OUTCOME_META,
  type ReactClient,
  type ReactStatus,
  type ReactListType,
} from '@/lib/reactivation';
import DetailDrawer from './DetailDrawer';
import ImportModal from './ImportModal';
import CampaignTimeline from './CampaignTimeline';
import MonthlySummary from './MonthlySummary';
// import MonthHeader from './MonthHeader'; // omitido por ahora (ver render)
import FocusBanner from './FocusBanner';
import {
  waveFor,
  targetTouch1,
  overdue,
  todayISO,
  fmtShort,
  daysBetween,
  CAMPAIGN,
  campaignActive,
} from '@/lib/reactivation-campaign';

type ViewMode = 'tabla' | 'tablero';
type SortDir = 'asc' | 'desc';
type SortKey = 'priority' | 'days';

// Priority rank: High first. (unknown goes last)
const PRIORITY_RANK: Record<string, number> = { alta: 0, media: 1, fria: 2 };
const prioRank = (p: string | null) => (p && p in PRIORITY_RANK ? PRIORITY_RANK[p] : 9);

const PRIORITY_LABEL: Record<string, string> = { alta: 'Alta', media: 'Media', fria: 'Fría' };
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
  { key: 'reactivacion', label: '♻️ Clientes frecuentes' },
  { key: 'primera_recompra', label: '🌱 Compraron 1 vez' },
  { key: 'excluir', label: '🚫 No contactar' },
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

  // "Your plan for today": the logged-in salesperson's queues, in priority order,
  // each one clickable. The order IS the strategy — frescos primero (lo que sí
  // convierte), los viejos al final, y los de "1era vez" NO entran (peor segmento).
  const myPlan = useMemo((): { icon: string; title: string; sub: string; action: () => void }[] => {
    if (!meOwner) return [];
    const go = () => { clearLenses(); setCardFilter('none'); };
    const steps: { icon: string; title: string; sub: string; action: () => void }[] = [];
    // 1) Reconnects already due (they asked you to call back)
    const reconnectDue = recontactList.filter((c) => c.owner === meOwner);
    if (reconnectDue.length)
      steps.push({ icon: '🔄', title: `Reconectar ahora: ${reconnectDue.length}`, sub: 'te pidieron que los llames — vencido', action: () => { go(); setRecontactLens(true); } });

    if (meOwner === 'Fernanda') {
      // Fernanda: sus cuentas grandes — llamar, más frescas arriba.
      const newUntouched = clients.filter((c) => !c.is_control && c.list_type === 'reactivacion' && c.owner === meOwner && !c.touch1_date);
      if (newUntouched.length)
        steps.push({ icon: '📞', title: `Llama a tus cuentas grandes: ${newUntouched.length}`, sub: 'sin tocar — empieza de arriba', action: () => { go(); setFOwner(meOwner); setSortKey('days'); setSortDir('asc'); } });
    } else {
      // Joaquín (y resto): el FOCO es lo que convierte.
      // 2) Frescos (se fueron hace poco) — aquí es donde sí vuelven.
      const fresh = freshList.filter((c) => c.owner === meOwner);
      if (fresh.length)
        steps.push({ icon: '🌱', title: `Frescos (se fueron hace poco): ${fresh.length}`, sub: 'tu mejor chance — empieza por aquí', action: () => { go(); setFreshLens(true); } });
      // 3) Viejos sin tocar (+90 días) — pozo frío, al final y solo si sobra tiempo.
      const oldUntouched = clients.filter((c) => !c.is_control && c.list_type === 'reactivacion' && c.owner === meOwner && !c.touch1_date && (c.days_inactive ?? 0) > 90);
      if (oldUntouched.length)
        steps.push({ icon: '🪦', title: `Viejos (+90 días): ${oldUntouched.length}`, sub: 'pozo frío — solo si te sobra el día', action: () => { go(); setFOwner(meOwner); setSortKey('days'); setSortDir('desc'); } });
    }
    return steps;
  }, [meOwner, clients, recontactList, freshList]);

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
      if (cardFilter === 'pendientes' && !(!c.touch1_date && !c.is_control)) return false;
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

  // KPI Contactado vs Control: se calcula pero por ahora NO se muestra (está en "Resumen por mes").
  const SHOW_KPI = false;
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
    // A logged-in salesperson sees THEIR numbers (their view is auto-filtered to them);
    // the GM (no meOwner) sees everyone. Keeps the cards matching the list below.
    const scope = meOwner ? clients.filter((c) => c.owner === meOwner) : clients;
    const control = scope.filter((c) => c.is_control).length;
    // Campaign recoveries = reserved and NOT control (control is measured separately in the KPI).
    const reactivated = scope.filter((c) => c.reserved === true && !c.is_control).length;
    // Pending = not yet contacted (untouched), not control — robust vs the stored status.
    const pending = scope.filter((c) => !c.is_control && !c.touch1_date).length;
    return { total: scope.length, control, reactivated, pending };
  }, [clients, meOwner]);

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
            >☰ Tabla</button>
            <button
              onClick={() => setView('tablero')}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${view === 'tablero' ? 'bg-[#0890F1] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >▦ Tablero</button>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="text-sm font-medium px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >⬆ Importar mes</button>
        </div>
      </div>

      {/* Estrategia del mes: foco en frescos + tibios (no rociar toda la lista) */}
      {listType === 'reactivacion' && (
        <FocusBanner
          fresh={freshList.filter((c) => !meOwner || c.owner === meOwner).length}
          warm={recontactList.filter((c) => !meOwner || c.owner === meOwner).length}
          onFresh={() => { clearLenses(); setCardFilter('none'); setFreshLens(true); }}
          onWarm={() => { clearLenses(); setCardFilter('none'); setRecontactLens(true); }}
        />
      )}

      {/* Your plan for today: the logged-in salesperson's queues, in order, clickable */}
      {meOwner && listType === 'reactivacion' && (
        myPlan.length > 0 ? (
          <div className="mb-3 rounded-xl border border-[#0890F1]/30 bg-[#0890F1]/5 p-3">
            <p className="text-[11px] font-bold text-[#0890F1] uppercase tracking-wide mb-2">👉 Tu plan de hoy</p>
            <ol className="space-y-1.5">
              {myPlan.map((step, i) => (
                <li key={i}>
                  <button onClick={step.action} className="w-full text-left flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#0890F1]/10">
                    <span className="text-xs font-bold text-gray-400 w-4">{i + 1}.</span>
                    <span className="text-base leading-none">{step.icon}</span>
                    <span className="text-sm font-semibold text-gray-800">{step.title}</span>
                    <span className="text-xs text-gray-500">· {step.sub}</span>
                    <span className="text-xs font-semibold text-[#0890F1] ml-auto">ver →</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
            <span className="text-sm text-emerald-800 font-medium">✅ Al día — no tienes nada pendiente hoy. Grande 🙌</span>
          </div>
        )
      )}

      {/* Tarjetas de mes (Setiembre cerrado / Octubre) — omitidas por ahora: repiten
          la franja de estrategia + "Tu plan de hoy" arriba y "Resumen por mes" abajo.
      {listType === 'reactivacion' && (
        <MonthHeader
          reconnectToday={recontactList.length}
          fresh={freshList.length}
          onImport={() => setImportOpen(true)}
          onShowFirstBuy={() => setListType('primera_recompra')}
          onShowReconnect={() => { clearLenses(); setCardFilter('none'); setRecontactLens(true); }}
        />
      )} */}

      {/* Monthly summary (fixed scoreboard) — GM only */}
      {meOwner === null && <MonthlySummary />}

      {/* Campaign timeline — only while the month's campaign is still live */}
      {todayISO() <= CAMPAIGN.end && <CampaignTimeline />}

      {/* KPI Contactado vs Control — oculto por ahora (vive en "Resumen por mes"). Flip a true para mostrarlo. */}
      {SHOW_KPI && meOwner === null && listType === 'reactivacion' && kpi && (
        <div className={`rounded-xl border p-4 mb-4 ${kpi.uplift >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-medium text-gray-500">🎯 Cuántos volvieron · los que contactamos vs los que dejamos quietos</p>
              <p className="text-sm text-gray-600 mt-0.5">
                Contactados: volvió el <b>{(kpi.contacted.rate * 100).toFixed(0)}%</b> ({kpi.contacted.reactivated} de {kpi.contacted.count})
                {'  '}·  Control (sin tocar): volvió el <b>{(kpi.control.rate * 100).toFixed(0)}%</b> ({kpi.control.reactivated} de {kpi.control.count})
              </p>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-bold ${kpi.uplift >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {kpi.uplift >= 0 ? '+' : ''}{(kpi.uplift * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500">de diferencia (lo que sumó la campaña)</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-black/5">
            <b>¿Qué es el Control?</b> Un grupo de clientes que dejamos <b>sin contactar a propósito</b>. Si los que sí contactamos vuelven más que estos, sabemos que la campaña —y no la suerte— hizo el trabajo. Por eso el Control <b>no se toca</b>.
          </p>
        </div>
      )}

      {/* Note for "Bought once": the worst-converting segment — do NOT prioritize */}
      {listType === 'primera_recompra' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-3 flex items-start gap-2">
          <span className="text-lg leading-none">🪣</span>
          <p className="text-sm text-gray-700">
            <b>El segmento más frío — no es tu foco.</b> Compraron una sola vez y casi no vuelven (volvió 1 de cada 9 el mes pasado). <b>No les metas tiempo</b> mientras tengas frescos o gente que ya respondió. Trabájalos solo si te sobra el día.
          </p>
        </div>
      )}

      {/* Month-close strip: only while the month's campaign is still live (MonthHeader covers it once closed) */}
      {listType === 'reactivacion' && todayISO() <= CAMPAIGN.end && <MonthStrip reactivated={summary.reactivated} />}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="En lista" value={summary.total} active={cardFilter === 'none'} onClick={() => { clearLenses(); setCardFilter('none'); setFreshLens(false); }} />
        <SummaryCard label="Pendientes" value={summary.pending} tone="blue" active={cardFilter === 'pendientes'} onClick={() => { clearLenses(); setCardFilter((v) => v === 'pendientes' ? 'none' : 'pendientes'); }} />
        <SummaryCard label="Recuperados" value={summary.reactivated} tone="emerald" active={cardFilter === 'reactivados'} onClick={() => { clearLenses(); setCardFilter((v) => v === 'reactivados' ? 'none' : 'reactivados'); }} />
        <SummaryCard label="Control (no tocar)" value={summary.control} tone="rose" hint="Clientes que dejamos sin contactar a propósito, para comparar y saber si la campaña funciona." active={cardFilter === 'control'} onClick={() => { clearLenses(); setCardFilter((v) => v === 'control' ? 'none' : 'control'); }} />
      </div>

      {/* 🔄 Reconnect today: those scheduled for today (the "next month" that's now due) */}
      {(recontactList.length > 0 || recontactLens) && (
        <button
          onClick={() => { setRecontactLens((v) => !v); setSecondTouchLens(false); setOverdueLens(false); setVerifyQueue(false); setCardFilter('none'); setFreshLens(false); }}
          className={`mb-3 mr-2 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors ${
            recontactLens ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-800 hover:bg-teal-200 border border-teal-300'
          }`}
        >
          {recontactLens ? '✓ Viendo reconectar hoy' : `🔄 Reconectar hoy: ${recontactList.length}`}
          <span className={`ml-2 font-normal ${recontactLens ? 'text-white/80' : 'text-teal-600'}`}>· te pidieron que los llames hoy</span>
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
          {freshLens ? '✓ Viendo frescos' : `🌱 Frescos: ${freshList.length}`}
          <span className={`ml-2 font-normal ${freshLens ? 'text-white/80' : 'text-emerald-600'}`}>· se fueron hace poco — los de más chance</span>
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
          {secondTouchLens ? '✓ Viendo 2da vuelta' : `📞 2da vuelta: ${secondTouchList.length}`}
          <span className={`ml-2 font-normal ${secondTouchLens ? 'text-white/80' : 'text-orange-600'}`}>· no respondieron el mensaje — llámalos</span>
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
          {overdueLens ? '✓ Viendo atrasados' : `🔴 Atrasados: ${overdueList.length}`}
          <span className={`ml-2 font-normal ${overdueLens ? 'text-white/80' : 'text-rose-600'}`}>· debías tocarlos antes — a avanzar</span>
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
          {verifyQueue ? '✓ Viendo cuentas grandes por revisar' : `🔴 Cuentas grandes por revisar (${tierAPending.length})`}
          <span className={`ml-2 font-normal ${verifyQueue ? 'text-white/80' : 'text-yellow-700'}`}>· Joaquín las revisa antes de que Fer llame</span>
        </button>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Select label="Tamaño" value={fTier} onChange={setFTier} options={[["all", "Todos"], ["A", "Grande"], ["B", "Mediano"], ["C", "Chico"]]} />
        <Select label="Prioridad" value={fPriority} onChange={setFPriority} options={[["all", "Todas"], ["alta", "Alta"], ["media", "Media"], ["fria", "Fría"]]} />
        <Select label="Dueño" value={fOwner} onChange={setFOwner} options={[["all", "Todos"], ...owners.map((o) => [o, o] as [string, string])]} />
        <Select label="Estado" value={fStatus} onChange={setFStatus} options={[["all", "Todos"], ...REACT_STATUS_ORDER.map((s) => [s, REACT_STATUS_LABEL[s]] as [string, string])]} />
        <Select label="Resultado" value={fOutcome} onChange={setFOutcome} options={[["all", "Todos"], ["vivo", "🟢 Vivo"], ["octubre", "🟡 Octubre"], ["muerto", "⚫ Muerto"], ["sin", "Sin marcar"]]} />
        {(fTier !== 'all' || fPriority !== 'all' || fOwner !== 'all' || fStatus !== 'all' || fOutcome !== 'all') && (
          <button onClick={() => { setFTier('all'); setFPriority('all'); setFOwner('all'); setFStatus('all'); setFOutcome('all'); setOverdueLens(false); setVerifyQueue(false); setSecondTouchLens(false); setRecontactLens(false); setCardFilter('none'); setFreshLens(false); }} className="text-xs text-gray-400 hover:text-gray-600">✕ limpiar</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} de {clients.length}</span>
      </div>

      {sortKey === 'priority' && (
        <p className="text-xs text-gray-500 mb-3 -mt-1">
          👇 <b>Empieza de arriba:</b> primero prioridad Alta y, dentro, los <b>más frescos</b> (menos días sin pedir) — son los de más chance.
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
          {closed ? 'Setiembre cerrado' : daysLeft === 0 ? 'Setiembre cierra hoy' : `Setiembre cierra en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`}
        </span>
        {urgent && <span className="text-xs bg-amber-500 text-white rounded px-1.5 py-0.5 font-medium">recta final</span>}
      </div>
      <div className="text-right">
        <span className="text-xl font-bold text-emerald-600">{reactivated}</span>
        <span className="text-xs text-gray-500 ml-1.5">clientes recuperados este mes</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = 'gray', hint, active, onClick }: { label: string; value: number; tone?: string; hint?: string; active?: boolean; onClick?: () => void }) {
  const color = tone === 'blue' ? 'text-[#0890F1]' : tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : 'text-gray-900';
  const ring = active && label !== 'En lista' ? 'ring-2 ring-[#0890F1] border-[#0890F1]' : 'border-gray-100';
  return (
    <button onClick={onClick} title={hint} className={`text-left bg-white rounded-xl border shadow-sm px-4 py-3 transition-shadow hover:shadow-md ${ring}`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">
        {label}
        {hint && <span className="ml-1 text-gray-300">ⓘ</span>}
        {active && label !== 'En lista' && <span className="ml-1 text-[#0890F1] font-medium">· viendo</span>}
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
  const showCampaign = campaignActive(todayISO());
  const wave = showCampaign ? waveFor(c) : null;
  const isOverdue = overdue(c, todayISO()) !== null;
  const t1 = targetTouch1(c);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {c.outcome && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold ${OUTCOME_META[c.outcome].chip}`}>{OUTCOME_META[c.outcome].label}</span>}
      {c.tier && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${TIER_STYLE[c.tier]}`}>{TIER_LABEL[c.tier]}</span>}
      {c.priority && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${PRIORITY_STYLE[c.priority]}`}>{PRIORITY_LABEL[c.priority]}</span>}
      {wave && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200" title={`Contactar antes del ${fmtShort(t1)}`}>Semana {wave} · antes del {fmtShort(t1)}</span>}
      {c.is_control && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-rose-600 text-white">CONTROL</span>}
      {!c.is_control && c.needs_verify && c.tier === 'A' && (
        c.verified_at
          ? <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-emerald-100 text-emerald-700">✅ Listo · llamar</span>
          : <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-yellow-100 text-yellow-800">⚠️ Verificar</span>
      )}
      {isOverdue && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">⚠ Vencido</span>}
      {needsSecondTouch(c) && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-orange-100 text-orange-700">📞 Toca 2do</span>}
      {c.recontact_date && (
        c.recontact_date <= todayISO()
          ? <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-teal-600 text-white">🔄 Reconectar hoy</span>
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
              Empresa
              <button
                onClick={onSortPriority}
                className={`ml-2 font-normal ${sortKey === 'priority' ? 'text-[#0890F1]' : 'text-gray-400 hover:text-gray-600'}`}
                title="Ordenar por prioridad (Alta primero)"
              >
                · prioridad{sortKey === 'priority' ? ' ↓' : ''}
              </button>
            </th>
            <th className="px-3 py-3 font-medium">Dueño</th>
            <th className="px-3 py-3 font-medium cursor-pointer select-none hover:text-gray-700" onClick={onCycleDays}>
              Días sin pedir {sortKey === 'days' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </th>
            <th className="px-3 py-3 font-medium">Pedidos</th>
            <th className="px-3 py-3 font-medium">Tamaño</th>
            <th className="px-3 py-3 font-medium">Estado</th>
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
      <p className="font-semibold text-gray-900">Aún no hay clientes en esta lista</p>
      <p className="text-sm text-gray-500 mt-1 mb-4">Importa el Excel del mes para arrancar.</p>
      <button onClick={onImport} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium">⬆ Importar Excel</button>
    </div>
  );
}
