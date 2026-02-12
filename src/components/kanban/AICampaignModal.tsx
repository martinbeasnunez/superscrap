'use client';

import { useState, useEffect, useCallback } from 'react';
import { KanbanBusiness } from '@/app/api/kanban/route';
import { useI18n } from '@/lib/i18n';

interface AICampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: {
    nuevos: KanbanBusiness[];
    seguimiento: KanbanBusiness[];
  };
  onCampaignComplete: () => void;
}

type CampaignTarget = 'nuevos' | 'seguimiento' | 'ambos';
type CampaignStatus = 'idle' | 'running' | 'paused' | 'completed';

interface CallResult {
  leadId: string;
  leadName: string;
  status: 'pending' | 'calling' | 'completed' | 'failed';
  outcome?: string;
  error?: string;
}

export default function AICampaignModal({ isOpen, onClose, leads, onCampaignComplete }: AICampaignModalProps) {
  const { t } = useI18n();
  const [target, setTarget] = useState<CampaignTarget>('nuevos');
  const [quantity, setQuantity] = useState(10);
  const [status, setStatus] = useState<CampaignStatus>('idle');
  const [callResults, setCallResults] = useState<CallResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [delayBetweenCalls] = useState(5); // 5 segundos entre llamadas

  // IDs de leads llamados en esta sesión (usa state para forzar re-render)
  const [calledInSession, setCalledInSession] = useState<Set<string>>(new Set());

  // IDs de leads excluidos manualmente por el usuario
  const [excludedLeads, setExcludedLeads] = useState<Set<string>>(new Set());

  // Leads disponibles según target
  const availableLeads = target === 'nuevos'
    ? leads.nuevos
    : target === 'seguimiento'
      ? leads.seguimiento
      : [...leads.nuevos, ...leads.seguimiento];

  // Leads sin llamada IA previa Y no llamados en esta sesión Y no excluidos
  const leadsWithoutAICall = availableLeads.filter(l => {
    // Excluir si ya tiene resultado de llamada IA
    if (l.aiCallResult?.hasAICall) return false;
    // Excluir si no tiene teléfono
    if (!l.phone) return false;
    // Excluir si fue llamado en esta sesión
    if (calledInSession.has(l.id)) return false;
    // Excluir si el usuario lo quitó manualmente
    if (excludedLeads.has(l.id)) return false;
    // Excluir si fue llamado recientemente (últimas 24h) - verificar por contacted_at
    if (l.contacted_at) {
      const lastContact = new Date(l.contacted_at);
      const hoursAgo = (Date.now() - lastContact.getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 24) return false;
    }
    return true;
  });

  // Función para excluir un lead del preview
  const excludeLead = (leadId: string) => {
    setExcludedLeads(prev => new Set(prev).add(leadId));
  };

  // Función para restaurar todos los leads excluidos
  const restoreExcludedLeads = () => {
    setExcludedLeads(new Set());
  };

  // Leads a llamar (limitados por quantity)
  const leadsToCall = leadsWithoutAICall.slice(0, quantity);

  // Estadísticas de la campaña
  const stats = {
    total: callResults.length,
    completed: callResults.filter(r => r.status === 'completed').length,
    failed: callResults.filter(r => r.status === 'failed').length,
    pending: callResults.filter(r => r.status === 'pending').length,
    calling: callResults.filter(r => r.status === 'calling').length,
  };

  // Iniciar campaña
  const startCampaign = useCallback(() => {
    if (leadsToCall.length === 0) return;

    // Inicializar resultados
    const initialResults: CallResult[] = leadsToCall.map(lead => ({
      leadId: lead.id,
      leadName: lead.name,
      status: 'pending',
    }));

    setCallResults(initialResults);
    setCurrentIndex(0);
    setStatus('running');
  }, [leadsToCall]);

  // Hacer una llamada individual
  const makeCall = useCallback(async (lead: KanbanBusiness, index: number) => {
    // Marcar como llamado en esta sesión INMEDIATAMENTE (con setState para forzar re-render)
    setCalledInSession(prev => new Set(prev).add(lead.id));

    // Actualizar estado a "llamando"
    setCallResults(prev => prev.map((r, i) =>
      i === index ? { ...r, status: 'calling' as const } : r
    ));

    try {
      const response = await fetch('/api/ai-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: lead.id,
          phoneNumber: lead.phone,
          businessName: lead.name,
          businessType: lead.business_type,
          salesStage: lead.sales_stage,
          contactCount: lead.contactCount || 0,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al iniciar llamada');
      }

      const data = await response.json();

      // Actualizar resultado
      setCallResults(prev => prev.map((r, i) =>
        i === index ? { ...r, status: 'completed' as const, outcome: data.conversation_id } : r
      ));
    } catch (error) {
      setCallResults(prev => prev.map((r, i) =>
        i === index ? { ...r, status: 'failed' as const, error: 'Error al llamar' } : r
      ));
    }
  }, []);

  // Efecto para ejecutar las llamadas secuencialmente
  useEffect(() => {
    if (status !== 'running') return;
    if (currentIndex >= leadsToCall.length) {
      setStatus('completed');
      return;
    }

    const lead = leadsToCall[currentIndex];
    if (!lead) return;

    // Hacer la llamada
    makeCall(lead, currentIndex).then(() => {
      // Esperar antes de la siguiente llamada
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, delayBetweenCalls * 1000);
    });
  }, [status, currentIndex, leadsToCall, makeCall, delayBetweenCalls]);

  // Pausar campaña
  const pauseCampaign = () => {
    setStatus('paused');
  };

  // Reanudar campaña
  const resumeCampaign = () => {
    setStatus('running');
  };

  // Cerrar y limpiar
  const handleClose = () => {
    if (status === 'running') {
      if (!confirm(t('campaign.confirm_cancel'))) return;
    }
    setStatus('idle');
    setCallResults([]);
    setCurrentIndex(0);
    if (status === 'completed' || callResults.some(r => r.status === 'completed')) {
      onCampaignComplete();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con gradiente */}
        <div className="px-6 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🤖</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">{t('campaign.title')}</h2>
                <p className="text-purple-200 text-sm">{t('campaign.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {status === 'idle' ? (
            <>
              {/* Selector de target */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('campaign.who_to_call')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'nuevos', label: t('campaign.new'), icon: '🆕', count: leads.nuevos.filter(l => !l.aiCallResult?.hasAICall && l.phone).length },
                    { value: 'seguimiento', label: t('campaign.followup'), icon: '🔄', count: leads.seguimiento.filter(l => !l.aiCallResult?.hasAICall && l.phone).length },
                    { value: 'ambos', label: t('campaign.all'), icon: '📋', count: [...leads.nuevos, ...leads.seguimiento].filter(l => !l.aiCallResult?.hasAICall && l.phone).length },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTarget(opt.value as CampaignTarget)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        target === opt.value
                          ? 'border-purple-500 bg-purple-50 shadow-md'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{opt.icon}</div>
                      <div className="font-medium text-gray-900">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.count} {t('campaign.available')}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector de cantidad */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('campaign.how_many')}
                </label>
                <div className="flex gap-2">
                  {[5, 10, 25, 50].map(num => (
                    <button
                      key={num}
                      onClick={() => setQuantity(num)}
                      disabled={num > leadsWithoutAICall.length}
                      className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all ${
                        quantity === num
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                          : num > leadsWithoutAICall.length
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                {leadsWithoutAICall.length < quantity && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ {t('campaign.only_available').replace('leads', `${leadsWithoutAICall.length} leads`)}
                  </p>
                )}
              </div>

              {/* Preview de leads */}
              <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">{t('campaign.preview')}</span>
                  <div className="flex items-center gap-2">
                    {excludedLeads.size > 0 && (
                      <button
                        onClick={restoreExcludedLeads}
                        className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
                      >
                        {t('campaign.restore')} ({excludedLeads.size})
                      </button>
                    )}
                    <span className="text-xs text-gray-500">{leadsToCall.length} leads</span>
                  </div>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {leadsToCall.slice(0, 8).map((lead, i) => (
                    <div key={lead.id} className="flex items-center gap-2 text-sm group">
                      <span className="w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate flex-1 font-medium text-gray-900">{lead.name}</span>
                      <span className="text-gray-600 text-xs font-medium flex-shrink-0">{lead.phone}</span>
                      <button
                        onClick={() => excludeLead(lead.id)}
                        className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors flex-shrink-0 opacity-50 group-hover:opacity-100"
                        title={`Quitar ${lead.name} de la campaña`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {leadsToCall.length > 8 && (
                    <p className="text-xs text-gray-400 text-center pt-1">
                      +{leadsToCall.length - 8} {t('campaign.and_more')}
                    </p>
                  )}
                </div>
              </div>

              {/* Info de tiempo estimado */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⏱️</span>
                  <div>
                    <p className="text-sm font-medium text-blue-900">{t('campaign.estimated_time')}</p>
                    <p className="text-xs text-blue-700">
                      ~{Math.ceil(leadsToCall.length * (delayBetweenCalls + 2) / 60)} {t('campaign.minutes_for')} {leadsToCall.length} llamadas
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {t('campaign.interval_info').replace('intervalo', `${delayBetweenCalls}s intervalo`)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón de inicio */}
              <button
                onClick={startCampaign}
                disabled={leadsToCall.length === 0}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  leadsToCall.length === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300 hover:scale-[1.02]'
                }`}
              >
                🚀 {t('campaign.start')} ({leadsToCall.length} llamadas)
              </button>
            </>
          ) : (
            <>
              {/* Estado de la campaña */}
              <div className="text-center mb-6">
                {status === 'running' && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    {t('campaign.running')}
                  </div>
                )}
                {status === 'paused' && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-full">
                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                    {t('campaign.paused')}
                  </div>
                )}
                {status === 'completed' && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full">
                    <span className="text-lg">🎉</span>
                    {t('campaign.completed')}
                  </div>
                )}
              </div>

              {/* Barra de progreso */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">{t('campaign.progress')}</span>
                  <span className="font-bold text-purple-700">
                    {stats.completed + stats.failed} / {stats.total}
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${((stats.completed + stats.failed) / stats.total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-xl font-bold text-gray-900">{stats.total}</div>
                  <div className="text-xs text-gray-500">{t('campaign.total')}</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <div className="text-xl font-bold text-green-600">{stats.completed}</div>
                  <div className="text-xs text-green-600">{t('campaign.started')}</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                  <div className="text-xl font-bold text-amber-600">{stats.calling}</div>
                  <div className="text-xs text-amber-600">{t('campaign.calling_status')}</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-xl">
                  <div className="text-xl font-bold text-red-600">{stats.failed}</div>
                  <div className="text-xs text-red-600">{t('campaign.failed')}</div>
                </div>
              </div>

              {/* Lista de llamadas */}
              <div className="max-h-48 overflow-y-auto space-y-2 mb-6">
                {callResults.map((result, i) => (
                  <div
                    key={result.leadId}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      result.status === 'calling'
                        ? 'bg-purple-50 border border-purple-200'
                        : result.status === 'completed'
                          ? 'bg-green-50'
                          : result.status === 'failed'
                            ? 'bg-red-50'
                            : 'bg-gray-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      result.status === 'calling'
                        ? 'bg-purple-200 text-purple-700'
                        : result.status === 'completed'
                          ? 'bg-green-200 text-green-700'
                          : result.status === 'failed'
                            ? 'bg-red-200 text-red-700'
                            : 'bg-gray-200 text-gray-500'
                    }`}>
                      {result.status === 'calling' ? (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : result.status === 'completed' ? (
                        '✓'
                      ) : result.status === 'failed' ? (
                        '✗'
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{result.leadName}</p>
                      <p className="text-xs text-gray-500">
                        {result.status === 'pending' && t('campaign.waiting')}
                        {result.status === 'calling' && `📞 ${t('campaign.calling')}`}
                        {result.status === 'completed' && `✅ ${t('campaign.call_started')}`}
                        {result.status === 'failed' && `❌ ${result.error || t('campaign.call_error')}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botones de control */}
              <div className="flex gap-3">
                {status === 'running' && (
                  <button
                    onClick={pauseCampaign}
                    className="flex-1 py-3 bg-amber-100 text-amber-700 rounded-xl font-medium hover:bg-amber-200 transition-colors"
                  >
                    ⏸️ {t('campaign.pause')}
                  </button>
                )}
                {status === 'paused' && (
                  <button
                    onClick={resumeCampaign}
                    className="flex-1 py-3 bg-green-100 text-green-700 rounded-xl font-medium hover:bg-green-200 transition-colors"
                  >
                    ▶️ {t('campaign.resume')}
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                    status === 'completed'
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'completed' ? `🎉 ${t('campaign.close_done')}` : t('common.cancel')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
