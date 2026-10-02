'use client';

import { useState } from 'react';
import type { ReactListType } from '@/lib/reactivation';

type Result = {
  inserted: number; updated: number; total: number; sheets: Record<string, number>;
  control?: { total: number; byRecency: Record<string, number> };
};

// Import modal: upload .xlsx or paste text (TSV/CSV).
// Re-importable every month without duplicating (matched by phone in the backend).
export default function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<'archivo' | 'pegar'>('archivo');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [pasteList, setPasteList] = useState<ReactListType>('reactivacion');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // Build control group (to measure): sets aside N NEW clients, stratified by recency.
  const [controlOn, setControlOn] = useState(false);
  const [controlSize, setControlSize] = useState(30);

  const submit = async () => {
    setError(null); setResult(null); setBusy(true);
    try {
      let res: Response;
      if (tab === 'archivo') {
        if (!file) { setError('Choose a .xlsx file'); setBusy(false); return; }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('controlSize', String(controlOn ? controlSize : 0));
        res = await fetch('/api/reactivation/import', { method: 'POST', body: fd });
      } else {
        if (!text.trim()) { setError('Paste the table first'); setBusy(false); return; }
        res = await fetch('/api/reactivation/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, list_type: pasteList, controlSize: controlOn ? controlSize : 0 }),
        });
      }
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not import.'); return; }
      setResult(data);
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Import the month's list</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="p-5">
          {result ? (
            <div className="text-center py-4">
              <p className="text-4xl mb-2">✅</p>
              <p className="font-semibold text-gray-900">Import done</p>
              <p className="text-sm text-gray-600 mt-1">
                {result.inserted} new · {result.updated} updated · {result.total} in total
              </p>
              <div className="text-xs text-gray-400 mt-2">
                {Object.entries(result.sheets).map(([s, n]) => <div key={s}>{s}: {n}</div>)}
              </div>
              {result.control && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-3">
                  🎛️ Control group built: <b>{result.control.total}</b> untouched clients
                  {' '}(recent {result.control.byRecency.reciente ?? 0} · mid {result.control.byRecency.medio ?? 0} · old {result.control.byRecency.viejo ?? 0}).
                </p>
              )}
              <button onClick={onDone} className="mt-4 px-4 py-2 rounded-lg bg-[#0890F1] text-white font-medium">View the list</button>
            </div>
          ) : (
            <>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
                <button onClick={() => setTab('archivo')} className={`flex-1 text-sm py-1.5 rounded-md ${tab === 'archivo' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>📄 .xlsx file</button>
                <button onClick={() => setTab('pegar')} className={`flex-1 text-sm py-1.5 rounded-md ${tab === 'pegar' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>📋 Paste table</button>
              </div>

              {tab === 'archivo' ? (
                <div>
                  <label className="block border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#0890F1]/40">
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    <p className="text-3xl mb-1">⬆️</p>
                    <p className="text-sm text-gray-600">{file ? file.name : 'Click to choose the month\'s Excel'}</p>
                    <p className="text-xs text-gray-400 mt-1">Reads the Reactivation, First repurchase and Exclude sheets.</p>
                  </label>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500">Goes to list:</span>
                    <select value={pasteList} onChange={(e) => setPasteList(e.target.value as ReactListType)} className="text-sm border border-gray-200 rounded-lg px-2 py-1">
                      <option value="reactivacion">Reactivation</option>
                      <option value="primera_recompra">First repurchase</option>
                      <option value="excluir">Exclude / Review</option>
                    </select>
                  </div>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono"
                    placeholder={'Paste from Excel (include the header row):\nName\tPhone\tLast order\tDays since last order\t...'} />
                </div>
              )}

              {/* Build control group to measure (only over the new reactivation clients) */}
              <label className="flex items-start gap-2 mt-4 rounded-lg border border-gray-200 bg-gray-50/60 p-3 cursor-pointer">
                <input type="checkbox" checked={controlOn} onChange={(e) => setControlOn(e.target.checked)} className="mt-0.5" />
                <span className="text-xs text-gray-600">
                  <b className="text-gray-800">Build a control group to measure</b> — set aside{' '}
                  <input type="number" min={0} max={200} value={controlSize} disabled={!controlOn}
                    onChange={(e) => setControlSize(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-center disabled:opacity-50" onClick={(e) => e.stopPropagation()} />
                  {' '}new clients (spread by age) to leave untouched and compare. Only applies to the new ones, not those already in the list.
                </span>
              </label>

              {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-3">{error}</p>}

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm">Cancel</button>
                <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
                  {busy ? 'Importing…' : 'Import'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
