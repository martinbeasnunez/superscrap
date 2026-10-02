'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

// Orca hunting panel — an informational compass inside the Pipeline (/seguimiento).
// Read-only: who to hit, in what stage, where the money is, which ones nobody
// is working. Closing (messages, calls, logging) happens elsewhere (chat + Chrome).

interface OrcaLead {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  businessType: string | null;
  city: string | null;
  score: number | null;
  revenueMin: number | null;
  revenueMax: number | null;
  stage: string;
  contacted: boolean;
  ownerId: string | null;
  ownerName: string | null;
  contactedAt: string | null;
  daysSinceContact: number | null;
  daysSinceActivity: number | null;
  awaitingReply: boolean;
  temp: 'caliente' | 'negociacion' | 'tibio' | 'frio' | 'encurso';
  tier: string | null; // 'orca' | 'delfin' (DB values)
  source: string | null;
  nextAction: string | null;
}

interface Summary {
  total: number; open: number; won: number; lost: number;
  hot: number; negociacion: number; tibio: number; frio: number; awaiting: number;
  untouched: number; sinDueno: number;
  revenueMin: number; revenueMax: number;
  byStage: Record<string, number>;
}

interface CurrentUser { id: string; name: string; email: string; }

const STAGES = [
  'nuevo', 'contactado', 'seguimiento_1', 'seguimiento_2',
  'seguimiento_3', 'interesado', 'cotizado', 'cliente', 'perdido',
] as const;

const STAGE_LABEL: Record<string, string> = {
  nuevo: 'New', contactado: 'Contacted',
  seguimiento_1: 'Follow-up 1', seguimiento_2: 'Follow-up 2', seguimiento_3: 'Last attempt',
  interesado: 'Interested', cotizado: 'Quoted', cliente: 'Client', perdido: 'Lost',
};

const STAGE_PILL: Record<string, string> = {
  nuevo: 'bg-gray-100 text-gray-600',
  contactado: 'bg-blue-100 text-blue-700',
  seguimiento_1: 'bg-amber-100 text-amber-700',
  seguimiento_2: 'bg-amber-100 text-amber-700',
  seguimiento_3: 'bg-orange-100 text-orange-700',
  interesado: 'bg-fuchsia-100 text-fuchsia-700',
  cotizado: 'bg-purple-100 text-purple-700',
  cliente: 'bg-emerald-100 text-emerald-700',
  perdido: 'bg-rose-100 text-rose-700',
};

type FocusChip = 'todas' | 'calientes' | 'negociacion' | 'tibios' | 'sin_tocar' | 'sin_dueno';
type OwnerFilter = 'all' | 'martin' | 'alejandro' | 'bot';

function waNumber(phone: string): string {
  // Strips non-digits and the national trunk "0" (e.g. "(01) 4375151" → "14375151")
  // before prepending the country code 51.
  const c = phone.replace(/\D/g, '').replace(/^0+/, '');
  return c.startsWith('51') ? c : `51${c}`;
}

function money(n: number): string {
  if (n >= 1000) return `S/${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `S/${n}`;
}

function scoreClasses(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-400 border-gray-200';
  if (score >= 70) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score >= 62) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (score >= 55) return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-gray-50 text-gray-500 border-gray-200';
}

function staleClasses(days: number | null): string {
  if (days === null) return 'text-gray-400';
  if (days >= 7) return 'text-rose-600 font-semibold';
  if (days >= 3) return 'text-amber-600';
  return 'text-gray-400';
}

function daysLabel(days: number | null, contacted: boolean): string {
  if (!contacted) return 'untouched';
  if (days === null) return '—';
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

export default function OrcaWarRoom({ ownerFilter = 'all' }: { ownerFilter?: OwnerFilter } = {}) {
  const [orcas, setOrcas] = useState<OrcaLead[]>([]);
  const [delfines, setDelfines] = useState<OrcaLead[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryPlus, setSummaryPlus] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);

  const [focus, setFocus] = useState<FocusChip>('todas');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [hideClosed, setHideClosed] = useState(true);
  // Include dolphins IN PLAY (on by default): the real work also lives in dolphins.
  const [includeDelfines, setIncludeDelfines] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('orbit_user');
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* ignore */ } }
  }, []);

  const fetchOrcas = useCallback(async () => {
    try {
      setError(null);
      // We read the user from localStorage here (not from state) to avoid races
      // on the first render: this way the owner always travels on the first load.
      let ownerId = '';
      try { ownerId = JSON.parse(localStorage.getItem('orbit_user') || 'null')?.id || ''; } catch { /* ignore */ }
      const res = await fetch(`/api/orcas${ownerId ? `?owner=${ownerId}` : ''}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setOrcas(data.orcas || []);
      setDelfines(data.delfinesEnJuego || []);
      setSummary(data.summary || null);
      setSummaryPlus(data.summaryInPlay || data.summary || null);
    } catch {
      setError('Could not load orcas. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrcas(); }, [fetchOrcas]);

  // Displayed pipeline: orcas + (optionally) dolphins IN PLAY.
  const leads = useMemo(
    () => (includeDelfines ? [...orcas, ...delfines] : orcas),
    [orcas, delfines, includeDelfines],
  );
  const activeSummary = includeDelfines ? summaryPlus : summary;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((o) => {
      if (hideClosed && (o.stage === 'cliente' || o.stage === 'perdido')) return false;
      if (stageFilter !== 'all' && o.stage !== stageFilter) return false;
      if (focus === 'calientes' && o.temp !== 'caliente') return false;
      if (focus === 'negociacion' && o.temp !== 'negociacion') return false;
      if (focus === 'tibios' && o.temp !== 'tibio') return false;
      if (focus === 'sin_tocar' && o.contacted) return false;
      if (focus === 'sin_dueno' && o.ownerId) return false;
      // Shared seller filter (Pipeline bar)
      if (ownerFilter === 'martin' && !(o.ownerName === 'Martin' || o.ownerName === 'Martín')) return false;
      if (ownerFilter === 'alejandro' && o.ownerName !== 'Alejandro') return false;
      if (ownerFilter === 'bot' && !(!o.ownerId && o.contacted)) return false;
      if (q) {
        const hay = [o.name, o.phone, o.businessType, o.city, o.address].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, stageFilter, focus, hideClosed, ownerFilter]);

  const chips: { id: FocusChip; label: string; count?: number }[] = [
    { id: 'todas', label: 'All' },
    { id: 'calientes', label: '🔥 Hot', count: activeSummary?.hot },
    { id: 'negociacion', label: '💬 Negotiating', count: activeSummary?.negociacion },
    { id: 'tibios', label: '🌡️ Warm', count: activeSummary?.tibio },
    { id: 'sin_tocar', label: '🆕 Untouched', count: summary?.untouched },
    { id: 'sin_dueno', label: '👤 Unassigned', count: activeSummary?.sinDueno },
  ];

  return (
    <div>
      {/* Intro + refresh */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-gray-500">
          Hunting compass: who to hit first, where the money is, which ones nobody is working.
        </p>
        <button
          onClick={fetchOrcas}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* KPIs */}
      {activeSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Kpi label={includeDelfines ? 'Open in play' : 'Open orcas'} value={String(activeSummary.open)} sub={includeDelfines ? 'orcas + dolphins' : `${activeSummary.total} total`} accent="text-gray-900" />
          <Kpi label="🔥 Hot" value={String(activeSummary.hot)} sub={`💬 ${activeSummary.negociacion} negotiating${activeSummary.awaiting ? ` · ${activeSummary.awaiting} replied to you` : ''}`} accent="text-orange-600" />
          <Kpi label="Unassigned" value={String(activeSummary.sinDueno)} sub="nobody is working them" accent="text-rose-600" />
          <Kpi label="In play / month" value={`${money(activeSummary.revenueMin)}–${money(activeSummary.revenueMax)}`} sub="potential revenue" accent="text-[#0890F1]" small />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {chips.map((c) => (
          <button
            key={c.id}
            onClick={() => setFocus(c.id)}
            className={`text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
              focus === c.id
                ? 'bg-[#0890F1] border-[#0890F1] text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {c.label}{typeof c.count === 'number' ? ` · ${c.count}` : ''}
          </button>
        ))}
        <div className="flex-1" />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="text-sm bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700"
        >
          <option value="all">All stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, district…"
          className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 w-48 focus:outline-none focus:ring-2 focus:ring-[#0890F1]/30"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-500 select-none cursor-pointer">
          <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} className="rounded" />
          Hide closed
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-500 select-none cursor-pointer">
          <input type="checkbox" checked={includeDelfines} onChange={(e) => setIncludeDelfines(e.target.checked)} className="rounded" />
          🐬 Include dolphins in play
        </label>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-3 border-[#0890F1] border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-rose-600">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">🐋</p>
          <p>No orcas with these filters.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-2">{filtered.length} {includeDelfines ? 'in play (orcas + dolphins)' : `orca${filtered.length === 1 ? '' : 's'}`}</p>
          <div className="space-y-2">
            {filtered.map((o) => (
              <OrcaRow key={o.id} o={o} isMine={!!user && o.ownerId === user.id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, accent, small }: { label: string; value: string; sub: string; accent: string; small?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`${small ? 'text-lg' : 'text-2xl'} font-bold mt-1 ${accent}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function OrcaRow({ o, isMine }: { o: OrcaLead; isMine: boolean }) {
  return (
    <div className={`bg-white rounded-xl border border-l-4 ${o.score !== null && o.score >= 62 ? 'border-l-emerald-400' : 'border-l-blue-300'} border-gray-100 shadow-sm px-3 sm:px-4 py-3`}>
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        {/* Score */}
        <div className={`flex-shrink-0 w-11 h-11 rounded-lg border flex flex-col items-center justify-center ${scoreClasses(o.score)}`}>
          <span className="text-base font-bold leading-none">{o.score ?? '—'}</span>
          <span className="text-[9px] uppercase tracking-wide opacity-70">score</span>
        </div>

        {/* Nombre + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate max-w-[16rem] sm:max-w-none">{o.name}</span>
            <span className="text-[11px] flex-shrink-0" title={o.tier === 'delfin' ? 'Dolphin (in play)' : 'Orca'}>{o.tier === 'delfin' ? '🐬' : '🐋'}</span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STAGE_PILL[o.stage]}`}>{STAGE_LABEL[o.stage]}</span>
            {o.awaitingReply && (
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-semibold bg-emerald-100 text-emerald-700">💬 replied</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
            {o.businessType && <span className="truncate max-w-[14rem]">{o.businessType}</span>}
            {(o.revenueMin || o.revenueMax) ? (
              <span className="text-gray-400">· {money(o.revenueMin || 0)}–{money(o.revenueMax || 0)}/mo</span>
            ) : null}
            <span className={staleClasses(o.contacted ? o.daysSinceActivity : null)}>· {daysLabel(o.daysSinceActivity, o.contacted)}</span>
          </div>
        </div>

        {/* Owner (read-only) */}
        <div className="flex-shrink-0">
          {o.ownerId ? (
            <span className={`text-xs px-2 py-1 rounded-full ${isMine ? 'bg-[#0890F1]/10 text-[#0890F1] font-semibold' : 'bg-gray-100 text-gray-600'}`}>
              {isMine ? '⭐ Mine' : o.ownerName}
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-rose-50 text-rose-500 border border-rose-100">unassigned</span>
          )}
        </div>

        {/* Quick contact access (does not mutate data) */}
        {o.phone && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <a
              href={`https://wa.me/${waNumber(o.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open WhatsApp"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
            </a>
            <a
              href={`tel:${o.phone}`}
              title="Call"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </a>
          </div>
        )}
      </div>

      {/* Next action — free text curated by the human (the bot doesn't touch it) */}
      <NextActionEditor id={o.id} initial={o.nextAction} />
    </div>
  );
}

// Inline, compact "Next action" editor. Saves via PATCH /api/businesses/[id].
// Optimistic: reflects the saved value without reloading the whole list.
function NextActionEditor({ id, initial }: { id: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = draft.trim();
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_action: next }),
      });
      if (res.ok) {
        setValue(next);
        setEditing(false);
      }
    } catch { /* leave the editor open to retry */ } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-gray-400 flex-shrink-0">→</span>
        <input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
          placeholder="Next action… (e.g. send proposal)"
          className="flex-1 min-w-0 text-xs sm:text-sm bg-white border border-gray-200 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0890F1]/30"
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium bg-[#0890F1] text-white disabled:opacity-50 flex-shrink-0"
        >
          {saving ? '⏳' : 'Save'}
        </button>
        <button
          onClick={() => { setDraft(value); setEditing(false); }}
          className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs text-gray-500 hover:text-gray-700 flex-shrink-0"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {value ? (
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          title="Edit next action"
          className="inline-flex items-center gap-1 max-w-full px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100"
        >
          <span className="flex-shrink-0">→</span>
          <span className="truncate">{value}</span>
        </button>
      ) : (
        <button
          onClick={() => { setDraft(''); setEditing(true); }}
          className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200"
        >
          ✏️ next action
        </button>
      )}
    </div>
  );
}
