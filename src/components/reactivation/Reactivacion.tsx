'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  REACT_STATUS_LABEL,
  REACT_STATUS_ORDER,
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
  { key: 'reactivacion', label: '♻️ Reactivación' },
  { key: 'primera_recompra', label: '🌱 Primera recompra' },
  { key: 'excluir', label: '🚫 Excluir / Revisar' },
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
  // "Mi semana": scope a la ola actual del dueño seleccionado (solo pendientes)
  const [soloMiOla, setSoloMiOla] = useState(false);
  // Cola de Joaquín: Tier A pendientes de verificar (sin importar de quién sean)
  const [verifyQueue, setVerifyQueue] = useState(false);

  // Auto-detectar al vendedor logueado (Joaquín/Fernanda) → abre SU semana solo.
  // Martín/GM u otro nombre → ve todo (sin filtro).
  useEffect(() => {
    try {
      const raw = localStorage.getItem('orbit_user');
      if (!raw) return;
      const n = String(JSON.parse(raw)?.name || '')
        .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const mapped = n.includes('joaquin') ? 'Joaquín' : n.includes('fernanda') ? 'Fernanda' : null;
      if (mapped) setFOwner(mapped);
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

  const filtered = useMemo(() => {
    // Cola de verificación: ignora los demás filtros, ordena por más frescos
    if (verifyQueue) {
      return [...tierAPending].sort((a, b) => (a.days_inactive ?? Infinity) - (b.days_inactive ?? Infinity));
    }
    const curWaveN = currentWave(todayISO()).n;
    let arr = clients.filter((c) => {
      if (fTier !== 'all' && c.tier !== fTier) return false;
      if (fPriority !== 'all' && c.priority !== fPriority) return false;
      if (fOwner !== 'all' && c.owner !== fOwner) return false;
      if (fStatus !== 'all' && c.status !== fStatus) return false;
      // Scope "Mi semana": solo pendientes de la ola actual (no control)
      if (soloMiOla && fOwner !== 'all' && (c.is_control || waveFor(c) !== curWaveN || c.touch1_date)) return false;
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
  }, [clients, fTier, fPriority, fOwner, fStatus, sortKey, sortDir, soloMiOla, verifyQueue, tierAPending]);

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

      {/* Timeline de la campaña (olas, deadline, progreso) */}
      <CampaignTimeline />

      {/* Mi semana — filtrado por dueño (no hay login; se usa el selector de Dueño) */}
      {fOwner !== 'all' && (
        <MiSemana owner={fOwner} clients={clients} active={soloMiOla} onToggle={() => setSoloMiOla((v) => !v)} />
      )}

      {/* KPI real: Contactado vs Control (solo lista de reactivación) */}
      {listType === 'reactivacion' && kpi && (
        <div className={`rounded-xl border p-4 mb-4 ${kpi.uplift >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-medium text-gray-500">🎯 Tasa de reactivación · Contactado vs Control</p>
              <p className="text-sm text-gray-600 mt-0.5">
                Contactado <b>{(kpi.contacted.rate * 100).toFixed(0)}%</b> ({kpi.contacted.reactivated}/{kpi.contacted.count})
                {'  '}vs Control <b>{(kpi.control.rate * 100).toFixed(0)}%</b> ({kpi.control.reactivated}/{kpi.control.count})
              </p>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-bold ${kpi.uplift >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {kpi.uplift >= 0 ? '+' : ''}{(kpi.uplift * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500">diferencial (KPI real)</p>
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

      {/* Cola de verificación de Joaquín (Tier A por verificar, cruza dueños) */}
      {(tierAPending.length > 0 || verifyQueue) && (
        <button
          onClick={() => setVerifyQueue((v) => !v)}
          className={`mb-3 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors ${
            verifyQueue ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300'
          }`}
        >
          {verifyQueue ? '✓ Viendo Tier A por verificar' : `🔴 Tier A por verificar (${tierAPending.length})`}
          <span className={`ml-2 font-normal ${verifyQueue ? 'text-white/80' : 'text-yellow-700'}`}>· trabajo de Joaquín</span>
        </button>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Select label="Tier" value={fTier} onChange={setFTier} options={[['all', 'Todos'], ['A', 'A'], ['B', 'B'], ['C', 'C']]} />
        <Select label="Prioridad" value={fPriority} onChange={setFPriority} options={[['all', 'Todas'], ['alta', 'Alta'], ['media', 'Media'], ['fria', 'Fría']]} />
        <Select label="Dueño" value={fOwner} onChange={setFOwner} options={[['all', 'Todos'], ...owners.map((o) => [o, o] as [string, string])]} />
        <Select label="Estado" value={fStatus} onChange={setFStatus} options={[['all', 'Todos'], ...REACT_STATUS_ORDER.map((s) => [s, REACT_STATUS_LABEL[s]] as [string, string])]} />
        {(fTier !== 'all' || fPriority !== 'all' || fOwner !== 'all' || fStatus !== 'all') && (
          <button onClick={() => { setFTier('all'); setFPriority('all'); setFOwner('all'); setFStatus('all'); setSoloMiOla(false); }} className="text-xs text-gray-400 hover:text-gray-600">✕ limpiar</button>
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
      {c.tier && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${TIER_STYLE[c.tier]}`}>Tier {c.tier}</span>}
      {c.priority && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${PRIORITY_STYLE[c.priority]}`}>{PRIORITY_LABEL[c.priority]}</span>}
      {wave && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200" title={`1er toque objetivo: ${fmtShort(t1)}`}>Ola {wave} · {fmtShort(t1)}</span>}
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

// "Mi semana": resumen de la ola actual para el dueño seleccionado (no hay login).
function MiSemana({ owner, clients, active, onToggle }: {
  owner: string; clients: ReactClient[]; active: boolean; onToggle: () => void;
}) {
  const today = todayISO();
  const cur = currentWave(today);
  const mine = clients.filter((c) => c.owner === owner && !c.is_control && c.list_type !== 'excluir');
  const enOla = mine.filter((c) => waveFor(c) === cur.n);
  const pendientes = enOla.filter((c) => !c.touch1_date);
  const vencidos = mine.filter((c) => overdue(c, today) !== null);
  return (
    <div className="rounded-xl border border-[#0890F1]/30 bg-[#0890F1]/5 p-3 mb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="font-semibold text-[#0890F1]">🗓️ Mi semana · {owner}</span>
          <span className="text-sm text-gray-600 ml-2">
            {cur.name}: <b>{pendientes.length}</b> por tocar de <b>{enOla.length}</b> en tu ola
            {vencidos.length > 0 && <span className="text-rose-600 font-semibold"> · {vencidos.length} vencidos</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-[#0890F1]/30 text-[#0890F1]">
            Hito: 1er toque · {fmtShort(cur.end)}
          </span>
          <button
            onClick={onToggle}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
              active ? 'bg-[#0890F1] text-white' : 'bg-white border border-[#0890F1]/30 text-[#0890F1] hover:bg-[#0890F1]/10'
            }`}
          >
            {active ? '✓ Viendo mi ola' : 'Ver solo mi ola →'}
          </button>
        </div>
      </div>
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
            <th className="px-3 py-3 font-medium">Segmento</th>
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
              <td className="px-3 py-3 text-gray-500 text-xs">{c.segment || '—'}</td>
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
