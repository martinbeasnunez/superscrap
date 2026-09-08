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

type ViewMode = 'tabla' | 'tablero';
type SortDir = 'asc' | 'desc';

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
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [selected, setSelected] = useState<ReactClient | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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

  const filtered = useMemo(() => {
    let arr = clients.filter((c) => {
      if (fTier !== 'all' && c.tier !== fTier) return false;
      if (fPriority !== 'all' && c.priority !== fPriority) return false;
      if (fOwner !== 'all' && c.owner !== fOwner) return false;
      if (fStatus !== 'all' && c.status !== fStatus) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      const av = a.days_inactive ?? -1;
      const bv = b.days_inactive ?? -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return arr;
  }, [clients, fTier, fPriority, fOwner, fStatus, sortDir]);

  const onUpdated = (updated: ReactClient) => {
    setClients((cur) => cur.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(updated);
  };

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

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="En lista" value={summary.total} />
        <SummaryCard label="Pendientes" value={summary.pending} tone="blue" />
        <SummaryCard label="Reactivados" value={summary.reactivated} tone="emerald" />
        <SummaryCard label="Control (no tocar)" value={summary.control} tone="rose" />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Select label="Tier" value={fTier} onChange={setFTier} options={[['all', 'Todos'], ['A', 'A'], ['B', 'B'], ['C', 'C']]} />
        <Select label="Prioridad" value={fPriority} onChange={setFPriority} options={[['all', 'Todas'], ['alta', 'Alta'], ['media', 'Media'], ['fria', 'Fría']]} />
        <Select label="Dueño" value={fOwner} onChange={setFOwner} options={[['all', 'Todos'], ...owners.map((o) => [o, o] as [string, string])]} />
        <Select label="Estado" value={fStatus} onChange={setFStatus} options={[['all', 'Todos'], ...REACT_STATUS_ORDER.map((s) => [s, REACT_STATUS_LABEL[s]] as [string, string])]} />
        {(fTier !== 'all' || fPriority !== 'all' || fOwner !== 'all' || fStatus !== 'all') && (
          <button onClick={() => { setFTier('all'); setFPriority('all'); setFOwner('all'); setFStatus('all'); }} className="text-xs text-gray-400 hover:text-gray-600">✕ limpiar</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} de {clients.length}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-3 border-[#0890F1] border-t-transparent rounded-full" />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState onImport={() => setImportOpen(true)} />
      ) : view === 'tabla' ? (
        <TableView
          rows={filtered}
          sortDir={sortDir}
          onToggleSort={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
          onSelect={setSelected}
        />
      ) : (
        <BoardView rows={filtered} onSelect={setSelected} />
      )}

      {selected && (
        <DetailDrawer client={selected} onClose={() => setSelected(null)} onUpdated={onUpdated} />
      )}
      {importOpen && (
        <ImportModal onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />
      )}
    </div>
  );
}

/* ---------- piezas ---------- */

function SummaryCard({ label, value, tone = 'gray' }: { label: string; value: number; tone?: string }) {
  const color = tone === 'blue' ? 'text-[#0890F1]' : tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
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
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {c.tier && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${TIER_STYLE[c.tier]}`}>Tier {c.tier}</span>}
      {c.priority && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${PRIORITY_STYLE[c.priority]}`}>{PRIORITY_LABEL[c.priority]}</span>}
      {c.is_control && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-rose-600 text-white">CONTROL</span>}
      {!c.is_control && c.needs_verify && c.tier === 'A' && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-yellow-100 text-yellow-800">⚠️ Verificar</span>}
      {needsSecondTouch(c) && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-orange-100 text-orange-700">📞 Toca 2do</span>}
    </div>
  );
}

function TableView({ rows, sortDir, onToggleSort, onSelect }: {
  rows: ReactClient[]; sortDir: SortDir; onToggleSort: () => void; onSelect: (c: ReactClient) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th className="px-4 py-3 font-medium">Empresa</th>
            <th className="px-3 py-3 font-medium">Dueño</th>
            <th className="px-3 py-3 font-medium cursor-pointer select-none hover:text-gray-700" onClick={onToggleSort}>
              Días sin pedir {sortDir === 'desc' ? '↓' : '↑'}
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
