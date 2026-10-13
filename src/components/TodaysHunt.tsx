'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import type { HuntLeadCard } from '@/app/api/hunt/route';

// "Today's hunt" — the accounts the daily agentic hunt picked this morning.
// The human only approves: yes or no per account, then one "Approve and launch".
// Approved accounts go to the bot (the ORBIT number sends the first WhatsApp and the
// follow-ups on its own). Accounts with no automatic channel are never launched: they
// are either kept under the user's name or left out.

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

// What happens to each account on launch.
type Choice = 'bot' | 'mine' | 'out';
type Vars = Record<string, string | number>;
type TT = (key: string, vars?: Vars) => string;

function money(n: number): string {
  if (n >= 1000) return `S/${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `S/${n}`;
}

function currentUserId(): string {
  try { return JSON.parse(localStorage.getItem('orbit_user') || 'null')?.id || ''; } catch { return ''; }
}

// The bot can only work accounts with a mobile number.
const isAuto = (lead: HuntLeadCard) => !!lead.phone && lead.phoneIsMobile;

export default function TodaysHunt() {
  const { t } = useI18n();
  const tt: TT = useCallback(
    (key, vars) => Object.entries(vars || {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), t(key)),
    [t],
  );

  const [data, setData] = useState<HuntData | null>(null);
  // Approval view: a snapshot of the pending accounts taken when it opens.
  const [queue, setQueue] = useState<HuntLeadCard[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/hunt');
      if (!res.ok) return;
      setData(await res.json());
    } catch { /* the card just stays hidden */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const pending = useMemo(() => data?.pending ?? [], [data]);

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
            {tt('hunt.ap_summary', { a: decidedToday.bot, m: decidedToday.humano, o: decidedToday.descartado })}
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
                onClick={() => setQueue(pending)}
                className="flex items-center justify-center gap-2 w-full sm:w-auto bg-[#0890F1] hover:bg-[#0779cc] text-white font-semibold text-sm sm:text-base px-5 py-3 rounded-xl shadow-sm transition-colors"
              >
                {t('hunt.start')}
                <span aria-hidden>→</span>
              </button>
            </div>

            {/* What happens after you approve */}
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

            {run?.summary && (
              <p className="text-xs text-gray-500 mt-3 line-clamp-2">
                <span className="font-medium text-gray-700">{t('hunt.strategist')}:</span> {run.summary}
              </p>
            )}
          </div>
        </div>
      )}

      {queue && (
        <HuntApproval
          queue={queue}
          tt={tt}
          onDecided={load}
          onClose={() => { setQueue(null); load(); }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Approval view: yes/no per account, then one launch.
// ---------------------------------------------------------------------------

function HuntApproval({
  queue, tt, onDecided, onClose,
}: {
  queue: HuntLeadCard[];
  tt: TT;
  onDecided: () => void;
  onClose: () => void;
}) {
  const auto = useMemo(() => queue.filter(isAuto), [queue]);
  const manual = useMemo(() => queue.filter((l) => !isAuto(l)), [queue]);

  // Default: what ORBIT can work on its own is approved; what it can't stays out.
  const [choice, setChoice] = useState<Record<string, Choice>>(
    () => Object.fromEntries(queue.map((l) => [l.id, isAuto(l) ? 'bot' : 'out'])),
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !launching) onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, launching]);

  const count = (c: Choice) => queue.filter((l) => choice[l.id] === c).length;

  const launch = async () => {
    setLaunching(true);
    setError(null);
    const userId = currentUserId();
    for (let i = 0; i < queue.length; i++) {
      const lead = queue[i];
      const c = choice[lead.id];
      const body =
        c === 'bot' ? { decision: 'bot' }
          : c === 'mine' ? { decision: 'humano' }
            : { decision: 'descartado', reason: isAuto(lead) ? tt('hunt.r_not_approved') : tt('hunt.r_no_channel') };
      try {
        const res = await fetch('/api/hunt/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ huntLeadId: lead.id, userId, ...body }),
        });
        if (!res.ok) throw new Error('decide failed');
      } catch {
        // Stop here: what was already launched stays launched, the rest remains pending.
        setError(`${tt('hunt.error')} (${lead.name})`);
        setLaunching(false);
        onDecided();
        return;
      }
      setProgress(i + 1);
    }
    setLaunching(false);
    setDone(true);
    onDecided();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={() => { if (!launching) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0890F1]">🎯 {tt('hunt.title')}</p>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mt-0.5">{tt('hunt.ap_title')}</h2>
            <p className="text-sm text-gray-500">{tt('hunt.ap_sub')}</p>
          </div>
          <button onClick={onClose} disabled={launching} aria-label={tt('hunt.close')} className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1 disabled:opacity-40">✕</button>
        </div>

        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
            <div className="w-14 h-14 rounded-full bg-emerald-500 text-white text-2xl flex items-center justify-center mb-4">✓</div>
            <h3 className="text-xl font-bold text-gray-900">{tt('hunt.ap_done')}</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">{tt('hunt.ap_done_sub')}</p>
            <p className="text-sm font-medium text-gray-700 mt-5">
              {tt('hunt.ap_summary', { a: count('bot'), m: count('mine'), o: count('out') })}
            </p>
            <button onClick={onClose} className="mt-6 text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#0890F1] text-white hover:bg-[#0779cc]">
              {tt('hunt.back_pipeline')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
              {auto.length > 0 && (
                <Group title={`🤖 ${tt('hunt.ap_auto')}`} hint={tt('hunt.ap_auto_hint')} tone="auto">
                  {auto.map((lead) => (
                    <Row
                      key={lead.id}
                      lead={lead}
                      tt={tt}
                      options={[['bot', tt('hunt.ap_yes')], ['mine', tt('hunt.ap_mine')], ['out', tt('hunt.ap_no')]]}
                      value={choice[lead.id]}
                      onChange={(c) => setChoice((p) => ({ ...p, [lead.id]: c }))}
                      disabled={launching}
                      open={expanded === lead.id}
                      toggle={() => setExpanded(expanded === lead.id ? null : lead.id)}
                    />
                  ))}
                </Group>
              )}
              {manual.length > 0 && (
                <Group title={tt('hunt.ap_manual')} hint={tt('hunt.ap_manual_hint')} tone="manual">
                  {manual.map((lead) => (
                    <Row
                      key={lead.id}
                      lead={lead}
                      tt={tt}
                      options={[['mine', tt('hunt.ap_mine')], ['out', tt('hunt.ap_out')]]}
                      value={choice[lead.id]}
                      onChange={(c) => setChoice((p) => ({ ...p, [lead.id]: c }))}
                      disabled={launching}
                      open={expanded === lead.id}
                      toggle={() => setExpanded(expanded === lead.id ? null : lead.id)}
                    />
                  ))}
                </Group>
              )}
            </div>

            <div className="border-t border-gray-100 bg-white px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
              {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-gray-600">
                  {tt('hunt.ap_summary', { a: count('bot'), m: count('mine'), o: count('out') })}
                </p>
                <button
                  disabled={launching}
                  onClick={launch}
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base px-6 py-3 rounded-xl shadow-sm transition-colors disabled:opacity-60"
                >
                  {launching ? `${tt('hunt.ap_launching')} ${progress}/${queue.length}` : `${tt('hunt.ap_launch')} →`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Group({
  title, hint, tone, children,
}: {
  title: string;
  hint: string;
  tone: 'auto' | 'manual';
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className={`text-sm font-semibold ${tone === 'auto' ? 'text-purple-700' : 'text-gray-700'}`}>{title}</h3>
      <p className="text-xs text-gray-500 mt-0.5 mb-2">{hint}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({
  lead, tt, options, value, onChange, disabled, open, toggle,
}: {
  lead: HuntLeadCard;
  tt: TT;
  options: [Choice, string][];
  value: Choice;
  onChange: (c: Choice) => void;
  disabled: boolean;
  open: boolean;
  toggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const active: Record<Choice, string> = {
    bot: 'bg-emerald-600 text-white shadow-sm',
    mine: 'bg-[#0890F1] text-white shadow-sm',
    out: 'bg-gray-700 text-white shadow-sm',
  };

  const copy = async () => {
    if (!lead.draftMessage) return;
    try {
      await navigator.clipboard.writeText(lead.draftMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className={`rounded-xl border p-3 transition-colors ${value === 'out' ? 'border-gray-200 bg-gray-50/70' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`min-w-0 flex-1 ${value === 'out' ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">{lead.name}</span>
            {lead.revenueMin != null && lead.revenueMax != null && (
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                {money(lead.revenueMin)}–{money(lead.revenueMax)}{tt('hunt.mo')}
              </span>
            )}
            {lead.origin === 'rescate' && (
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs bg-amber-50 text-amber-700 border border-amber-200">{tt('hunt.in_orbit')}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {[lead.businessType, lead.district || lead.address].filter(Boolean).join(' · ')}
            {lead.rating != null && <> · ★ {lead.rating}{lead.reviews != null && ` (${lead.reviews.toLocaleString()})`}</>}
          </p>
          {lead.why && <p className={`text-sm text-gray-700 mt-1.5 ${open ? '' : 'line-clamp-2'}`}>{lead.why}</p>}
        </div>

        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
          {options.map(([c, label]) => (
            <button
              key={c}
              disabled={disabled}
              onClick={() => onChange(c)}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-60 ${
                value === c ? active[c] : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={toggle} className="text-xs text-[#0890F1] hover:underline mt-1.5">
        {open ? tt('hunt.ap_hide') : tt('hunt.ap_detail')}
      </button>

      {open && (
        <div className="mt-2 space-y-2 text-sm">
          {lead.decisionMaker && (
            <p className="text-gray-700"><span className="font-medium">{tt('hunt.who')}:</span> {lead.decisionMaker}</p>
          )}
          {lead.angle && (
            <p className="text-gray-700"><span className="font-medium">{tt('hunt.angle')}:</span> {lead.angle}</p>
          )}
          {lead.draftMessage && (
            <div>
              <p className="text-xs text-gray-400 mb-1">{tt('hunt.ap_draft')}</p>
              <div className="bg-gray-50 rounded-lg p-3 text-gray-700 whitespace-pre-wrap">{lead.draftMessage}</div>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            {lead.draftMessage && (
              <button onClick={copy} className="text-gray-600 hover:text-gray-900">{copied ? `✓ ${tt('hunt.copied')}` : tt('hunt.copy')}</button>
            )}
            {lead.phone && <span className="text-gray-500">{lead.phone}</span>}
            {lead.email && <a href={`mailto:${lead.email}`} className="text-gray-600 hover:underline">{lead.email}</a>}
            {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline">{tt('hunt.website')}</a>}
            {lead.mapsUrl && <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline">{tt('hunt.maps')}</a>}
            <a
              href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(lead.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:underline"
            >
              {tt('hunt.find_linkedin')} ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
