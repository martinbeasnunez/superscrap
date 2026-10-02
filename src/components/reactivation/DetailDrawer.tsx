'use client';

import { useState } from 'react';
import { REACT_STATUS_LABEL, type ReactClient, type ReactChannel } from '@/lib/reactivation';
import { BRAND_DEFAULT } from '@/lib/reactivation-messages';
import { waveFor, targetTouch1, targetTouch2, overdue, fmtShort, todayISO } from '@/lib/reactivation-campaign';
import MessagesPanel from './MessagesPanel';

// Detail drawer: records campaign progress with the hard rules.
//  - Control → locked, nothing is recorded.
//  - Tier A + Verify → the review must be confirmed before enabling.
//  - Can't mark responded/reserved without a 1st-touch date.
//  - Suggested discount 10%, cap 15%.
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
  // 0 or empty → 10% by default (offering 0% makes no sense).
  const [discount, setDiscount] = useState<number>(client.discount_pct || 10);
  const [notes, setNotes] = useState(client.notes ?? '');
  const [contacto, setContacto] = useState(client.contact_name ?? '');
  const [brand, setBrand] = useState(client.brand ?? BRAND_DEFAULT);
  const [phone, setPhone] = useState(client.phone ?? '');
  const [email, setEmail] = useState(client.email ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tier A verification: persisted (not local). Joaquín confirms → Fernanda sees it enabled.
  const isVerified = !!client.verified_at;

  // 🔄 Reconnect: saves when to contact them again (the "next month")
  const [recontacting, setRecontacting] = useState(false);
  const setRecontact = async (date: string | null) => {
    setRecontacting(true);
    setError(null);
    try {
      const res = await fetch('/api/reactivation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: client.id, recontact_date: date }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not schedule.'); return; }
      onUpdated(data.client);
    } catch {
      setError('Network error.');
    } finally {
      setRecontacting(false);
    }
  };
  // today's date + N days, in YYYY-MM-DD
  const inDays = (n: number) => {
    const d = new Date(); d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  // Mark outcome: alive / october / dead (or null to clear).
  const [outcoming, setOutcoming] = useState(false);
  const setOutcome = async (outcome: 'vivo' | 'octubre' | 'muerto' | null) => {
    setOutcoming(true);
    setError(null);
    try {
      const res = await fetch('/api/reactivation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: client.id, outcome }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not mark.'); return; }
      onUpdated(data.client);
    } catch {
      setError('Network error.');
    } finally {
      setOutcoming(false);
    }
  };
  // Discard: Joaquín reviewed and this one is NOT contacted (complaint/debtor/dropped out).
  const doDiscard = async () => {
    const reason = prompt('Why is this one not contacted? (complaint, debtor, left, etc.)', client.notes || '');
    if (reason === null) return; // cancelled
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/reactivation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: client.id, discard: true, reason: reason.trim() || client.notes || 'Do not contact' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not discard.'); return; }
      onDeleted(client.id); // leaves this list (goes to "Exclude")
      onClose();
    } catch {
      setError('Network error.');
    } finally {
      setVerifying(false);
    }
  };

  const doVerify = async (val: boolean) => {
    setVerifying(true);
    setError(null);
    let me: string | null = null;
    try { me = JSON.parse(localStorage.getItem('orbit_user') || '{}').name || null; } catch { /* ignore */ }
    try {
      const res = await fetch('/api/reactivation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: client.id, verify: val, verified_by: me }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not verify.'); return; }
      onUpdated(data.client);
    } catch {
      setError('Network error.');
    } finally {
      setVerifying(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${client.company}" from the list? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reactivation?id=${client.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Could not delete.'); return; }
      onDeleted(client.id);
      onClose();
    } catch {
      setError('Network error.');
    } finally {
      setDeleting(false);
    }
  };

  const isControl = client.is_control;
  const mustVerify = !isControl && client.needs_verify && client.tier === 'A';
  const locked = isControl || (mustVerify && !isVerified);
  const canMarkOutcome = !!t1Date; // rule: no responded/reserved without a 1st touch

  const save = async () => {
    setError(null);
    if (isControl) { setError('CONTROL client: touches are not recorded.'); return; }
    if ((responded != null || reserved != null) && !t1Date) {
      setError('First set the date you contacted them.');
      return;
    }
    if (t1Chan && !t1Date) { setError('The 1st contact needs a date.'); return; }
    if (t2Chan && !t2Date && t2Date !== '') { /* default channel ok */ }
    if (t2Date && !t2Chan) { setError('Choose the channel for the 2nd round.'); return; }

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
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not save.'); return; }
      onUpdated(data.client);
      onClose();
    } catch {
      setError('Network error.');
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
              <p className="text-sm text-gray-500">{client.phone || 'no phone'}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>{client.days_inactive ?? '—'} days since last order</span>
            <span>·</span>
            <span>{client.total_orders ?? '—'} orders</span>
            <span>·</span>
            <span>{client.owner || 'no owner'}</span>
          </div>
          {/* Wave + target date (deadline right on the card) */}
          {(() => {
            const wave = waveFor(client);
            if (!wave) return null;
            const t1 = targetTouch1(client);
            const t2 = targetTouch2(client);
            const isOverdue = overdue(client, todayISO()) !== null;
            return (
              <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">Week {wave}</span>
                <span className="text-gray-500">
                  {client.touch1_date
                    ? <>Call before <b>{fmtShort(t2)}</b></>
                    : <>Contact before <b>{fmtShort(t1)}</b></>}
                </span>
                {isOverdue && <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 font-bold">⚠ Overdue</span>}
              </div>
            );
          })()}
        </div>

        <div className="p-5 space-y-5">
          {isControl && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
              <p className="font-semibold text-rose-700 text-sm">🔒 CONTROL group — DO NOT contact</p>
              <p className="text-sm text-rose-600 mt-1">
                We leave this client <b>deliberately uncontacted</b>. It serves as a comparison: if the ones we do
                contact come back more than the control group, we know the campaign worked. If you contact them,
                you ruin the measurement.
              </p>
            </div>
          )}

          {mustVerify && !isControl && (
            isVerified ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <p className="font-semibold text-emerald-700 text-sm">✅ Big account reviewed{client.verified_by ? ` by ${client.verified_by}` : ''}</p>
                <p className="text-sm text-emerald-600 mt-1">
                  Enabled for <b>Fernanda's call</b>.
                  {client.verified_at ? ` (${new Date(client.verified_at).toLocaleDateString('en-US')})` : ''}
                </p>
                <button onClick={() => doVerify(false)} disabled={verifying} className="mt-1 text-xs text-emerald-700 underline disabled:opacity-50">Remove verification</button>
              </div>
            ) : (
              <div className="rounded-xl bg-yellow-50 border border-yellow-300 p-4">
                <p className="font-semibold text-yellow-800 text-sm">⏳ Big account — waiting for <b>Joaquín</b> to review it</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Joaquín checks it has no fixed pickup (OXXO type), no open complaint, and <b>no debt/pending payment</b>.
                  If there's any issue, write it in Notes and leave it locked.
                  <b> If it's clean, once confirmed Fernanda can call.</b>
                </p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <button onClick={() => doVerify(true)} disabled={verifying}
                    className="text-sm font-medium px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50">
                    {verifying ? 'Saving…' : '✓ It\'s clean, enable Fer'}
                  </button>
                  <button onClick={doDiscard} disabled={verifying}
                    className="text-sm font-medium px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                    🚫 Has an issue · do not contact
                  </button>
                </div>
              </div>
            )
          )}

          {/* Quick usage guide (so nobody gets confused) */}
          {!isControl && !locked && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
              <b>How to use it:</b> 1) copy and send the message · 2) set the touch date · 3) when they reply, mark whether they responded and whether they ordered again.
            </div>
          )}

          {/* Contact details (editable — fix here if the number is outdated) */}
          {!isControl && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500">
                  📱 Phone <span className="text-gray-400">(fix if outdated)</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51…"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                </label>
                <label className="text-xs text-gray-500">
                  ✉️ Email <span className="text-gray-400">(alternate channel)</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@company.com"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500">
                  Contact (person)
                  <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder={client.company}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                </label>
                <label className="text-xs text-gray-500">
                  Brand in the text
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={BRAND_DEFAULT}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                </label>
              </div>
            </div>
          )}

          {/* Ready-to-copy/paste messages by Tier */}
          {!isControl && (
            <MessagesPanel client={client} contacto={contacto} brand={brand} descuento={discount} locked={locked} />
          )}

          {/* 1st touch */}
          <fieldset disabled={locked} className={locked ? 'opacity-50' : ''}>
            <legend className="text-sm font-semibold text-gray-900 mb-2">2. Record when you contacted them <span className="font-normal text-gray-400">· set the date</span></legend>
            <div className="flex gap-2">
              <input type="date" value={t1Date} onChange={(e) => setT1Date(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <ChannelPick value={t1Chan} onChange={setT1Chan} />
            </div>
          </fieldset>

          {/* 2nd touch */}
          <fieldset disabled={locked} className={locked ? 'opacity-50' : ''}>
            <legend className="text-sm font-semibold text-gray-900 mb-2">2nd round <span className="font-normal text-gray-400">· call them after 7 days if they didn't reply</span></legend>
            <div className="flex gap-2">
              <input type="date" value={t2Date} onChange={(e) => setT2Date(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <ChannelPick value={t2Chan} onChange={setT2Chan} />
            </div>
          </fieldset>

          {/* Result */}
          <fieldset disabled={locked} className={locked ? 'opacity-50' : ''}>
            <legend className="text-sm font-semibold text-gray-900 mb-2">3. What happened?</legend>
            {!canMarkOutcome && !locked && (
              <p className="text-xs text-amber-600 mb-2">Set the 1st-contact date to enable this.</p>
            )}
            <div className="space-y-2">
              <TriToggle label="Responded?" value={responded} onChange={setResponded} disabled={!canMarkOutcome} />
              <TriToggle label="Ordered again?" value={reserved} onChange={setReserved} disabled={!canMarkOutcome} />
            </div>
          </fieldset>

          {/* Account outcome: alive / october / dead */}
          {!isControl && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
              <p className="text-sm font-semibold text-gray-900">Where did it land?</p>
              <p className="text-xs text-gray-500 mt-0.5">Mark it based on what they told you, so you can see it at a glance in the list.</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {([
                  ['vivo', '🟢 Alive · in play', 'emerald'],
                  ['octubre', '🟡 Comes back in October', 'amber'],
                  ['muerto', '⚫ Dead · not coming back', 'gray'],
                ] as const).map(([val, label, c]) => {
                  const on = client.outcome === val;
                  const ring = c === 'emerald' ? 'bg-emerald-600 text-white' : c === 'amber' ? 'bg-amber-500 text-white' : 'bg-gray-600 text-white';
                  return (
                    <button
                      key={val}
                      onClick={() => setOutcome(on ? null : val)}
                      disabled={outcoming}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border disabled:opacity-50 ${on ? ring + ' border-transparent' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 🔄 Reconnect: schedule when to contact again ("next month") */}
          {!isControl && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3">
              <p className="text-sm font-semibold text-gray-900">🔄 Reconnect</p>
              {client.recontact_date ? (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-teal-800">Scheduled for <b>{new Date(client.recontact_date + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</b></span>
                  <button onClick={() => setRecontact(null)} disabled={recontacting} className="text-xs text-gray-500 underline disabled:opacity-50">remove</button>
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-0.5">Did they say &quot;next month&quot;? Schedule when to call them again.</p>
              )}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <button onClick={() => setRecontact(inDays(7))} disabled={recontacting} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white border border-teal-300 text-teal-700 hover:bg-teal-100 disabled:opacity-50">In 1 week</button>
                <button onClick={() => setRecontact(inDays(15))} disabled={recontacting} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white border border-teal-300 text-teal-700 hover:bg-teal-100 disabled:opacity-50">In 2 weeks</button>
                <button onClick={() => setRecontact(inDays(30))} disabled={recontacting} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">In 1 month</button>
                <input type="date" onChange={(e) => e.target.value && setRecontact(e.target.value)} disabled={recontacting} className="text-xs border border-teal-300 rounded-lg px-2 py-1" title="Other date" />
              </div>
            </div>
          )}

          {/* Discount */}
          <fieldset disabled={locked} className={locked ? 'opacity-50' : ''}>
            <legend className="text-sm font-semibold text-gray-900 mb-2">Discount offered</legend>
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={15} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="flex-1" />
              <span className={`text-sm font-bold w-12 text-right ${discount > 15 ? 'text-rose-600' : 'text-gray-900'}`}>{discount}%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Suggested 10% · cap 15%</p>
          </fieldset>

          {/* Notes */}
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-2 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={locked}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="Context, objections, next steps…" />
          </div>

          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={remove} disabled={deleting} className="text-xs text-rose-500 hover:text-rose-700 disabled:opacity-50" title="Delete this card">
              {deleting ? 'Deleting…' : '🗑 Delete'}
            </button>
            <span className="text-xs text-gray-400 flex-1 text-right">Status: <b>{REACT_STATUS_LABEL[client.status]}</b></span>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm">Cancel</button>
            <button onClick={save} disabled={saving || isControl}
              className="px-4 py-2 rounded-lg bg-[#0890F1] hover:bg-[#0770C5] text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
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
        {opt(true, 'Yes', 'bg-emerald-500 text-white border-emerald-500')}
        {opt(false, 'No', 'bg-rose-500 text-white border-rose-500')}
      </div>
    </div>
  );
}
