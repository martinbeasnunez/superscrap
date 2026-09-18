'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  REACT_STATUS_LABEL,
  REACT_STATUS_ORDER,
  TIER_LABEL,
  type ReactClient,
  type ReactStatus,
  type ReactListType,
} from '@/lib/reactivation';
import DetailDrawer from './DetailDrawer';
import ImportModal from './ImportModal';
import CampaignTimeline from './CampaignTimeline';
import {
  waveFor,
  targetTouch1,
  overdue,
  currentWave,
  todayISO,
  fmtShort,
} from '@/lib/reactivation-campaign';

type ViewMode = 'tabla' | 'tablero';
type SortDir = 'asc' | 'desc';
type SortKey = 'priority' | 'days';

// Rango de prioridad: Alta primero. (unknown al final)
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

// ¿Toca el 2do toque? (1er toque hecho, no respondió, +7 días, sin 2do toque)
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
  // Por defecto: Prioridad Alta primero (y dentro, los más muertos arriba).
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [selected, setSelected] = useState<ReactClient | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  // Cola de Joaquín: Tier A pendientes de verificar (sin importar de quién sean)
  const [verifyQueue, setVerifyQueue] = useState(false);
  // Lente "Atrasados": lo que se debe de antes (pasó la fecha y sigue sin tocar)
  const [overdueLens, setOverdueLens] = useState(false);
  // Lente "2da vuelta": mensajeados hace 7+ días sin respuesta → toca llamar
  const [secondTouchLens, setSecondTouchLens] = useState(false);
  // Vendedor logueado (para la línea "👉 Ahora" personalizada)
  const [meOwner, setMeOwner] = useState<string | null>(null);

  // Auto-detectar al vendedor logueado (Joaquín/Fernanda) → abre SU semana solo.
  // Martín/GM u otro nombre → ve todo (sin filtro).
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

  // Tier A que Joaquín aún no verifica (cola de verificación, cruza dueños)
  const tierAPending = useMemo(
    () => clients.filter((c) => c.tier === 'A' && c.needs_verify && !c.verified_at && !c.is_control),
    [clients]
  );

  // Atrasados: se les pasó la fecha y siguen sin contactar (lo que "se debe")
  const overdueList = useMemo(
    () => clients.filter((c) => overdue(c, todayISO()) !== null),
    [clients]
  );

  // 2da vuelta: mensajeados hace 7+ días, sin respuesta, sin 2do toque → llamar
  const secondTouchList = useMemo(
    () => clients.filter((c) => needsSecondTouch(c) && c.list_type !== 'excluir'),
    [clients]
  );

  // "👉 Ahora": la jugada de más valor para el vendedor logueado
  const nextStep = useMemo(() => {
    const curWaveN = currentWave(todayISO()).n;
    const activo = (c: ReactClient) => !c.is_control && c.list_type !== 'excluir';
    const goLens = () => { setOverdueLens(false); setVerifyQueue(false); setSecondTouchLens(false); };
    if (meOwner === 'Joaquín') {
      if (secondTouchList.length > 0)
        return { text: `📞 Hoy toca: ${secondTouchList.length} llamadas de 2da vuelta — esas cierran mejor que otro mensaje.`, action: () => { goLens(); setSecondTouchLens(true); } };
      const msgs = clients.filter((c) => activo(c) && c.owner === 'Joaquín' && c.tier !== 'A' && !c.touch1_date && (waveFor(c) ?? 99) <= curWaveN);
      if (msgs.length > 0)
        return { text: `💬 Te faltan ${msgs.length} mensajes por enviar — empieza por los de arriba.`, action: () => { goLens(); setFOwner('Joaquín'); } };
      return { text: '✅ Al día. Sigue contactando de arriba hacia abajo.', action: undefined };
    }
    if (meOwner === 'Fernanda') {
      const grandes = clients.filter((c) => activo(c) && c.tier === 'A' && !c.touch1_date);
      if (grandes.length > 0)
        return { text: `📞 Te quedan ${grandes.length} cuentas grandes por llamar — empieza por las de arriba.`, action: () => { goLens(); setFOwner('Fernanda'); } };
      return { text: '✅ Llamaste a todas tus grandes. Grande 🙌', action: undefined };
    }
    return null; // GM u otro: sin línea personal
  }, [meOwner, clients, secondTouchList]);

  const filtered = useMemo(() => {
    // Cola de verificación: ignora los demás filtros, ordena por más frescos
    if (verifyQueue) {
      return [...tierAPending].sort((a, b) => (a.days_inactive ?? Infinity) - (b.days_inactive ?? Infinity));
    }
    // Atrasados: lo que se debe, ordenado por más frescos (más chance)
    if (overdueLens) {
      return [...overdueList].sort((a, b) => (a.days_inactive ?? Infinity) - (b.days_inactive ?? Infinity));
    }
    // 2da vuelta: los que toca llamar, más frescos primero
    if (secondTouchLens) {
      return [...secondTouchList].sort((a, b) => (a.days_inactive ?? Infinity) - (b.days_inactive ?? Infinity));
    }
    let arr = clients.filter((c) => {
      if (fTier !== 'all' && c.tier !== fTier) return false;
      if (fPriority !== 'all' && c.priority !== fPriority) return false;
      if (fOwner !== 'all' && c.owner !== fOwner) return false;
      if (fStatus !== 'all' && c.status !== fStatus) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      if (sortKey === 'days') {
        const av = a.days_inactive ?? -1;
        const bv = b.days_inactive ?? -1;
        return sortDir === 'desc' ? bv - av : av - bv;
      }
      // Prioridad: Alta → Media → Fría; dentro, los MÁS FRESCOS primero
      // (menos días sin pedir = más chance de que vuelvan). Sin dato → al final.
      const pr = prioRank(a.priority) - prioRank(b.priority);
      if (pr !== 0) return pr;
      return (a.days_inactive ?? Infinity) - (b.days_inactive ?? Infinity);
    });
    return arr;
  }, [clients, fTier, fPriority, fOwner, fStatus, sortKey, sortDir, verifyQueue, tierAPending, overdueLens, overdueList, secondTouchLens, secondTouchList]);

  const onUpdated = (updated: ReactClient) => {
    setClients((cur) => cur.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(updated);
  };

  // KPI real: tasa de reactivación Contactado vs Control (el número que justifica todo)
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

  // resumen rápido de la lista actual
  const summary = useMemo(() => {
    const control = clients.filter((c) => c.is_control).length;
    const reactivated = clients.filter((c) => c.reserved === true).length;
    const pending = clients.filter((c) => !c.is_control && c.status === 'pendiente').length;
    return { total: clients.length, control, reactivated, pending };
  }, [clients]);

  return (
    <div>
      {/* Sub-tabs de lista + acciones */}
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

      {/* 👉 Ahora: la jugada de más valor para el vendedor logueado */}
      {nextStep && (
        <button
          onClick={nextStep.action}
          disabled={!nextStep.action}
          className={`w-full text-left mb-3 rounded-xl border px-4 py-2.5 transition-colors ${
            nextStep.action ? 'bg-[#0890F1]/10 border-[#0890F1]/30 hover:bg-[#0890F1]/15' : 'bg-emerald-50 border-emerald-200 cursor-default'
          }`}
        >
          <span className="text-[11px] font-bold text-[#0890F1] uppercase tracking-wide">👉 Ahora</span>
          <span className="text-sm text-gray-800 ml-2">{nextStep.text}</span>
          {nextStep.action && <span className="text-xs font-semibold text-[#0890F1] ml-1">→ ver</span>}
        </button>
      )}

      {/* Timeline de la campaña (olas, deadline, progreso) */}
      <CampaignTimeline />

      {/* KPI real: Contactado vs Control (solo lista de reactivación) */}
      {listType === 'reactivacion' && kpi && (
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

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="En lista" value={summary.total} />
        <SummaryCard label="Pendientes" value={summary.pending} tone="blue" />
        <SummaryCard label="Reactivados" value={summary.reactivated} tone="emerald" />
        <SummaryCard label="Control (no tocar)" value={summary.control} tone="rose" hint="Clientes que dejamos sin contactar a propósito, para comparar y saber si la campaña funciona." />
      </div>

      {/* 2da vuelta: mensajeados hace 7+ días sin respuesta — toca llamar */}
      {(secondTouchList.length > 0 || secondTouchLens) && (
        <button
          onClick={() => { setSecondTouchLens((v) => !v); setOverdueLens(false); setVerifyQueue(false); }}
          className={`mb-3 mr-2 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors ${
            secondTouchLens ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-300'
          }`}
        >
          {secondTouchLens ? '✓ Viendo 2da vuelta' : `📞 2da vuelta: ${secondTouchList.length}`}
          <span className={`ml-2 font-normal ${secondTouchLens ? 'text-white/80' : 'text-orange-600'}`}>· no respondieron el mensaje — llámalos</span>
        </button>
      )}

      {/* Atrasados: lo que se debe de antes — a avanzar primero */}
      {(overdueList.length > 0 || overdueLens) && (
        <button
          onClick={() => { setOverdueLens((v) => !v); setVerifyQueue(false); setSecondTouchLens(false); }}
          className={`mb-3 mr-2 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors ${
            overdueLens ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-300'
          }`}
        >
          {overdueLens ? '✓ Viendo atrasados' : `🔴 Atrasados: ${overdueList.length}`}
          <span className={`ml-2 font-normal ${overdueLens ? 'text-white/80' : 'text-rose-600'}`}>· debías tocarlos antes — a avanzar</span>
        </button>
      )}

      {/* Cola de verificación de Joaquín (Tier A por verificar, cruza dueños) */}
      {(tierAPending.length > 0 || verifyQueue) && (
        <button
          onClick={() => { setVerifyQueue((v) => !v); setOverdueLens(false); setSecondTouchLens(false); }}
          className={`mb-3 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors ${
            verifyQueue ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300'
          }`}
        >
          {verifyQueue ? '✓ Viendo cuentas grandes por revisar' : `🔴 Cuentas grandes por revisar (${tierAPending.length})`}
          <span className={`ml-2 font-normal ${verifyQueue ? 'text-white/80' : 'text-yellow-700'}`}>· lo revisa Joaquín antes de que Fer llame</span>
        </button>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Select label="Tamaño" value={fTier} onChange={setFTier} options={[['all', 'Todos'], ['A', 'Grande'], ['B', 'Mediano'], ['C', 'Chico']]} />
        <Select label="Prioridad" value={fPriority} onChange={setFPriority} options={[['all', 'Todas'], ['alta', 'Alta'], ['media', 'Media'], ['fria', 'Fría']]} />
        <Select label="Dueño" value={fOwner} onChange={setFOwner} options={[['all', 'Todos'], ...owners.map((o) => [o, o] as [string, string])]} />
        <Select label="Estado" value={fStatus} onChange={setFStatus} options={[['all', 'Todos'], ...REACT_STATUS_ORDER.map((s) => [s, REACT_STATUS_LABEL[s]] as [string, string])]} />
        {(fTier !== 'all' || fPriority !== 'all' || fOwner !== 'all' || fStatus !== 'all') && (
          <button onClick={() => { setFTier('all'); setFPriority('all'); setFOwner('all'); setFStatus('all'); setOverdueLens(false); setVerifyQueue(false); setSecondTouchLens(false); }} className="text-xs text-gray-400 hover:text-gray-600">✕ limpiar</button>
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
            // prioridad → días↓ → días↑ → prioridad
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

/* ---------- piezas ---------- */

function SummaryCard({ label, value, tone = 'gray', hint }: { label: string; value: number; tone?: string; hint?: string }) {
  const color = tone === 'blue' ? 'text-[#0890F1]' : tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3" title={hint}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">
        {label}
        {hint && <span className="ml-1 text-gray-300" title={hint}>ⓘ</span>}
      </p>
    </div>
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
      {c.tier && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${TIER_STYLE[c.tier]}`}>{TIER_LABEL[c.tier]}</span>}
      {c.priority && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${PRIORITY_STYLE[c.priority]}`}>{PRIORITY_LABEL[c.priority]}</span>}
      {wave && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200" title={`Para contactar antes del ${fmtShort(t1)}`}>Semana {wave} · antes del {fmtShort(t1)}</span>}
      {c.is_control && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-rose-600 text-white">CONTROL</span>}
      {!c.is_control && c.needs_verify && c.tier === 'A' && (
        c.verified_at
          ? <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-emerald-100 text-emerald-700">✅ Listo · llamar</span>
          : <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-yellow-100 text-yellow-800">⚠️ Verificar</span>
      )}
      {isOverdue && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">⚠ Vencido</span>}
      {needsSecondTouch(c) && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-orange-100 text-orange-700">📞 Toca 2do</span>}
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
              <td className="px-3 py-3 text-gray-500 text-xs">{c.tier ? TIER_LABEL[c.tier] : (c.list_type === 'primera_recompra' ? 'Compró 1 vez' : '—')}</td>
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
                  <p className="text-xs text-gray-400 mb-1.5">{c.days_inactive ?? '—'} días · {c.owner || '—'}</p>
                  <Badges c={c} />
                </button>
              ))}
              {col.length === 0 && <div className="text-xs text-gray-300 text-center py-4 border border-dashed border-gray-200 rounded-xl">vacío</div>}
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
      <p className="text-sm text-gray-500 mt-1 mb-4">Importa el Excel del mes para empezar la campaña.</p>
      <button onClick={onImport} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium">⬆ Importar Excel</button>
    </div>
  );
}
