'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { KanbanBusiness, KanbanColumnId, KanbanResponse } from '@/app/api/kanban/route';
import KanbanColumn from './KanbanColumn';
import LeadDetailModal from './LeadDetailModal';
import { COLUMN_CONFIG } from './KanbanColumn';

const COLUMN_ORDER: KanbanColumnId[] = [
  'nuevo',
  'contactado',
  'seguimiento_1',
  'seguimiento_2',
  'interesado',
  'cotizado',
  'cliente',
  'perdido',
];

// Frases motivacionales sobre follow-up
const FOLLOW_UP_QUOTES = [
  { quote: "El 80% de las ventas requieren 5 follow-ups. El 44% de vendedores se rinden después de 1.", author: "Estadística de ventas B2B" },
  { quote: "La fortuna está en el seguimiento.", author: "Jim Rohn" },
  { quote: "Un seguimiento vale más que 100 primeros contactos.", author: "Sabiduría comercial" },
  { quote: "El que persevera, vende.", author: "Dicho de ventas" },
  { quote: "Cada follow-up te acerca más al cierre.", author: "Principio de ventas" },
];

// Tips de seguimiento según situación
function getFollowUpTip(urgentCount: number, criticalCount: number, contactedWithoutFollowUp: number): string {
  if (criticalCount > 0) {
    return `🔥 ¡${criticalCount} leads llevan +5 días sin contacto! El interés se enfría rápido. Actúa HOY.`;
  }
  if (urgentCount > 0) {
    return `⏰ ${urgentCount} leads necesitan seguimiento (3-4 días). Un mensaje ahora puede cerrar la venta.`;
  }
  if (contactedWithoutFollowUp > 5) {
    return `💡 Tip: Los mejores vendedores hacen 3-5 contactos por lead. ¿Ya hiciste seguimiento?`;
  }
  return `✅ ¡Buen trabajo! Mantén el ritmo de seguimiento constante.`;
}

export default function KanbanBoard() {
  const [columns, setColumns] = useState<Record<KanbanColumnId, KanbanBusiness[]>>({
    nuevo: [],
    contactado: [],
    seguimiento_1: [],
    seguimiento_2: [],
    interesado: [],
    cotizado: [],
    cliente: [],
    perdido: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<KanbanBusiness | null>(null);
  const [showAIInsights, setShowAIInsights] = useState(false);

  // Audio player for AI insights modal
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Seleccionar una frase motivacional random (pero estable durante la sesión)
  const [quoteIndex] = useState(() => Math.floor(Math.random() * FOLLOW_UP_QUOTES.length));
  const motivationalQuote = FOLLOW_UP_QUOTES[quoteIndex];

  const fetchKanbanData = useCallback(async () => {
    try {
      const response = await fetch('/api/kanban');
      if (!response.ok) throw new Error('Error al cargar datos');
      const data: KanbanResponse = await response.json();
      setColumns(data.columns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKanbanData();
  }, [fetchKanbanData]);

  // Calcular métricas de seguimiento - ahora basado en las columnas
  const followUpMetrics = useMemo(() => {
    const seguimiento1Count = columns.seguimiento_1.length;
    const seguimiento2Count = columns.seguimiento_2.length;
    const recentCount = columns.contactado.length;

    // Leads contactados solo 1 vez en todo el pipeline activo
    const allActiveLeads = [
      ...columns.contactado,
      ...columns.seguimiento_1,
      ...columns.seguimiento_2,
      ...columns.interesado,
      ...columns.cotizado,
    ];
    const singleContactLeads = allActiveLeads.filter(l => l.contactCount === 1).length;

    // Contar leads que tuvieron llamada con IA
    const allLeads = COLUMN_ORDER.flatMap(col => columns[col]);
    const aiCallLeads = allLeads.filter(l => l.aiCallResult?.hasAICall).length;

    // Contar por outcome de llamadas IA
    const aiOutcomes = {
      interested: allLeads.filter(l => l.aiCallResult?.outcome === 'interested' || l.aiCallResult?.outcome === 'wants_quote').length,
      notInterested: allLeads.filter(l => l.aiCallResult?.outcome === 'not_interested').length,
      noAnswer: allLeads.filter(l => l.aiCallResult?.outcome === 'no_answer').length,
      voicemail: allLeads.filter(l => l.aiCallResult?.outcome === 'voicemail').length,
      other: allLeads.filter(l => l.aiCallResult?.hasAICall && !['interested', 'wants_quote', 'not_interested', 'no_answer', 'voicemail'].includes(l.aiCallResult?.outcome || '')).length,
    };

    return {
      urgentCount: seguimiento1Count,
      criticalCount: seguimiento2Count,
      recentCount,
      totalContactedLeads: allActiveLeads.length,
      singleContactLeads,
      needsAttention: seguimiento1Count + seguimiento2Count,
      aiCallLeads,
      aiOutcomes,
    };
  }, [columns]);

  const updateBusinessStage = async (businessId: string, newStage: KanbanColumnId) => {
    // No guardar columnas virtuales de seguimiento en DB
    if (newStage === 'seguimiento_1' || newStage === 'seguimiento_2') {
      return;
    }

    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales_stage: newStage }),
      });
      if (!response.ok) {
        throw new Error('Error al actualizar etapa');
      }
    } catch (err) {
      console.error('Error updating business stage:', err);
      fetchKanbanData();
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceColumn = source.droppableId as KanbanColumnId;
    const destColumn = destination.droppableId as KanbanColumnId;

    const business = columns[sourceColumn].find((b) => b.id === draggableId);
    if (!business) return;

    // Las columnas de seguimiento son virtuales (basadas en tiempo), no se guardan en DB
    const isVirtualColumn = (col: KanbanColumnId) =>
      col === 'seguimiento_1' || col === 'seguimiento_2';

    // Determinar el sales_stage real para la DB
    // Si destino es seguimiento, mantener el stage anterior o 'contactado'
    const getActualSalesStage = (dest: KanbanColumnId, currentStage: typeof business.sales_stage) => {
      if (isVirtualColumn(dest)) {
        // Mantener el stage actual o usar 'contactado'
        return currentStage && !isVirtualColumn(currentStage as KanbanColumnId)
          ? currentStage
          : 'contactado';
      }
      return dest as typeof business.sales_stage;
    };

    const actualSalesStage = getActualSalesStage(destColumn, business.sales_stage);

    setColumns((prev) => {
      const newColumns = { ...prev };
      newColumns[sourceColumn] = prev[sourceColumn].filter((b) => b.id !== draggableId);
      const destItems = [...prev[destColumn].filter((b) => b.id !== draggableId)];
      destItems.splice(destination.index, 0, {
        ...business,
        sales_stage: actualSalesStage,
      });
      newColumns[destColumn] = destItems;
      return newColumns;
    });

    // Solo actualizar en DB si el destino no es una columna virtual
    if (sourceColumn !== destColumn && !isVirtualColumn(destColumn)) {
      updateBusinessStage(draggableId, destColumn);
    }
  };

  const handleCardClick = (business: KanbanBusiness) => {
    setSelectedBusiness(business);
  };

  const handleStageChange = (businessId: string, newStage: KanbanColumnId) => {
    let business: KanbanBusiness | undefined;
    let sourceColumn: KanbanColumnId | undefined;

    for (const col of COLUMN_ORDER) {
      const found = columns[col].find((b) => b.id === businessId);
      if (found) {
        business = found;
        sourceColumn = col;
        break;
      }
    }

    if (!business || !sourceColumn || sourceColumn === newStage) return;

    // Determinar el sales_stage real (no columnas virtuales)
    const isVirtualColumn = (col: KanbanColumnId) =>
      col === 'seguimiento_1' || col === 'seguimiento_2';
    const actualSalesStage = isVirtualColumn(newStage)
      ? business!.sales_stage
      : (newStage as typeof business.sales_stage);

    setColumns((prev) => {
      const newColumns = { ...prev };
      newColumns[sourceColumn!] = prev[sourceColumn!].filter((b) => b.id !== businessId);
      newColumns[newStage] = [{ ...business!, sales_stage: actualSalesStage }, ...prev[newStage]];
      return newColumns;
    });

    setSelectedBusiness((prev) => prev ? { ...prev, sales_stage: actualSalesStage } : null);
    updateBusinessStage(businessId, newStage);
  };

  const handleActionRegistered = () => {
    setTimeout(() => fetchKanbanData(), 500);
  };

  // Obtener todos los leads con llamadas IA para el modal de insights
  const aiCallLeadsList = useMemo(() => {
    const allLeads = COLUMN_ORDER.flatMap(col =>
      columns[col].map(lead => ({ ...lead, currentColumn: col }))
    );
    return allLeads
      .filter(l => l.aiCallResult?.hasAICall)
      .sort((a, b) => {
        // Ordenar por outcome: interesados primero, luego otros, voicemail al final
        const priority: Record<string, number> = {
          'wants_quote': 1,
          'interested': 2,
          'callback': 3,
          'not_interested': 4,
          'completed': 5,
          'no_answer': 6,
          'voicemail': 7,
        };
        const aPriority = priority[a.aiCallResult?.outcome || 'completed'] || 5;
        const bPriority = priority[b.aiCallResult?.outcome || 'completed'] || 5;
        return aPriority - bPriority;
      });
  }, [columns]);

  // Reproducir audio de llamada IA
  const handlePlayAudio = (conversationId: string) => {
    if (playingAudioId === conversationId && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudioId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setAudioLoading(conversationId);

    const audio = new Audio(`/api/ai-call/audio?conversationId=${conversationId}`);
    audioRef.current = audio;

    audio.oncanplaythrough = () => {
      setAudioLoading(null);
      audio.play();
      setPlayingAudioId(conversationId);
    };

    audio.onended = () => {
      setPlayingAudioId(null);
    };

    audio.onerror = () => {
      setAudioLoading(null);
      setPlayingAudioId(null);
    };

    audio.load();
  };

  // Obtener label y color del outcome
  const getOutcomeInfo = (outcome: string | null) => {
    switch (outcome) {
      case 'wants_quote':
        return { label: '💰 Quiere cotización', color: 'text-green-700', bg: 'bg-green-100' };
      case 'interested':
        return { label: '🎯 Interesado', color: 'text-blue-700', bg: 'bg-blue-100' };
      case 'not_interested':
        return { label: '❌ No interesado', color: 'text-gray-600', bg: 'bg-gray-100' };
      case 'callback':
        return { label: '📅 Llamar después', color: 'text-amber-700', bg: 'bg-amber-100' };
      case 'no_answer':
        return { label: '📵 No contestó', color: 'text-red-600', bg: 'bg-red-50' };
      case 'voicemail':
        return { label: '📭 Buzón de voz', color: 'text-gray-500', bg: 'bg-gray-50' };
      default:
        return { label: '🤖 Completada', color: 'text-purple-700', bg: 'bg-purple-100' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500">Cargando pipeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <p>{error}</p>
          <button
            onClick={fetchKanbanData}
            className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const totalLeads = COLUMN_ORDER.reduce((sum, col) => sum + columns[col].length, 0);
  const activeLeads = columns.nuevo.length + columns.contactado.length + columns.seguimiento_1.length + columns.seguimiento_2.length + columns.interesado.length + columns.cotizado.length;

  return (
    <div className="h-full">
      {/* Banner de seguimiento - Solo si hay leads que necesitan atención */}
      {followUpMetrics.needsAttention > 0 && (
        <div className={`mb-4 p-4 rounded-xl border-2 ${
          followUpMetrics.criticalCount > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-orange-50 border-orange-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`text-3xl ${followUpMetrics.criticalCount > 0 ? 'animate-bounce' : 'animate-pulse'}`}>
                {followUpMetrics.criticalCount > 0 ? '🔥' : '⏰'}
              </div>
              <div>
                <h3 className={`font-bold ${followUpMetrics.criticalCount > 0 ? 'text-red-800' : 'text-orange-800'}`}>
                  ¡{followUpMetrics.needsAttention} leads necesitan seguimiento!
                </h3>
                <p className={`text-sm ${followUpMetrics.criticalCount > 0 ? 'text-red-600' : 'text-orange-600'}`}>
                  {getFollowUpTip(followUpMetrics.urgentCount, followUpMetrics.criticalCount, followUpMetrics.singleContactLeads)}
                </p>
              </div>
            </div>
            <div className="flex gap-2 text-sm">
              {followUpMetrics.criticalCount > 0 && (
                <span className="px-3 py-1 bg-red-200 text-red-800 rounded-full font-bold animate-pulse">
                  🔥 {followUpMetrics.criticalCount} críticos (+5d)
                </span>
              )}
              {followUpMetrics.urgentCount > 0 && (
                <span className="px-3 py-1 bg-orange-200 text-orange-800 rounded-full font-medium">
                  ⏰ {followUpMetrics.urgentCount} urgentes (3-4d)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Frase motivacional */}
      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-800 italic">"{motivationalQuote.quote}"</p>
        <p className="text-xs text-blue-600 mt-1">— {motivationalQuote.author}</p>
      </div>

      {/* Stats rápidos con métricas de seguimiento */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
        <span className="text-gray-600"><strong>{totalLeads}</strong> leads</span>
        <span className="text-blue-600"><strong>{activeLeads}</strong> activos</span>
        <span className="text-green-600"><strong>{columns.cliente.length}</strong> clientes</span>
        <span className="text-amber-600"><strong>{columns.interesado.length + columns.cotizado.length}</strong> por cerrar</span>

        <span className="border-l border-gray-300 h-4 mx-1"></span>

        {/* Métricas de seguimiento */}
        {followUpMetrics.recentCount > 0 && (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
            ✓ {followUpMetrics.recentCount} al día
          </span>
        )}
        {followUpMetrics.singleContactLeads > 0 && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs" title="Leads con solo 1 contacto - considera hacer follow-up">
            💬 {followUpMetrics.singleContactLeads} con 1 solo contacto
          </span>
        )}

        {/* Métricas de llamadas IA - Clickeable para ver insights */}
        {followUpMetrics.aiCallLeads > 0 && (
          <>
            <span className="border-l border-gray-300 h-4 mx-1"></span>
            <button
              onClick={() => setShowAIInsights(true)}
              className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium hover:bg-purple-200 transition-colors cursor-pointer"
              title="Click para ver detalles de llamadas IA"
            >
              🤖 {followUpMetrics.aiCallLeads} llamadas IA
            </button>
            {followUpMetrics.aiOutcomes.interested > 0 && (
              <button
                onClick={() => setShowAIInsights(true)}
                className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs hover:bg-green-200 transition-colors cursor-pointer"
                title="Click para ver leads interesados"
              >
                🎯 {followUpMetrics.aiOutcomes.interested} interesados
              </button>
            )}
            {followUpMetrics.aiOutcomes.voicemail > 0 && (
              <button
                onClick={() => setShowAIInsights(true)}
                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs hover:bg-gray-200 transition-colors cursor-pointer"
                title="Click para ver buzones de voz"
              >
                📭 {followUpMetrics.aiOutcomes.voicemail} buzón
              </button>
            )}
          </>
        )}
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMN_ORDER.map((columnId) => (
            <KanbanColumn
              key={columnId}
              columnId={columnId}
              businesses={columns[columnId]}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Modal de detalle */}
      {selectedBusiness && (
        <LeadDetailModal
          business={selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
          onStageChange={handleStageChange}
          onActionRegistered={handleActionRegistered}
        />
      )}

      {/* Modal de AI Insights */}
      {showAIInsights && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAIInsights(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    🤖 Insights de Llamadas IA
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {aiCallLeadsList.length} leads contactados por el agente IA
                  </p>
                </div>
                <button
                  onClick={() => setShowAIInsights(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white/50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Resumen de resultados */}
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  🎯 {followUpMetrics.aiOutcomes.interested} interesados
                </span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                  ❌ {followUpMetrics.aiOutcomes.notInterested} no interesados
                </span>
                <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm">
                  📵 {followUpMetrics.aiOutcomes.noAnswer} no contestaron
                </span>
                <span className="px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-sm">
                  📭 {followUpMetrics.aiOutcomes.voicemail} buzón de voz
                </span>
                {followUpMetrics.aiOutcomes.other > 0 && (
                  <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-sm">
                    📞 {followUpMetrics.aiOutcomes.other} otros
                  </span>
                )}
              </div>
            </div>

            {/* Lista de llamadas */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-180px)]">
              <div className="space-y-3">
                {aiCallLeadsList.map((lead) => {
                  const outcomeInfo = getOutcomeInfo(lead.aiCallResult?.outcome || null);
                  const columnConfig = COLUMN_CONFIG[lead.currentColumn as KanbanColumnId];
                  const conversationId = lead.aiCallResult?.conversationId;
                  const isPlaying = playingAudioId === conversationId;
                  const isLoading = audioLoading === conversationId;

                  return (
                    <div
                      key={lead.id}
                      className={`p-4 rounded-xl border-2 ${
                        lead.aiCallResult?.outcome === 'wants_quote' || lead.aiCallResult?.outcome === 'interested'
                          ? 'border-green-200 bg-green-50/50'
                          : lead.aiCallResult?.outcome === 'voicemail'
                            ? 'border-gray-200 bg-gray-50/50'
                            : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Nombre y etapa */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 truncate">{lead.name}</h3>
                            <span className={`px-2 py-0.5 rounded text-xs ${columnConfig?.bgColor || 'bg-gray-100'} ${columnConfig?.color || 'text-gray-600'}`}>
                              {columnConfig?.icon} {columnConfig?.title || lead.currentColumn}
                            </span>
                          </div>

                          {/* Tipo de negocio y distrito */}
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            {lead.business_type && <span>{lead.business_type}</span>}
                            {lead.city && <span>📍 {lead.city}</span>}
                          </div>

                          {/* Resultado de la llamada */}
                          <div className="mt-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium ${outcomeInfo.bg} ${outcomeInfo.color}`}>
                              {outcomeInfo.label}
                              {lead.aiCallResult?.contactName && (
                                <span className="ml-2 font-normal opacity-75">
                                  • Contacto: {lead.aiCallResult.contactName}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Botón de reproducir */}
                        {conversationId && (
                          <button
                            onClick={() => handlePlayAudio(conversationId)}
                            disabled={isLoading}
                            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${
                              isPlaying
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                            } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                            title={isPlaying ? 'Pausar' : 'Escuchar llamada'}
                          >
                            {isLoading ? (
                              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : isPlaying ? (
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Botón para ver detalle */}
                      <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                        <span className="text-xs text-gray-400">
                          {lead.phone}
                        </span>
                        <button
                          onClick={() => {
                            setShowAIInsights(false);
                            setSelectedBusiness(lead);
                          }}
                          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                        >
                          Ver detalle →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {aiCallLeadsList.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl mb-4 block">🤖</span>
                  <p className="font-medium">No hay llamadas IA registradas</p>
                  <p className="text-sm mt-1">Las llamadas del agente IA aparecerán aquí</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <span className="text-sm text-gray-500">
                Tasa de éxito: <strong className="text-green-600">
                  {aiCallLeadsList.length > 0
                    ? Math.round((followUpMetrics.aiOutcomes.interested / aiCallLeadsList.length) * 100)
                    : 0}%
                </strong> interesados
              </span>
              <button
                onClick={() => setShowAIInsights(false)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
