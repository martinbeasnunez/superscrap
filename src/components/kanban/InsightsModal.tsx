'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LossByStage {
  stage: string;
  label: string;
  count: number;
  topReason: string | null;
  topReasonLabel: string | null;
}

interface LossByReason {
  reason: string;
  label: string;
  count: number;
}

interface ChannelPerf {
  channel: string;
  label: string;
  total: number;
  won: number;
  lost: number;
  active: number;
  winRate: number | null;
}

interface DuplicateLead {
  id: string;
  name: string | null;
  phone: string | null;
  sales_stage: string | null;
  created_at: string | null;
}

interface DuplicateGroup {
  key: string;
  kind: 'phone' | 'name';
  count: number;
  leads: DuplicateLead[];
}

interface Insights {
  summary: {
    totalLeads: number;
    wonClientes: number;
    lostPerdidos: number;
    activeLeads: number;
    winRate: number;
  };
  lossByPreviousStage: LossByStage[];
  lossByReason: LossByReason[];
  channelPerformance: ChannelPerf[];
  duplicates: {
    phoneGroups: DuplicateGroup[];
    nameGroups: DuplicateGroup[];
    totalDuplicateLeads: number;
  };
}

const STAGE_LABELS: Record<string, string> = {
  nuevo: 'Nuevos', contactado: 'Contactado',
  seguimiento_1: 'Seg. 1', seguimiento_2: 'Seg. 2', seguimiento_3: 'Seg. 3',
  interesado: 'Interesado', cotizado: 'Cotizado',
  cliente: '✅ Cliente', perdido: '❌ Perdido',
};

function DuplicateGroupRow({ group }: { group: DuplicateGroup }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
      <div className="text-[10px] text-gray-500 mb-1 truncate">
        {group.kind === 'phone' ? '📞 ' : '✏️ '}{group.key} <span className="text-gray-400">· {group.count} leads</span>
      </div>
      <div className="space-y-1">
        {group.leads.map(l => (
          <div key={l.id} className="flex items-center gap-2 text-xs">
            <span className="font-medium text-gray-800 truncate flex-1">{l.name || '(sin nombre)'}</span>
            <span className="text-[10px] text-gray-500 flex-shrink-0">{STAGE_LABELS[l.sales_stage || 'nuevo'] || l.sales_stage}</span>
            {l.phone && (
              <span className="text-[10px] text-gray-400 hidden sm:inline flex-shrink-0">{l.phone}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBar({ value, max, color = 'bg-red-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function InsightsModal({ isOpen, onClose }: InsightsModalProps) {
  const { t } = useI18n();
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    fetch('/api/insights')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then((d: Insights) => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const summary = data?.summary;
  const maxLossStage = Math.max(1, ...(data?.lossByPreviousStage ?? []).map(s => s.count));
  const maxLossReason = Math.max(1, ...(data?.lossByReason ?? []).map(r => r.count));
  const maxChannelTotal = Math.max(1, ...(data?.channelPerformance ?? []).map(c => c.total));

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">📊 {t('insights.title')}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {loading && (
            <div className="text-sm text-gray-500 py-10 text-center">{t('insights.loading')}</div>
          )}
          {error && (
            <div className="text-sm text-red-600 py-4">{error}</div>
          )}
          {!loading && !error && data && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="text-[10px] uppercase text-gray-500 font-medium tracking-wide">{t('insights.summary_total')}</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{summary!.totalLeads}</div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="text-[10px] uppercase text-blue-700 font-medium tracking-wide">{t('insights.summary_active')}</div>
                  <div className="text-2xl font-bold text-blue-800 mt-1">{summary!.activeLeads}</div>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                  <div className="text-[10px] uppercase text-green-700 font-medium tracking-wide">{t('insights.summary_won')}</div>
                  <div className="text-2xl font-bold text-green-800 mt-1">{summary!.wonClientes}</div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <div className="text-[10px] uppercase text-red-700 font-medium tracking-wide">{t('insights.summary_lost')}</div>
                  <div className="text-2xl font-bold text-red-800 mt-1">{summary!.lostPerdidos}</div>
                </div>
              </div>

              {/* Win rate */}
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-4">
                <div className="text-xs uppercase text-emerald-700 font-medium tracking-wide mb-1">
                  🏆 {t('insights.win_rate')}
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-emerald-800">
                    {(summary!.winRate * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-emerald-700">
                    {summary!.wonClientes} {t('insights.won_of')} {summary!.wonClientes + summary!.lostPerdidos}
                  </div>
                </div>
              </div>

              {/* Where leads die */}
              <div>
                <h3 className="font-bold text-sm text-gray-900 mb-1">💀 {t('insights.loss_by_stage_title')}</h3>
                <p className="text-xs text-gray-500 mb-3">{t('insights.loss_by_stage_subtitle')}</p>
                {data.lossByPreviousStage.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">{t('insights.no_data_loss')}</div>
                ) : (
                  <div className="space-y-2">
                    {data.lossByPreviousStage.map(s => (
                      <div key={s.stage} className="flex items-center gap-3">
                        <div className="w-32 text-xs font-medium text-gray-700 flex-shrink-0">{s.label}</div>
                        <HorizontalBar value={s.count} max={maxLossStage} color="bg-red-400" />
                        <div className="w-10 text-xs font-bold text-gray-900 text-right flex-shrink-0">{s.count}</div>
                        {s.topReasonLabel && (
                          <div className="hidden sm:block text-[10px] text-gray-500 italic flex-shrink-0 w-36 truncate">
                            ↳ {s.topReasonLabel}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top loss reasons */}
              <div>
                <h3 className="font-bold text-sm text-gray-900 mb-1">💰 {t('insights.loss_by_reason_title')}</h3>
                <p className="text-xs text-gray-500 mb-3">{t('insights.loss_by_reason_subtitle')}</p>
                {data.lossByReason.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">{t('insights.no_data_loss')}</div>
                ) : (
                  <div className="space-y-2">
                    {data.lossByReason.map(r => (
                      <div key={r.reason} className="flex items-center gap-3">
                        <div className="w-44 text-xs font-medium text-gray-700 flex-shrink-0 truncate">{r.label}</div>
                        <HorizontalBar value={r.count} max={maxLossReason} color="bg-orange-400" />
                        <div className="w-10 text-xs font-bold text-gray-900 text-right flex-shrink-0">{r.count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Channel performance */}
              {data.channelPerformance.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm text-gray-900 mb-1">🎯 {t('insights.channel_title')}</h3>
                  <p className="text-xs text-gray-500 mb-3">{t('insights.channel_subtitle')}</p>
                  <div className="space-y-2">
                    {data.channelPerformance.map(c => (
                      <div key={c.channel} className="flex items-center gap-3">
                        <div className="w-40 text-xs font-medium text-gray-700 flex-shrink-0 truncate">{c.label}</div>
                        <HorizontalBar value={c.total} max={maxChannelTotal} color="bg-amber-400" />
                        <div className="text-[10px] text-gray-600 flex-shrink-0 w-28 text-right">
                          <span className="text-green-700">{c.won}✓</span>{' '}
                          <span className="text-red-600">{c.lost}✗</span>{' '}
                          <span className="text-blue-600">{c.active}•</span>
                          {c.winRate !== null && (
                            <span className="ml-1 font-bold text-emerald-700">
                              {(c.winRate * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicates */}
              {data.duplicates && (data.duplicates.phoneGroups.length > 0 || data.duplicates.nameGroups.length > 0) && (
                <div>
                  <h3 className="font-bold text-sm text-gray-900 mb-1">
                    🔁 {t('insights.dup_title')} ({data.duplicates.totalDuplicateLeads})
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">{t('insights.dup_subtitle')}</p>

                  {data.duplicates.phoneGroups.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-orange-700 mb-1.5">
                        📞 {t('insights.dup_by_phone')} ({data.duplicates.phoneGroups.length})
                      </div>
                      <div className="space-y-2">
                        {data.duplicates.phoneGroups.slice(0, 10).map(g => (
                          <DuplicateGroupRow key={'p-' + g.key} group={g} />
                        ))}
                      </div>
                    </div>
                  )}

                  {data.duplicates.nameGroups.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-amber-700 mb-1.5">
                        ✏️ {t('insights.dup_by_name')} ({data.duplicates.nameGroups.length})
                      </div>
                      <div className="space-y-2">
                        {data.duplicates.nameGroups.slice(0, 10).map(g => (
                          <DuplicateGroupRow key={'n-' + g.key} group={g} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            {t('insights.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
