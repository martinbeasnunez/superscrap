'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import type { HuntLeadCard } from '@/app/api/hunt/route';

// "Today's hunt" — the accounts the daily agentic hunt picked this morning.
// The Pipeline shows one card with a single call to action; "Start" opens a focus
// view that walks the accounts one by one. Each account ends in one outcome:
// contacted (sent + logged in one go), handed to the bot, saved for later, or discarded.
// Until that outcome the bot stays off for these leads.

interface HuntRun {
  hunt_date: string;
  quota: number | null;
  summary: string | null;
}
interface HuntData {
  ready: boolean;
  today?: string;
  pending: HuntLeadCard[];
  decidedToday: { humano: number; bot: number; descartado: number };
  run: HuntRun | null;
}

type Outcome = 'contacted' | 'bot' | 'later' | 'discarded';
type Channel = 'whatsapp' | 'email' | 'call';
type Vars = Record<string, string | number>;

const DISCARD_REASONS = ['hunt.r_small', 'hunt.r_fit', 'hunt.r_known', 'hunt.r_coverage', 'hunt.r_other'];

const OUTCOME_STYLE: Record<Outcome, { bar: string; pill: string; label: string }> = {
  contacted: { bar: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'hunt.out_contacted' },
  bot: { bar: 'bg-purple-500', pill: 'bg-purple-50 text-purple-700 border-purple-200', label: 'hunt.out_bot' },
  later: { bar: 'bg-amber-400', pill: 'bg-amber-50 text-amber-700 border-amber-200', label: 'hunt.out_later' },
  discarded: { bar: 'bg-gray-400', pill: 'bg-gray-100 text-gray-600 border-gray-200', label: 'hunt.out_discarded' },
};

function money(n: number): string {
  if (n >= 1000) return `S/${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `S/${n}`;
}

function waLink(phone: string, text: string): string {
  const c = phone.replace(/\D/g, '').replace(/^0+/, '');
  const full = c.startsWith('51') ? c : `51${c}`;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

function channelsFor(lead: HuntLeadCard): Channel[] {
  const list: Channel[] = [];
  if (lead.phone && lead.phoneIsMobile) list.push('whatsapp');
  if (lead.email) list.push('email');
  if (lead.phone) list.push('call');
  return list;
}

function currentUserId(): string {
  try { return JSON.parse(localStorage.getItem('orbit_user') || 'null')?.id || ''; } catch { return ''; }
}

export default function TodaysHunt() {
  const { t } = useI18n();
  const tt = useCallback(
    (key: string, vars?: Vars) =>
      Object.entries(vars || {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), t(key)),
    [t],
  );

  const [data, setData] = useState<HuntData | null>(null);
  // Focus view: a snapshot of the pending accounts taken when it opens, so the deck
  // doesn't shift under the user while they decide.
  const [queue, setQueue] = useState<HuntLeadCard[] | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/hunt');
      if (!res.ok) return;
      setData(await res.json());
    } catch { /* the card just stays hidden */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = useCallback(
    async (
      lead: HuntLeadCard,
      decision: 'humano' | 'bot' | 'descartado',
      extra?: { reason?: string; contact?: { channel: Channel; message: string } },
    ): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch('/api/hunt/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ huntLeadId: lead.id, decision, userId: currentUserId(), ...extra }),
        });
        if (!res.ok) throw new Error('decide failed');
        const outcome: Outcome =
          decision === 'bot' ? 'bot' : decision === 'descartado' ? 'discarded' : extra?.contact ? 'contacted' : 'later';
        setOutcomes((o) => ({ ...o, [lead.id]: outcome }));
        load();
        return true;
      } catch {
        setError(t('hunt.error'));
        return false;
      }
    },
    [load, t],
  );

  const pending = useMemo(() => data?.pending ?? [], [data]);
  // Bulk hand-off only covers what the hunt itself routed to the bot: normal accounts with a mobile.
  const botEligible = useMemo(
    () => pending.filter((l) => l.suggestedRoute === 'bot' && l.phoneIsMobile),
    [pending],
  );

  const handAllToBot = async () => {
    setBulkBusy(true);
    for (const lead of botEligible) await decide(lead, 'bot');
    setBulkBusy(false);
    setBulkConfirm(false);
  };

  if (!data?.ready) return null;
  const { decidedToday, run } = data;
  const decidedCount = decidedToday.humano + decidedToday.bot + decidedToday.descartado;
  if (pending.length === 0 && decidedCount === 0 && !queue) return null;

  const revMin = pending.reduce((s, l) => s + (l.revenueMin || 0), 0);
  const revMax = pending.reduce((s, l) => s + (l.revenueMax || 0), 0);

  return (
    <>
      {pending.length === 0 ? (
        // ---- All decided: a quiet confirmation line ----
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs">✓</span>
          <span className="font-semibold text-sm text-emerald-900">{t('hunt.done_title')}</span>
          <span className="text-sm text-emerald-800/80">
            {decidedToday.humano} {t('hunt.tally_later')} / {t('hunt.tally_contacted')} · {decidedToday.bot} {t('hunt.tally_bot')} · {decidedToday.descartado} {t('hunt.tally_discarded')}
          </span>
          <span className="text-xs text-emerald-800/60 ml-auto">{t('hunt.done_sub')}</span>
        </div>
      ) : (
        // ---- Accounts waiting: one card, one call to action ----
        <div className="rounded-2xl mb-4 p-[1.5px] bg-gradient-to-r from-[#0890F1] via-emerald-400 to-[#0890F1] shadow-sm">
          <div className="rounded-[14px] bg-white px-4 sm:px-5 py-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1 basis-full sm:basis-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0890F1]">🎯 {t('hunt.title')}</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 mt-0.5">
                  {pending.length === 1 ? t('hunt.hero_count_one') : tt('hunt.hero_count', { n: pending.length })}
                </p>
                {revMax > 0 && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {tt('hunt.potential', { range: `${money(revMin)}–${money(revMax)}` })}
                  </p>
                )}
              </div>
              <button
                onClick={() => { setQueue(pending); setError(null); }}
                className="flex items-center justify-center gap-2 w-full sm:w-auto bg-[#0890F1] hover:bg-[#0779cc] text-white font-semibold text-sm sm:text-base px-5 py-3 rounded-xl shadow-sm transition-colors"
              >
                {decidedCount > 0 ? t('hunt.continue') : t('hunt.start')}
                <span className="text-white/70 font-normal text-xs sm:text-sm">{tt('hunt.minutes', { n: pending.length })}</span>
                <span aria-hidden>→</span>
              </button>
            </div>

            {/* What happens when you press Start */}
            <ol className="grid sm:grid-cols-3 gap-2 mt-4">
              {['hunt.step1', 'hunt.step2', 'hunt.step3'].map((key, i) => (
                <li key={key} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-700 flex-shrink-0">
                    {i + 1}
                  </span>
                  {t(key)}
                </li>
              ))}
            </ol>

            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              {pending.slice(0, 5).map((l) => (
                <span key={l.id} className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs bg-gray-100 text-gray-700 max-w-[11rem] truncate">
                  {l.name}
                </span>
              ))}
              {pending.length > 5 && <span className="text-xs text-gray-400">+{pending.length - 5}</span>}

              {botEligible.length > 0 && (
                <span className="ml-auto flex items-center gap-2">
                  {bulkConfirm ? (
                    <>
                      <span className="text-xs text-gray-500">{t('hunt.bot_hint')}</span>
                      <button
                        disabled={bulkBusy}
                        onClick={handAllToBot}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        🤖 {tt('hunt.bulk_bot', { n: botEligible.length })}
                      </button>
                      <button onClick={() => setBulkConfirm(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                    </>
                  ) : (
                    <button
                      onClick={() => setBulkConfirm(true)}
                      title={t('hunt.bulk_bot_hint')}
                      className="text-xs font-medium text-purple-700 hover:underline"
                    >
                      🤖 {tt('hunt.bulk_bot', { n: botEligible.length })}
                    </button>
                  )}
                </span>
              )}
            </div>

            {run?.summary && (
              <p className="text-xs text-gray-500 mt-3 line-clamp-2">
                <span className="font-medium text-gray-700">{t('hunt.strategist')}:</span> {run.summary}
              </p>
            )}
            {error && !queue && <p className="text-xs text-rose-600 mt-2">{error}</p>}
          </div>
        </div>
      )}

      {queue && (
        <HuntFocus
          queue={queue}
          today={data.today}
          outcomes={outcomes}
          error={error}
          tt={tt}
          decide={decide}
          onClose={() => { setQueue(null); load(); }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Focus view: one account at a time, one obvious next step.
// ---------------------------------------------------------------------------

function HuntFocus({
  queue, today, outcomes, error, tt, decide, onClose,
}: {
  queue: HuntLeadCard[];
  today?: string;
  outcomes: Record<string, Outcome>;
  error: string | null;
  tt: (key: string, vars?: Vars) => string;
  decide: (
    lead: HuntLeadCard,
    decision: 'humano' | 'bot' | 'descartado',
    extra?: { reason?: string; contact?: { channel: Channel; message: string } },
  ) => Promise<boolean>;
  onClose: () => void;
}) {
  // idx === queue.length → the wrap-up screen
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [channelPick, setChannelPick] = useState<Record<string, Channel>>({});
  const [confirming, setConfirming] = useState<Channel | null>(null);
  const [callNote, setCallNote] = useState('');
  const [showReasons, setShowReasons] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const lead = idx < queue.length ? queue[idx] : null;

  const goTo = useCallback((i: number) => {
    setIdx(Math.max(0, Math.min(queue.length, i)));
    setConfirming(null);
    setShowReasons(false);
    setCallNote('');
    setCopied(false);
  }, [queue.length]);

  // After an outcome: jump to the next account still undecided, or wrap up.
  const advance = useCallback((justDecidedId: string) => {
    const open = (l: HuntLeadCard) => !outcomes[l.id] && l.id !== justDecidedId;
    const after = queue.findIndex((l, i) => i > idx && open(l));
    const before = queue.findIndex((l) => open(l));
    goTo(after !== -1 ? after : before !== -1 ? before : queue.length);
  }, [queue, idx, outcomes, goTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return;
      if (e.key === 'ArrowRight') goTo(idx + 1);
      if (e.key === 'ArrowLeft') goTo(idx - 1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [idx, goTo, onClose]);

  const run = async (fn: () => Promise<boolean>, id: string) => {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok) advance(id);
  };

  const tally = (o: Outcome) => queue.filter((l) => outcomes[l.id] === o).length;
  const undecided = queue.filter((l) => !outcomes[l.id]).length;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress */}
        <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0890F1]">
              🎯 {tt('hunt.title')}
              {lead && <span className="text-gray-400 font-medium normal-case tracking-normal"> · {tt('hunt.of', { i: idx + 1, n: queue.length })}</span>}
            </p>
            <button onClick={onClose} aria-label={tt('hunt.close')} className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1">✕</button>
          </div>
          <div className="flex gap-1">
            {queue.map((l, i) => {
              const o = outcomes[l.id];
              return (
                <button
                  key={l.id}
                  onClick={() => goTo(i)}
                  title={l.name}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    o ? OUTCOME_STYLE[o].bar : i === idx ? 'bg-[#0890F1]' : 'bg-gray-200 hover:bg-gray-300'
                  } ${i === idx ? 'ring-2 ring-[#0890F1]/30' : ''}`}
                />
              );
            })}
          </div>
        </div>

        {lead ? (
          <LeadStep
            key={lead.id}
            lead={lead}
            today={today}
            outcome={outcomes[lead.id]}
            tt={tt}
            busy={busy}
            error={error}
            draft={drafts[lead.id] ?? lead.draftMessage ?? ''}
            setDraft={(v) => setDrafts((d) => ({ ...d, [lead.id]: v }))}
            channel={channelPick[lead.id] ?? channelsFor(lead)[0] ?? null}
            setChannel={(c) => { setChannelPick((p) => ({ ...p, [lead.id]: c })); setConfirming(null); }}
            confirming={confirming}
            setConfirming={setConfirming}
            callNote={callNote}
            setCallNote={setCallNote}
            showReasons={showReasons}
            setShowReasons={setShowReasons}
            copied={copied}
            setCopied={setCopied}
            onContacted={(channel, message) => run(() => decide(lead, 'humano', { contact: { channel, message } }), lead.id)}
            onBot={() => run(() => decide(lead, 'bot'), lead.id)}
            onLater={() => run(() => decide(lead, 'humano'), lead.id)}
            onDiscard={(reason) => run(() => decide(lead, 'descartado', { reason }), lead.id)}
            onSkip={() => goTo(idx + 1)}
          />
        ) : (
          // ---- Wrap-up ----
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
            <div className={`w-14 h-14 rounded-full text-white text-2xl flex items-center justify-center mb-4 ${undecided > 0 ? 'bg-amber-400' : 'bg-emerald-500'}`}>
              {undecided > 0 ? undecided : '✓'}
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {undecided > 0 ? tt('hunt.wrap_pending', { n: undecided }) : tt('hunt.done_title')}
            </h2>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">{undecided > 0 ? tt('hunt.wrap_pending_sub') : tt('hunt.done_sub')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6 w-full max-w-md">
              {(['contacted', 'bot', 'later', 'discarded'] as Outcome[]).map((o) => (
                <div key={o} className="rounded-xl border border-gray-200 px-2 py-3">
                  <p className="text-2xl font-bold text-gray-900">{tally(o)}</p>
                  <p className="text-xs text-gray-500">{tt(`hunt.tally_${o}`)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-6 flex-wrap justify-center">
              {undecided > 0 && (
                <button
                  onClick={() => goTo(queue.findIndex((l) => !outcomes[l.id]))}
                  className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#0890F1] text-white hover:bg-[#0779cc]"
                >
                  {tt('hunt.review_skipped')} ({undecided})
                </button>
              )}
              <button
                onClick={onClose}
                className={`text-sm px-5 py-2.5 rounded-xl ${
                  undecided > 0
                    ? 'font-medium border border-gray-200 text-gray-700 hover:bg-gray-50'
                    : 'font-semibold bg-[#0890F1] text-white hover:bg-[#0779cc]'
                }`}
              >
                {tt('hunt.back_pipeline')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadStep({
  lead, today, outcome, tt, busy, error, draft, setDraft, channel, setChannel, confirming, setConfirming,
  callNote, setCallNote, showReasons, setShowReasons, copied, setCopied,
  onContacted, onBot, onLater, onDiscard, onSkip,
}: {
  lead: HuntLeadCard;
  today?: string;
  outcome?: Outcome;
  tt: (key: string, vars?: Vars) => string;
  busy: boolean;
  error: string | null;
  draft: string;
  setDraft: (v: string) => void;
  channel: Channel | null;
  setChannel: (c: Channel) => void;
  confirming: Channel | null;
  setConfirming: (c: Channel | null) => void;
  callNote: string;
  setCallNote: (v: string) => void;
  showReasons: boolean;
  setShowReasons: (v: boolean) => void;
  copied: boolean;
  setCopied: (v: boolean) => void;
  onContacted: (channel: Channel, message: string) => void;
  onBot: () => void;
  onLater: () => void;
  onDiscard: (reason: string) => void;
  onSkip: () => void;
}) {
  const channels = channelsFor(lead);
  const label = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  // The primary action opens the real channel with the message ready; logging happens
  // only after the user confirms it actually went out.
  const primary = () => {
    if (!channel) return;
    if (channel === 'whatsapp' && lead.phone) {
      window.open(waLink(lead.phone, draft), '_blank', 'noopener');
    } else if (channel === 'email' && lead.email) {
      const subject = tt('hunt.email_subject', { name: lead.name });
      window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft)}`;
    } else if (channel === 'call' && lead.phone) {
      window.location.href = `tel:${lead.phone.replace(/[^\d+]/g, '')}`;
    }
    setConfirming(channel);
  };

  const primaryLabel =
    channel === 'whatsapp' ? tt('hunt.send_whatsapp')
      : channel === 'email' ? tt('hunt.send_email')
        : channel === 'call' ? `${tt('hunt.call')} ${lead.phone || ''}`
          : '';
  const primaryColor = channel === 'whatsapp' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#0890F1] hover:bg-[#0779cc]';

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Who */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{lead.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {[lead.businessType, lead.district || lead.address].filter(Boolean).join(' · ')}
            {lead.rating != null && <> · ★ {lead.rating}{lead.reviews != null && ` (${lead.reviews.toLocaleString()})`}</>}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
            {lead.revenueMin != null && lead.revenueMax != null && (
              <span className="px-2 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {money(lead.revenueMin)}–{money(lead.revenueMax)}{tt('hunt.mo')}
              </span>
            )}
            {lead.suggestedRoute && (
              <span className={`px-2 py-1 rounded-md text-xs border ${
                lead.suggestedRoute === 'bot' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {lead.suggestedRoute === 'bot' ? `🤖 ${tt('hunt.suggest_bot')}` : `👤 ${tt('hunt.suggest_human')}`}
              </span>
            )}
            {lead.origin === 'rescate' && (
              <span className="px-2 py-1 rounded-md text-xs bg-amber-50 text-amber-700 border border-amber-200">{tt('hunt.in_orbit')}</span>
            )}
            {today && lead.huntDate !== today && (
              <span className="text-xs text-rose-600">{tt('hunt.from_date', { d: lead.huntDate })}</span>
            )}
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2">{tt('hunt.website')}</a>
            )}
            {lead.mapsUrl && (
              <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2">{tt('hunt.maps')}</a>
            )}
          </div>
        </div>

        {lead.why && (
          <div>
            <p className={label}>{tt('hunt.why')}</p>
            <p className="text-sm text-gray-800 mt-1 leading-relaxed">{lead.why}</p>
          </div>
        )}

        <div>
          <p className={label}>{tt('hunt.who')}</p>
          <div className="flex items-start justify-between gap-3 mt-1 flex-wrap">
            <p className="text-sm text-gray-800 leading-relaxed flex-1 min-w-[12rem]">{lead.decisionMaker || '—'}</p>
            <a
              href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(lead.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex-shrink-0"
            >
              {tt('hunt.find_linkedin')} ↗
            </a>
          </div>
        </div>

        {/* The message */}
        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className={label}>{tt('hunt.first_message')}</p>
            {channels.length > 1 && !outcome && (
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {channels.map((c) => (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                      channel === c ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {tt(`hunt.ch_${c}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {lead.angle && (
            <p className="text-xs text-gray-500 mt-1.5"><span className="font-medium text-gray-700">{tt('hunt.angle')}:</span> {lead.angle}</p>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!!outcome}
            rows={4}
            className="w-full mt-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#0890F1] focus:ring-2 focus:ring-[#0890F1]/20 outline-none px-3 py-2.5 text-sm text-gray-800 leading-relaxed resize-y disabled:opacity-60"
          />
          <div className="flex items-center gap-3 mt-1 text-xs">
            <button onClick={copy} className="text-gray-500 hover:text-gray-900">{copied ? `✓ ${tt('hunt.copied')}` : tt('hunt.copy')}</button>
            {draft !== (lead.draftMessage ?? '') && !outcome && (
              <button onClick={() => setDraft(lead.draftMessage ?? '')} className="text-gray-400 hover:text-gray-700">{tt('hunt.reset')}</button>
            )}
            <span className="text-gray-400 ml-auto">{[lead.phone, lead.email].filter(Boolean).join(' · ')}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-100 bg-white px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}

        {outcome ? (
          <div className="flex items-center justify-between gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${OUTCOME_STYLE[outcome].pill}`}>
              ✓ {tt(OUTCOME_STYLE[outcome].label)}
            </span>
            <button onClick={onSkip} className="text-sm font-medium text-[#0890F1] hover:underline">{tt('hunt.skip')} →</button>
          </div>
        ) : confirming ? (
          // Sent? Only then it's logged.
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">
              {confirming === 'call' ? tt('hunt.confirm_call') : tt('hunt.confirm_sent')}
            </p>
            {confirming === 'call' && (
              <input
                value={callNote}
                onChange={(e) => setCallNote(e.target.value)}
                placeholder={tt('hunt.call_note')}
                className="w-full mb-2 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0890F1]"
              />
            )}
            <div className="flex items-center gap-2">
              <button
                disabled={busy}
                onClick={() => onContacted(confirming, confirming === 'call' ? callNote : draft)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-3 rounded-xl disabled:opacity-50"
              >
                ✓ {tt('hunt.yes_log')}
              </button>
              <button
                disabled={busy}
                onClick={() => setConfirming(null)}
                className="text-sm font-medium px-4 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                {tt('hunt.not_yet')}
              </button>
            </div>
          </div>
        ) : showReasons ? (
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">{tt('hunt.why_not')}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DISCARD_REASONS.map((key) => (
                <button
                  key={key}
                  disabled={busy}
                  onClick={() => onDiscard(tt(key))}
                  className="text-sm px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50"
                >
                  {tt(key)}
                </button>
              ))}
              <button onClick={() => setShowReasons(false)} className="text-sm text-gray-400 hover:text-gray-700 px-2 ml-auto">✕</button>
            </div>
          </div>
        ) : (
          <>
            {channel ? (
              <button
                disabled={busy}
                onClick={primary}
                className={`w-full ${primaryColor} text-white font-semibold text-base px-4 py-3.5 rounded-xl shadow-sm transition-colors disabled:opacity-50`}
              >
                {primaryLabel}
              </button>
            ) : (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-3">{tt('hunt.no_contact')}</p>
            )}
            <div className="flex items-center gap-1 flex-wrap mt-2">
              <button
                disabled={busy || !lead.phoneIsMobile}
                onClick={onBot}
                title={lead.phoneIsMobile ? tt('hunt.bot_hint') : tt('hunt.bot_no_mobile')}
                className="text-sm font-medium px-3 py-2 rounded-lg text-purple-700 hover:bg-purple-50 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              >
                🤖 {tt('hunt.bot')}
              </button>
              <button disabled={busy} onClick={onLater} className="text-sm font-medium px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                {tt('hunt.later')}
              </button>
              <button disabled={busy} onClick={() => setShowReasons(true)} className="text-sm font-medium px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-rose-600 disabled:opacity-50">
                {tt('hunt.not_fit')}
              </button>
              <button onClick={onSkip} className="text-sm font-medium px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 ml-auto">
                {tt('hunt.skip')} →
              </button>
            </div>
            <p className="hidden sm:block text-[11px] text-gray-300 mt-1 text-right">{tt('hunt.keys')}</p>
          </>
        )}
      </div>
    </>
  );
}
