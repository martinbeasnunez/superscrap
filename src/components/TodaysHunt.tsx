'use client';

import { useState, useEffect, useCallback } from 'react';
import type { HuntLeadCard } from '@/app/api/hunt/route';

// "Today's hunt" — the leads the daily agentic hunt proposed and nobody has decided yet.
// Each lead gets one decision: a human takes it, the bot works it, or it's discarded.
// Until that decision the bot stays off for these leads.

interface HuntRun {
  hunt_date: string;
  quota: number | null;
  summary: string | null;
  theses: { rubro: string; zona: string; why?: string; saved?: number }[] | null;
}
interface HuntData {
  ready: boolean;
  today?: string;
  pending: HuntLeadCard[];
  decidedToday: { humano: number; bot: number; descartado: number };
  run: HuntRun | null;
}

const DISCARD_REASONS = ['Too small', 'Wrong fit', 'Already know them', 'No coverage', 'Other'];

function money(n: number): string {
  if (n >= 1000) return `S/${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `S/${n}`;
}

function waLink(phone: string, text: string | null): string {
  const c = phone.replace(/\D/g, '').replace(/^0+/, '');
  const full = c.startsWith('51') ? c : `51${c}`;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export default function TodaysHunt({ onDecided }: { onDecided?: () => void } = {}) {
  const [data, setData] = useState<HuntData | null>(null);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/hunt');
      if (!res.ok) return;
      setData(await res.json());
    } catch { /* the strip just stays hidden */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (lead: HuntLeadCard, decision: 'humano' | 'bot' | 'descartado', reason?: string) => {
    let userId = '';
    try { userId = JSON.parse(localStorage.getItem('orbit_user') || 'null')?.id || ''; } catch { /* ignore */ }
    setBusy(lead.id);
    setError(null);
    try {
      const res = await fetch('/api/hunt/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ huntLeadId: lead.id, decision, userId, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not save the decision');
      }
      setDiscarding(null);
      await load();
      onDecided?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the decision');
    } finally {
      setBusy(null);
    }
  };

  const copyDraft = async (lead: HuntLeadCard) => {
    if (!lead.draftMessage) return;
    try {
      await navigator.clipboard.writeText(lead.draftMessage);
      setCopied(lead.id);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard blocked */ }
  };

  if (!data?.ready) return null;
  const { pending, decidedToday, run } = data;
  const decidedCount = decidedToday.humano + decidedToday.bot + decidedToday.descartado;
  if (pending.length === 0 && decidedCount === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-white shadow-sm mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-baseline gap-3 flex-wrap">
          <span className="font-semibold text-sm text-gray-900">🎯 Today&apos;s hunt</span>
          <span className="text-sm text-gray-600">
            <b>{pending.length}</b> to decide
            {decidedCount > 0 && (
              <span className="text-gray-400">
                {' '}· today: {decidedToday.humano} taken · {decidedToday.bot} to bot · {decidedToday.descartado} discarded
              </span>
            )}
          </span>
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          {run?.summary && (
            <p className="text-xs text-gray-500 mt-2 mb-3">
              <span className="font-medium text-gray-700">Strategist ({run.hunt_date}):</span> {run.summary}
            </p>
          )}
          {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
          {pending.length === 0 && (
            <p className="text-sm text-gray-500 py-2">All decided. Tomorrow&apos;s hunt brings up to 10 more.</p>
          )}

          <div className="space-y-2">
            {pending.map((lead) => {
              const isOpen = expanded === lead.id;
              const isBusy = busy === lead.id;
              const humanFirst = lead.suggestedRoute !== 'bot';
              return (
                <div key={lead.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">{lead.name}</span>
                        {lead.revenueMin != null && lead.revenueMax != null && (
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {money(lead.revenueMin)}–{money(lead.revenueMax)}/mo
                          </span>
                        )}
                        {lead.thesis && (
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs bg-gray-100 text-gray-600">
                            {lead.thesis}
                          </span>
                        )}
                        {lead.origin === 'rescate' && (
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs bg-amber-50 text-amber-700 border border-amber-200">
                            already in ORBIT
                          </span>
                        )}
                        {lead.huntDate !== data.today && (
                          <span className="text-[10px] sm:text-xs text-rose-600">from {lead.huntDate}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[lead.district || lead.address, lead.decisionMaker].filter(Boolean).join(' · ')}
                      </p>
                      {lead.why && <p className="text-sm text-gray-700 mt-1.5">{lead.why}</p>}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        disabled={isBusy}
                        onClick={() => decide(lead, 'humano')}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                          humanFirst
                            ? 'bg-[#0890F1] text-white hover:bg-[#0779cc]'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        👤 I&apos;ll take it
                      </button>
                      <button
                        disabled={isBusy || !lead.phoneIsMobile}
                        title={lead.phoneIsMobile ? 'The ORBIT number sends the first message and the follow-ups' : 'No mobile number: the bot can only message mobiles'}
                        onClick={() => decide(lead, 'bot')}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          !humanFirst
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        🤖 Bot works it
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() => setDiscarding(discarding === lead.id ? null : lead.id)}
                        className="text-xs text-gray-400 hover:text-rose-600 px-1.5 py-1.5"
                        title="Discard"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {discarding === lead.id && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="text-xs text-gray-500">Why not?</span>
                      {DISCARD_REASONS.map((r) => (
                        <button
                          key={r}
                          disabled={isBusy}
                          onClick={() => decide(lead, 'descartado', r)}
                          className="text-xs px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setExpanded(isOpen ? null : lead.id)}
                    className="text-xs text-[#0890F1] hover:underline mt-2"
                  >
                    {isOpen ? 'Hide brief' : 'Angle & first message'}
                  </button>

                  {isOpen && (
                    <div className="mt-2 space-y-2">
                      {lead.angle && (
                        <p className="text-sm text-gray-700"><span className="font-medium">Angle:</span> {lead.angle}</p>
                      )}
                      {lead.draftMessage && (
                        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">{lead.draftMessage}</div>
                      )}
                      <div className="flex items-center gap-3 flex-wrap text-xs">
                        {lead.draftMessage && (
                          <button onClick={() => copyDraft(lead)} className="text-gray-600 hover:text-gray-900">
                            {copied === lead.id ? '✓ Copied' : 'Copy message'}
                          </button>
                        )}
                        {lead.phone && lead.phoneIsMobile && (
                          <a href={waLink(lead.phone, lead.draftMessage)} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                            Open WhatsApp
                          </a>
                        )}
                        {lead.phone && <span className="text-gray-500">{lead.phone}</span>}
                        {lead.email && <a href={`mailto:${lead.email}`} className="text-gray-600 hover:underline">{lead.email}</a>}
                        {lead.website && (
                          <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline">Website</a>
                        )}
                        {lead.score != null && <span className="text-gray-400">score {lead.score}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
