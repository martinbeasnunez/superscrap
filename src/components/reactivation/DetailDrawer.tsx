'use client';

import { useState } from 'react';
import { REACT_STATUS_LABEL, type ReactClient, type ReactChannel } from '@/lib/reactivation';
import { BRAND_DEFAULT } from '@/lib/reactivation-messages';
import { waveFor, targetTouch1, targetTouch2, overdue, fmtShort, todayISO } from '@/lib/reactivation-campaign';
import MessagesPanel from './MessagesPanel';

// Drawer de detalle: registra el progreso de campaña con las reglas duras.
//  - Control → bloqueado, no se registra nada.
//  - Tier A + Verificar → hay que confirmar la revisión antes de habilitar.
//  - No se puede marcar respondió/reservó sin fecha de 1er toque.
//  - Descuento sugerido 10%, tope 15%.
export default function DetailDrawer({
  client,
  onClose,
  onUpdated,
  onDeleted,
}: {
  client: ReactClient;
  onClose: () => void;
  onUpdated: (c: ReactClient) => void;
  onDeleted: (id: string) => void;
}) {
  const [t1Date, setT1Date] = useState(client.touch1_date ?? '');
  const [t1Chan, setT1Chan] = useState<ReactChannel | ''>(client.touch1_channel ?? '');
  const [t2Date, setT2Date] = useState(client.touch2_date ?? '');
  const [t2Chan, setT2Chan] = useState<ReactChannel | ''>(client.touch2_channel ?? 'call');
  const [responded, setResponded] = useState<boolean | null>(client.responded);
  const [reserved, setReserved] = useState<boolean | null>(client.reserved);
  const [discount, setDiscount] = useState<number>(client.discount_pct ?? 10);
  const [notes, setNotes] = useState(client.notes ?? '');
  const [contacto, setContacto] = useState(client.contact_name ?? '');
  const [brand, setBrand] = useState(client.brand ?? BRAND_DEFAULT);
  const [phone, setPhone] = useState(client.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyAck, setVerifyAck] = useState(false);

  const remove = async () => {
    if (!confirm(`¿Borrar "${client.company}" de la lista? Esto no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reactivation?id=${client.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'No se pudo borrar.'); return; }
      onDeleted(client.id);
      onClose();
    } catch {
      setError('Error de red.');
    } finally {
      setDeleting(false);
    }
  };

  const isControl = client.is_control;
  const mustVerify = !isControl && client.needs_verify && client.tier === 'A';
  const locked = isControl || (mustVerify && !verifyAck);
  const canMarkOutcome = !!t1Date; // regla: sin 1er toque no hay respondió/reservó

  const save = async () => {
    setError(null);
    if (isControl) { setError('Cliente de CONTROL: no se registran toques.'); return; }
    if ((responded != null || reserved != null) && !t1Date) {
      setError('Marca primero la fecha del 1er toque.');
      return;
    }
    if (t1Chan && !t1Date) { setError('El 1er toque necesita fecha.'); return; }
    if (t2Chan && !t2Date && t2Date !== '') { /* canal por defecto ok */ }
    if (t2Date && !t2Chan) { setError('Elige el canal del 2do toque.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/reactivation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: client.id,
          touch1_date: t1Date || null,
          touch1_channel: t1Chan || null,
          touch2_date: t2Date || null,
          touch2_channel: t2Date ? (t2Chan || 'call') : null,
          responded,
          reserved,
          discount_pct: discount,
          notes,
          contact_name: contacto,
          brand,
          phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo guardar.'); return; }
      onUpdated(data.client);
      onClose();
    } catch {
      setError('Error de red.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl overflow-y-auto">
        {/* header */}
        <div className={`px-5 py-4 border-b ${isControl ? 'bg-rose-50 border-rose-200' : 'border-gray-100'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">{client.company}</h3>
              <p className="text-sm text-gray-500">{client.phone || 'sin teléfono'}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>{client.days_inactive ?? '—'} días sin pedir</span>
            <span>·</span>
            <span>{client.total_orders ?? '—'} pedidos</span>
            <span>·</span>
            <span>{client.owner || 'sin dueño'}</span>
          </div>
          {/* Ola + fecha objetivo (deadline en la propia ficha) */}
          {(() => {
            const wave = waveFor(client);
            if (!wave) return null;
            const t1 = targetTouch1(client);
            const t2 = targetTouch2(client);
            const isOverdue = overdue(client, todayISO()) !== null;
            return (
              <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">Ola {wave}</span>
                <span className="text-gray-500">
                  {client.touch1_date
                    ? <>2do toque objetivo: <b>{fmtShort(t2)}</b></>
                    : <>1er toque objetivo: <b>{fmtShort(t1)}</b></>}
                </span>
                {isOverdue && <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 font-bold">⚠ Vencido</span>}
              </div>
            );
          })()}
        </div>

        <div className="p-5 space-y-5">
          {isControl && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
              <p className="font-semibold text-rose-700 text-sm">🔒 Grupo de CONTROL — NO contactar</p>
              <p className="text-sm text-rose-600 mt-1">
                Este cliente lo dejamos <b>sin contactar a propósito</b>. Sirve de comparación: si los que sí
                contactamos vuelven más que los del control, sabemos que la campaña funcionó. Si lo contactas,
                arruinas la medición.
              </p>
            </div>
          )}

          {mustVerify && !isControl && (
            <div className="rounded-xl bg-yellow-50 border border-yellow-300 p-4">
              <p className="font-semibold text-yellow-800 text-sm">⚠️ Tier A · Verificar antes de escribir</p>
              <p className="text-sm text-yellow-700 mt-1">Puede tener recojo fijo (tipo OXXO) o un reclamo abierto. Revisa antes de contactar.</p>
              {!verifyAck && (
                <button onClick={() => setVerifyAck(true)} className="mt-2 text-sm font-medium px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white">
                  Ya verifiqué, habilitar contacto
                </button>
              )}
            </div>
          )}

          {/* Guía rápida de uso (para que nadie se confunda) */}
          {!isControl && !locked && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
              <b>Cómo se usa:</b> 1) copia y manda el mensaje · 2) pon la fecha del toque · 3) cuando responda, marca si respondió y si volvió a pedir.
            </div>
          )}

          {/* Datos de contacto (editables — corrige aquí si el número está viejo) */}
          {!isControl && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500 block">
                📱 Teléfono <span className="text-gray-400">(si está desactualizado, corrígelo — el link de WhatsApp usa este número)</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51…"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500">
                  Contacto (persona)
                  <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder={client.company}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                </label>
                <label className="text-xs text-gray-500">
                  Marca en el texto
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={BRAND_DEFAULT}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                </label>
              </div>
            </div>
          )}

          {/* Mensajes listos para copiar/pegar según Tier */}
          {!isControl && (
            <MessagesPanel client={client} contacto={contacto} brand={brand} descuento={discount} locked={locked} />
          )}

          {/* 1er toque */}
          <fieldset disabled={locked} className={locked ? 'opacity-50' : ''}>
            <legend className="text-sm font-semibold text-gray-900 mb-2">2. Anota tu toque <span className="font-normal text-gray-400">· pon la fecha</span></legend>
            <div className="flex gap-2">
              <input type="date" value={t1Date} onChange={(e) => setT1Date(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <ChannelPick value={t1Chan} onChange={setT1Chan} />
            </div>
          </fieldset>

          {/* 2do toque */}
          <fieldset disabled={locked} className={locked ? 'opacity-50' : ''}>
            <legend className="text-sm font-semibold text-gray-900 mb-2">2do toque <span className="font-normal text-gray-400">· a los 7 días, preferente llamada</span></legend>
            <div className="flex gap-2">
              <input type="date" value={t2Date} onChange={(e) => setT2Date(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <ChannelPick value={t2Chan} onChange={setT2Chan} />
            </div>
          </fieldset>

          {/* Resultado */}
          <fieldset disabled={locked} className={locked ? 'opacity-50' : ''}>
            <legend className="text-sm font-semibold text-gray-900 mb-2">3. ¿Qué pasó?</legend>
            {!canMarkOutcome && !locked && (
              <p className="text-xs text-amber-600 mb-2">Registra la fecha del 1er toque para habilitar esto.</p>
            )}
            <div className="space-y-2">
              <TriToggle label="¿Respondió?" value={responded} onChange={setResponded} disabled={!canMarkOutcome} />
              <TriToggle label="¿Volvió a pedir?" value={reserved} onChange={setReserved} disabled={!canMarkOutcome} />
            </div>
          </fieldset>

          {/* Descuento */}
          <fieldset disabled={locked} className={locked ? 'opacity-50' : ''}>
            <legend className="text-sm font-semibold text-gray-900 mb-2">Descuento ofrecido</legend>
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={15} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="flex-1" />
              <span className={`text-sm font-bold w-12 text-right ${discount > 15 ? 'text-rose-600' : 'text-gray-900'}`}>{discount}%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Sugerido 10% · tope 15%</p>
          </fieldset>

          {/* Notas */}
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={locked}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Contexto, objeciones, próximos pasos…" />
          </div>

          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={remove} disabled={deleting} className="text-xs text-rose-500 hover:text-rose-700 disabled:opacity-50" title="Borrar esta ficha">
              {deleting ? 'Borrando…' : '🗑 Borrar'}
            </button>
            <span className="text-xs text-gray-400 flex-1 text-right">Estado: <b>{REACT_STATUS_LABEL[client.status]}</b></span>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm">Cancelar</button>
            <button onClick={save} disabled={saving || isControl}
              className="px-4 py-2 rounded-lg bg-[#0890F1] hover:bg-[#0770C5] text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelPick({ value, onChange }: { value: ReactChannel | ''; onChange: (v: ReactChannel) => void }) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
      <button type="button" onClick={() => onChange('whatsapp')}
        className={`px-2.5 py-2 text-sm ${value === 'whatsapp' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>WA</button>
      <button type="button" onClick={() => onChange('call')}
        className={`px-2.5 py-2 text-sm border-l border-gray-200 ${value === 'call' ? 'bg-[#0890F1] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>📞</button>
    </div>
  );
}

function TriToggle({ label, value, onChange, disabled }: {
  label: string; value: boolean | null; onChange: (v: boolean | null) => void; disabled?: boolean;
}) {
  const opt = (v: boolean, txt: string, on: string) => (
    <button type="button" disabled={disabled} onClick={() => onChange(value === v ? null : v)}
      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-40 ${value === v ? on : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{txt}</button>
  );
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex gap-1.5">
        {opt(true, 'Sí', 'bg-emerald-500 text-white border-emerald-500')}
        {opt(false, 'No', 'bg-rose-500 text-white border-rose-500')}
      </div>
    </div>
  );
}
