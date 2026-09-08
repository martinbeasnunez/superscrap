'use client';

import { useState } from 'react';
import type { ReactListType } from '@/lib/reactivation';

type Result = { inserted: number; updated: number; total: number; sheets: Record<string, number> };

// Modal de import: subir .xlsx o pegar texto (TSV/CSV).
// Re-importable cada mes sin duplicar (match por teléfono en el backend).
export default function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<'archivo' | 'pegar'>('archivo');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [pasteList, setPasteList] = useState<ReactListType>('reactivacion');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const submit = async () => {
    setError(null); setResult(null); setBusy(true);
    try {
      let res: Response;
      if (tab === 'archivo') {
        if (!file) { setError('Elige un archivo .xlsx'); setBusy(false); return; }
        const fd = new FormData();
        fd.append('file', file);
        res = await fetch('/api/reactivation/import', { method: 'POST', body: fd });
      } else {
        if (!text.trim()) { setError('Pega la tabla primero'); setBusy(false); return; }
        res = await fetch('/api/reactivation/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, list_type: pasteList }),
        });
      }
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo importar.'); return; }
      setResult(data);
    } catch {
      setError('Error de red.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Importar lista del mes</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="p-5">
          {result ? (
            <div className="text-center py-4">
              <p className="text-4xl mb-2">✅</p>
              <p className="font-semibold text-gray-900">Import listo</p>
              <p className="text-sm text-gray-600 mt-1">
                {result.inserted} nuevos · {result.updated} actualizados · {result.total} en total
              </p>
              <div className="text-xs text-gray-400 mt-2">
                {Object.entries(result.sheets).map(([s, n]) => <div key={s}>{s}: {n}</div>)}
              </div>
              <button onClick={onDone} className="mt-4 px-4 py-2 rounded-lg bg-[#0890F1] text-white font-medium">Ver la lista</button>
            </div>
          ) : (
            <>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
                <button onClick={() => setTab('archivo')} className={`flex-1 text-sm py-1.5 rounded-md ${tab === 'archivo' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>📄 Archivo .xlsx</button>
                <button onClick={() => setTab('pegar')} className={`flex-1 text-sm py-1.5 rounded-md ${tab === 'pegar' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>📋 Pegar tabla</button>
              </div>

              {tab === 'archivo' ? (
                <div>
                  <label className="block border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#0890F1]/40">
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    <p className="text-3xl mb-1">⬆️</p>
                    <p className="text-sm text-gray-600">{file ? file.name : 'Click para elegir el Excel del mes'}</p>
                    <p className="text-xs text-gray-400 mt-1">Lee las hojas Reactivación, Primera recompra y Excluir.</p>
                  </label>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500">Va a la lista:</span>
                    <select value={pasteList} onChange={(e) => setPasteList(e.target.value as ReactListType)} className="text-sm border border-gray-200 rounded-lg px-2 py-1">
                      <option value="reactivacion">Reactivación</option>
                      <option value="primera_recompra">Primera recompra</option>
                      <option value="excluir">Excluir / Revisar</option>
                    </select>
                  </div>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono"
                    placeholder={'Pega desde Excel (incluye la fila de headers):\nNombre\tTeléfono\tÚltima orden\tDías sin pedir\t...'} />
                </div>
              )}

              {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-3">{error}</p>}

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm">Cancelar</button>
                <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
                  {busy ? 'Importando…' : 'Importar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
