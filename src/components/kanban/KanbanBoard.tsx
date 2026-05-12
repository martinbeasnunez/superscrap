'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { KanbanBusiness, KanbanColumnId, KanbanResponse } from '@/app/api/kanban/route';
import KanbanColumn from './KanbanColumn';
import LeadDetailModal from './LeadDetailModal';
import AICampaignModal from './AICampaignModal';
import AddManualLeadModal from './AddManualLeadModal';
import { COLUMN_CONFIG, getColumnConfig } from './KanbanColumn';
import { useI18n } from '@/lib/i18n';
import { detectIndustry, IndustryCategory } from '@/lib/scoring';

const COLUMN_ORDER: KanbanColumnId[] = [
  'nuevo',
  'contactado',
  'seguimiento_1',
  'seguimiento_2',
  'seguimiento_3',
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

const INDUSTRY_LABELS: Record<string, { emoji: string; label: string }> = {
  hotel_luxury: { emoji: '🏨', label: 'Hoteles 5★' },
  hotel_mid: { emoji: '🏨', label: 'Hoteles 3-4★' },
  hotel_budget: { emoji: '🛏️', label: 'Hostales' },
  hospital: { emoji: '🏥', label: 'Hospitales' },
  clinic: { emoji: '⚕️', label: 'Clínicas' },
  club: { emoji: '🏌️', label: 'Clubes' },
  spa_premium: { emoji: '💆', label: 'Spas Premium' },
  spa_basic: { emoji: '💆', label: 'Spas' },
  gym_premium: { emoji: '🏋️', label: 'Gyms Premium' },
  gym_basic: { emoji: '🏋️', label: 'Gyms' },
  restaurant_gourmet: { emoji: '🍽️', label: 'Rest. Gourmet' },
  restaurant_mid: { emoji: '🍽️', label: 'Restaurantes' },
  security: { emoji: '🛡️', label: 'Seguridad' },
  cleaning: { emoji: '🧹', label: 'Limpieza' },
  industrial: { emoji: '🏭', label: 'Industrial' },
  events: { emoji: '🎪', label: 'Eventos' },
  residence: { emoji: '🏠', label: 'Residencias' },
  other: { emoji: '🏢', label: 'Otros' },
};

// Tips de seguimiento según situación
function getFollowUpTip(urgentCount: number, criticalCount: number, contactedWithoutFollowUp: number, finalCount?: number): string {
  if (finalCount && finalCount > 0) {
    return `💀 ¡${finalCount} leads llevan +9 días! Es ahora o nunca. Mensaje killer: "¿Sí o no?"`;
  }
  if (criticalCount > 0) {
    return `🔥 ¡${criticalCount} leads llevan 6-8 días sin contacto! El interés se enfría rápido. Actúa HOY.`;
  }
  if (urgentCount > 0) {
    return `⏰ ${urgentCount} leads necesitan seguimiento (3-5 días). Un mensaje ahora puede cerrar la venta.`;
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
    seguimiento_3: [],
    interesado: [],
    cotizado: [],
    cliente: [],
    perdido: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<KanbanBusiness | null>(null);
  const [selectedBusinessColumn, setSelectedBusinessColumn] = useState<KanbanColumnId>('nuevo');
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [showAICampaign, setShowAICampaign] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [insightsTimeFilter, setInsightsTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [industryFilter, setIndustryFilter] = useState<IndustryCategory | 'all'>('all');
  const [phoneFilter, setPhoneFilter] = useState<'all' | 'whatsapp' | 'replied' | 'sent_today' | 'no_phone'>('all');
  const [columnFilter, setColumnFilter] = useState<'all' | 'clientes' | 'por_cerrar'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'orca' | 'delfin'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Audio player for AI insights modal
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Seleccionar una frase motivacional random (pero estable durante la sesión)
  const [quoteIndex] = useState(() => Math.floor(Math.random() * FOLLOW_UP_QUOTES.length));
  const motivationalQuote = FOLLOW_UP_QUOTES[quoteIndex];

  const { t } = useI18n();
  const columnConfig = getColumnConfig(t);

  const [whatsappStats, setWhatsappStats] = useState({ sentToday: 0, sentManualToday: 0, sentAutoToday: 0, repliesUnread: 0, repliesHuman: 0, repliesBot: 0 });

  const fetchKanbanData = useCallback(async () => {
    try {
      const response = await fetch('/api/kanban');
      if (!response.ok) throw new Error('Error loading kanban data');
      const data: KanbanResponse = await response.json();
      setColumns(data.columns);
      if (data.whatsappStats) setWhatsappStats(data.whatsappStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKanbanData();
  }, [fetchKanbanData]);

  // Keyboard shortcut: press "/" to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchQuery]);

  // Calcular métricas de seguimiento - ahora basado en las columnas
  const followUpMetrics = useMemo(() => {
    const seguimiento1Count = columns.seguimiento_1.length;
    const seguimiento2Count = columns.seguimiento_2.length;
    const seguimiento3Count = columns.seguimiento_3.length;
    const recentCount = columns.contactado.length;

    // Leads contactados solo 1 vez en todo el pipeline activo
    const allActiveLeads = [
      ...columns.contactado,
      ...columns.seguimiento_1,
      ...columns.seguimiento_2,
      ...columns.seguimiento_3,
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
      finalCount: seguimiento3Count,
      recentCount,
      totalContactedLeads: allActiveLeads.length,
      singleContactLeads,
      needsAttention: seguimiento1Count + seguimiento2Count + seguimiento3Count,
      aiCallLeads,
      aiOutcomes,
    };
  }, [columns]);

  // Replied leads waiting for Alejandro to respond — split by stale (>5d) vs recent
  // Excludes cliente/perdido (already handled) and bot-only replies (noise)
  const STALE_REPLY_DAYS = 5;
  const repliedLeads = useMemo(() => {
    const activeCols: KanbanColumnId[] = [
      'nuevo', 'contactado', 'seguimiento_1', 'seguimiento_2',
      'seguimiento_3', 'interesado', 'cotizado',
    ];
    const all = activeCols.flatMap(col => columns[col]).filter(l => l.has_human_reply);
    const now = Date.now();
    const withAge = all.map(lead => {
      const days = lead.last_reply_date
        ? Math.floor((now - new Date(lead.last_reply_date).getTime()) / 86400000)
        : 0;
      return { lead, days };
    });
    const stale = withAge.filter(x => x.days >= STALE_REPLY_DAYS).sort((a, b) => b.days - a.days);
    const recent = withAge.filter(x => x.days < STALE_REPLY_DAYS).sort((a, b) => b.days - a.days);
    return { stale, recent, total: all.length };
  }, [columns]);

  // Detect industries from all leads and build filter options
  const availableIndustries = useMemo(() => {
    const allLeads = COLUMN_ORDER.flatMap(col => columns[col]);
    const industryCounts: Record<string, number> = {};
    allLeads.forEach(lead => {
      const industry = detectIndustry(lead.business_type, lead.name);
      industryCounts[industry] = (industryCounts[industry] || 0) + 1;
    });
    // Sort by count descending, filter out industries with 0
    return Object.entries(industryCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([industry, count]) => ({ industry: industry as IndustryCategory, count }));
  }, [columns]);

  // Helper: check if phone is WhatsApp-capable (Peruvian mobile)
  const hasWhatsApp = (phone: string | null): boolean => {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, '');
    return (
      (cleaned.length === 9 && cleaned.startsWith('9')) ||
      (cleaned.length === 11 && cleaned.startsWith('519')) ||
      (cleaned.length === 12 && cleaned.startsWith('519'))
    );
  };

  // Filtered columns based on industry + phone + search filters
  const filteredColumns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (industryFilter === 'all' && phoneFilter === 'all' && tierFilter === 'all' && !q) return columns;
    const filtered: Record<KanbanColumnId, KanbanBusiness[]> = {
      nuevo: [], contactado: [], seguimiento_1: [], seguimiento_2: [],
      seguimiento_3: [], interesado: [], cotizado: [], cliente: [], perdido: [],
    };
    COLUMN_ORDER.forEach(col => {
      filtered[col] = columns[col].filter(lead => {
        if (industryFilter !== 'all') {
          const industry = detectIndustry(lead.business_type, lead.name);
          if (industry !== industryFilter) return false;
        }
        if (phoneFilter === 'whatsapp' && !hasWhatsApp(lead.phone)) return false;
        if (phoneFilter === 'replied' && !lead.has_unread_reply) return false;
        if (phoneFilter === 'sent_today' && !lead.contacted_today) return false;
        if (phoneFilter === 'no_phone' && hasWhatsApp(lead.phone)) return false;
        if (tierFilter !== 'all' && lead.potential_tier !== tierFilter) return false;
        if (q) {
          const haystack = [lead.name, lead.phone, lead.address, lead.business_type, lead.city]
            .filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
    });
    return filtered;
  }, [columns, industryFilter, phoneFilter, tierFilter, searchQuery]);

  const updateBusinessStage = async (businessId: string, newStage: KanbanColumnId, oldStage?: KanbanColumnId) => {
    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_stage: newStage,
          previous_stage: oldStage // Para registrar el historial
        }),
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

    setColumns((prev) => {
      const newColumns = { ...prev };
      newColumns[sourceColumn] = prev[sourceColumn].filter((b) => b.id !== draggableId);
      const destItems = [...prev[destColumn].filter((b) => b.id !== draggableId)];
      destItems.splice(destination.index, 0, {
        ...business,
        sales_stage: destColumn as typeof business.sales_stage,
      });
      newColumns[destColumn] = destItems;
      return newColumns;
    });

    // Actualizar en DB con el stage anterior
    if (sourceColumn !== destColumn) {
      updateBusinessStage(draggableId, destColumn, sourceColumn);
    }
  };

  const handleCardClick = (business: KanbanBusiness, column: KanbanColumnId) => {
    setSelectedBusiness(business);
    setSelectedBusinessColumn(column);
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

    setColumns((prev) => {
      const newColumns = { ...prev };
      newColumns[sourceColumn!] = prev[sourceColumn!].filter((b) => b.id !== businessId);
      newColumns[newStage] = [{ ...business!, sales_stage: newStage as typeof business.sales_stage }, ...prev[newStage]];
      return newColumns;
    });

    setSelectedBusiness((prev) => prev ? { ...prev, sales_stage: newStage as typeof prev.sales_stage } : null);
    setSelectedBusinessColumn(newStage); // Actualizar la columna del modal
    updateBusinessStage(businessId, newStage, sourceColumn);
  };

  const handleActionRegistered = () => {
    setTimeout(() => fetchKanbanData(), 500);
  };

  // Sync selectedBusiness when columns data refreshes
  useEffect(() => {
    if (selectedBusiness) {
      const freshBiz = Object.values(columns).flat().find(b => b.id === selectedBusiness.id);
      if (freshBiz && JSON.stringify(freshBiz) !== JSON.stringify(selectedBusiness)) {
        setSelectedBusiness(freshBiz);
      }
    }
  }, [columns]); // eslint-disable-line react-hooks/exhaustive-deps

  // Obtener todos los leads con llamadas IA para el modal de insights
  const aiCallLeadsList = useMemo(() => {
    const allLeads = COLUMN_ORDER.flatMap(col =>
      columns[col].map(lead => ({ ...lead, currentColumn: col }))
    );

    // Filtrar por tiempo
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return allLeads
      .filter(l => {
        if (!l.aiCallResult?.hasAICall) return false;
        if (insightsTimeFilter === 'all') return true;

        const callDate = l.aiCallResult?.callDate ? new Date(l.aiCallResult.callDate) : null;
        if (!callDate) return false;

        switch (insightsTimeFilter) {
          case 'today': return callDate >= startOfToday;
          case 'week': return callDate >= startOfWeek;
          case 'month': return callDate >= startOfMonth;
          default: return true;
        }
      })
      .sort((a, b) => {
        // Primero ordenar por fecha (más recientes primero)
        const dateA = a.aiCallResult?.callDate ? new Date(a.aiCallResult.callDate).getTime() : 0;
        const dateB = b.aiCallResult?.callDate ? new Date(b.aiCallResult.callDate).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;

        // Si misma fecha, ordenar por outcome: interesados primero
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
  }, [columns, insightsTimeFilter]);

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
  const getOutcomeInfo = (outcome: string | null, shortSummary?: string | null) => {
    const summary = shortSummary || '';

    switch (outcome) {
      case 'wants_quote':
        return { label: `💰 ${summary || 'Quiere cotización'}`, color: 'text-green-700', bg: 'bg-green-100' };
      case 'interested':
        return { label: `🎯 ${summary || 'Interesado'}`, color: 'text-blue-700', bg: 'bg-blue-100' };
      case 'not_interested':
        return { label: `❌ ${summary || 'No interesado'}`, color: 'text-gray-600', bg: 'bg-gray-100' };
      case 'callback':
        return { label: `📅 ${summary || 'Llamar después'}`, color: 'text-[#9A7A35]', bg: 'bg-[#FFE9B3]' };
      case 'no_answer':
        return { label: `📵 ${summary || 'No contestó'}`, color: 'text-red-600', bg: 'bg-red-50' };
      case 'voicemail':
        return { label: `📭 ${summary || 'Buzón de voz'}`, color: 'text-gray-500', bg: 'bg-gray-50' };
      default:
        // Para 'completed', usar el resumen corto que es más descriptivo
        return { label: `📞 ${summary || 'Llamada completada'}`, color: 'text-purple-700', bg: 'bg-purple-100' };
    }
  };

  // Formatear fecha de llamada (inside component to use t())
  const formatCallDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `${t('ai.today_at')} ${date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `${t('ai.yesterday_at')} ${date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} ${t('ai.days_ago')}`;
    } else {
      return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    }
  };

  // Calcular insights adicionales
  const aiInsightsStats = useMemo(() => {
    if (aiCallLeadsList.length === 0) return null;

    // Calcular outcomes basados en la lista filtrada
    const filteredOutcomes = {
      interested: aiCallLeadsList.filter(l => l.aiCallResult?.outcome === 'interested' || l.aiCallResult?.outcome === 'wants_quote').length,
      notInterested: aiCallLeadsList.filter(l => l.aiCallResult?.outcome === 'not_interested').length,
      noAnswer: aiCallLeadsList.filter(l => l.aiCallResult?.outcome === 'no_answer').length,
      voicemail: aiCallLeadsList.filter(l => l.aiCallResult?.outcome === 'voicemail').length,
      other: aiCallLeadsList.filter(l => l.aiCallResult?.hasAICall && !['interested', 'wants_quote', 'not_interested', 'no_answer', 'voicemail'].includes(l.aiCallResult?.outcome || '')).length,
    };

    // Tasa de conexión (llamadas que conectaron vs total)
    const connected = aiCallLeadsList.filter(l =>
      ['wants_quote', 'interested', 'not_interested', 'callback'].includes(l.aiCallResult?.outcome || '')
    ).length;
    const connectionRate = Math.round((connected / aiCallLeadsList.length) * 100);

    // Tasa de interés (interesados vs conectados)
    const interested = filteredOutcomes.interested;
    const interestRate = connected > 0 ? Math.round((interested / connected) * 100) : 0;

    // Llamadas por día (aproximado)
    const dates = aiCallLeadsList
      .map(l => l.aiCallResult?.callDate)
      .filter(Boolean)
      .map(d => new Date(d!).toDateString());
    const uniqueDays = new Set(dates).size;
    const avgPerDay = uniqueDays > 0 ? Math.round(aiCallLeadsList.length / uniqueDays) : 0;

    // NUEVO: Leads que pidieron cotización pero no están en "cotizado" o "cliente"
    const pendingQuotes = aiCallLeadsList.filter(l =>
      (l.aiCallResult?.outcome === 'wants_quote' || l.aiCallResult?.outcome === 'interested') &&
      !['cotizado', 'cliente'].includes(l.currentColumn)
    );

    // NUEVO: Mejores horarios (análisis de cuándo contestan)
    const hourStats: Record<number, { total: number; connected: number }> = {};
    aiCallLeadsList.forEach(l => {
      if (l.aiCallResult?.callDate) {
        const hour = new Date(l.aiCallResult.callDate).getHours();
        if (!hourStats[hour]) hourStats[hour] = { total: 0, connected: 0 };
        hourStats[hour].total++;
        if (['wants_quote', 'interested', 'not_interested', 'callback'].includes(l.aiCallResult?.outcome || '')) {
          hourStats[hour].connected++;
        }
      }
    });

    // Encontrar mejor horario
    let bestHour = null;
    let bestRate = 0;
    Object.entries(hourStats).forEach(([hour, stats]) => {
      if (stats.total >= 3) { // Solo considerar si hay al menos 3 llamadas
        const rate = stats.connected / stats.total;
        if (rate > bestRate) {
          bestRate = rate;
          bestHour = parseInt(hour);
        }
      }
    });

    // NUEVO: Costo estimado (aprox 1000 créditos por llamada de 1 min)
    const estimatedCreditsUsed = aiCallLeadsList.length * 1500; // promedio estimado
    const costPerLead = interested > 0 ? Math.round(estimatedCreditsUsed / interested) : 0;

    // Contar cotizados y clientes que fueron contactados por IA
    const aiCotizados = aiCallLeadsList.filter(l => l.currentColumn === 'cotizado').length;
    const aiClientes = aiCallLeadsList.filter(l => l.currentColumn === 'cliente').length;

    // Cambios de etapa por resultado de IA
    // Cuenta basándose en el OUTCOME de la llamada, no en la columna actual
    // Si la IA clasificó como interested/wants_quote = la IA lo movió a "Interesado"
    // Si la IA clasificó como not_interested = la IA lo movió a "Perdido"
    const movedToInteresado = aiCallLeadsList.filter(l =>
      l.aiCallResult?.outcome === 'interested' || l.aiCallResult?.outcome === 'wants_quote'
    ).length;

    const movedToPerdido = aiCallLeadsList.filter(l =>
      l.aiCallResult?.outcome === 'not_interested'
    ).length;

    const totalAIMoves = movedToInteresado + movedToPerdido;

    return {
      connectionRate,
      interestRate,
      avgPerDay,
      uniqueDays,
      connected,
      pendingQuotes,
      bestHour,
      bestHourRate: Math.round(bestRate * 100),
      hourStats,
      estimatedCreditsUsed,
      costPerLead,
      outcomes: filteredOutcomes,
      aiCotizados,
      aiClientes,
      movedToInteresado,
      movedToPerdido,
      totalAIMoves,
    };
  }, [aiCallLeadsList]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500">{t('kanban.loading')}</p>
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
            {t('kanban.retry')}
          </button>
        </div>
      </div>
    );
  }

  const totalLeads = COLUMN_ORDER.reduce((sum, col) => sum + columns[col].length, 0);
  const activeLeads = columns.nuevo.length + columns.contactado.length + columns.seguimiento_1.length + columns.seguimiento_2.length + columns.seguimiento_3.length + columns.interesado.length + columns.cotizado.length;

  return (
    <div className="h-full">
      {/* Banner de seguimiento - Solo si hay leads que necesitan atención */}
      {followUpMetrics.needsAttention > 0 && (
        <div className={`mb-3 lg:mb-4 p-3 lg:p-4 rounded-xl border-2 ${
          followUpMetrics.finalCount > 0
            ? 'bg-gray-900 border-gray-700'
            : followUpMetrics.criticalCount > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`text-2xl sm:text-3xl ${followUpMetrics.finalCount > 0 ? '' : followUpMetrics.criticalCount > 0 ? 'animate-bounce' : 'animate-pulse'}`}>
                {followUpMetrics.finalCount > 0 ? '💀' : followUpMetrics.criticalCount > 0 ? '🔥' : '⏰'}
              </div>
              <div>
                <h3 className={`font-bold text-sm sm:text-base ${followUpMetrics.finalCount > 0 ? 'text-white' : followUpMetrics.criticalCount > 0 ? 'text-red-800' : 'text-blue-800'}`}>
                  {followUpMetrics.needsAttention} {t('kanban.needs_followup')}
                </h3>
                <p className={`text-xs sm:text-sm hidden sm:block ${followUpMetrics.finalCount > 0 ? 'text-gray-300' : followUpMetrics.criticalCount > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {getFollowUpTip(followUpMetrics.urgentCount, followUpMetrics.criticalCount, followUpMetrics.singleContactLeads, followUpMetrics.finalCount)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 text-xs sm:text-sm">
              {followUpMetrics.finalCount > 0 && (
                <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-gray-800 text-white rounded-full font-bold">
                  💀 {followUpMetrics.finalCount}
                </span>
              )}
              {followUpMetrics.criticalCount > 0 && (
                <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-red-200 text-red-800 rounded-full font-bold animate-pulse">
                  🔥 {followUpMetrics.criticalCount}
                </span>
              )}
              {followUpMetrics.urgentCount > 0 && (
                <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-200 text-blue-800 rounded-full font-medium">
                  ⏰ {followUpMetrics.urgentCount}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Alerta de respuestas humanas pendientes — imposible de ignorar */}
      {repliedLeads.total > 0 && (
        <div className={`mb-3 p-3 lg:p-4 rounded-xl border-2 ${
          repliedLeads.stale.length > 0
            ? 'bg-red-50 border-red-300'
            : 'bg-green-50 border-green-300'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
              <div className={`text-2xl sm:text-3xl ${repliedLeads.stale.length > 0 ? 'animate-pulse' : ''}`}>
                💬
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-bold text-sm sm:text-base ${repliedLeads.stale.length > 0 ? 'text-red-800' : 'text-green-800'}`}>
                  {repliedLeads.stale.length > 0 ? (
                    <>⚠️ {repliedLeads.stale.length} {repliedLeads.stale.length === 1 ? 'lead respondió' : 'leads respondieron'} hace +{STALE_REPLY_DAYS} días — esperando respuesta de Alejandro</>
                  ) : (
                    <>✓ {repliedLeads.recent.length} {repliedLeads.recent.length === 1 ? 'lead respondió' : 'leads respondieron'} recientemente</>
                  )}
                </h3>
                {/* Chips clicables (atajo a la columna virtual de respondidos) */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[...repliedLeads.stale, ...repliedLeads.recent].slice(0, 12).map(({ lead, days }) => (
                    <button
                      key={lead.id}
                      onClick={() => handleCardClick(lead, lead.sales_stage as KanbanColumnId)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        days >= STALE_REPLY_DAYS
                          ? 'bg-red-200 text-red-900 hover:bg-red-300 border border-red-300'
                          : 'bg-white text-green-800 hover:bg-green-100 border border-green-200'
                      }`}
                      title={`${days}d sin respuesta de Alejandro`}
                    >
                      {lead.name.split(' ').slice(0, 3).join(' ')} <span className="opacity-70">· {days}d</span>
                    </button>
                  ))}
                  {repliedLeads.total > 12 && (
                    <button
                      onClick={() => setPhoneFilter('replied')}
                      className="px-2 py-0.5 rounded-full text-xs text-gray-600 hover:text-gray-900 underline"
                    >
                      +{repliedLeads.total - 12} más
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Frase motivacional - Hidden on mobile */}
      <div className="hidden lg:block mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-800 italic">"{motivationalQuote.quote}"</p>
        <p className="text-xs text-blue-600 mt-1">— {motivationalQuote.author}</p>
      </div>

      {/* Stats rápidos con métricas de seguimiento */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3 lg:mb-4 text-xs sm:text-sm">
        {/* Botón de Campaña IA — OCULTO TEMPORALMENTE */}

        <button
          onClick={() => setShowAddManual(true)}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 transition-colors"
          title={t('manual.subtitle')}
        >
          {t('kanban.add_lead')}
        </button>

        <span className="text-gray-600"><strong>{totalLeads}</strong> leads</span>
        <span className="text-blue-600"><strong>{activeLeads}</strong> {t('kanban.active')}</span>
        <button onClick={() => setColumnFilter(columnFilter === 'clientes' ? 'all' : 'clientes')} className={`hidden sm:inline cursor-pointer ${columnFilter === 'clientes' ? 'text-green-700 font-bold underline' : 'text-green-600 hover:underline'}`}><strong>{columns.cliente.length}</strong> {t('kanban.customers')}</button>
        <button onClick={() => setColumnFilter(columnFilter === 'por_cerrar' ? 'all' : 'por_cerrar')} className={`hidden sm:inline cursor-pointer ${columnFilter === 'por_cerrar' ? 'text-[#8B6914] font-bold underline' : 'text-[#B8923F] hover:underline'}`}><strong>{columns.interesado.length + columns.cotizado.length}</strong> {t('kanban.to_close')}</button>

        {/* Orca/Delfin pipeline metrics */}
        {(() => {
          const allLeads = COLUMN_ORDER.flatMap(col => columns[col]);
          const orcaCount = allLeads.filter(l => l.potential_tier === 'orca').length;
          const delfinCount = allLeads.filter(l => l.potential_tier === 'delfin').length;
          if (orcaCount === 0 && delfinCount === 0) return null;

          // Pipeline value = sum of avg revenue for active leads (not perdido/cliente)
          const activeCols: KanbanColumnId[] = ['nuevo', 'contactado', 'seguimiento_1', 'seguimiento_2', 'seguimiento_3', 'interesado', 'cotizado'];
          const activeOrcas = activeCols.flatMap(col => columns[col]).filter(l => l.potential_tier === 'orca');
          const pipelineValue = activeOrcas.reduce((sum, l) => {
            const avg = ((l.estimated_revenue_min || 0) + (l.estimated_revenue_max || 0)) / 2;
            return sum + avg;
          }, 0);

          return (
            <>
              <span className="hidden sm:block border-l border-gray-300 h-4 mx-1"></span>
              <button
                onClick={() => setTierFilter(tierFilter === 'orca' ? 'all' : 'orca')}
                title="Filtrar Orcas"
                className={`px-1.5 py-0.5 rounded-full font-medium transition-colors cursor-pointer ${
                  tierFilter === 'orca'
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                🐋 {orcaCount}
              </button>
              <button
                onClick={() => setTierFilter(tierFilter === 'delfin' ? 'all' : 'delfin')}
                title="Filtrar Delfines"
                className={`px-1.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                  tierFilter === 'delfin'
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                🐬 {delfinCount}
              </button>
              {pipelineValue > 0 && (
                <span className="hidden sm:inline text-blue-600 text-xs">
                  ~S/{(pipelineValue / 1000).toFixed(0)}k/mes
                </span>
              )}
            </>
          );
        })()}

        {/* WhatsApp stats */}
        {(whatsappStats.sentToday > 0 || whatsappStats.repliesUnread > 0) && (
          <>
            <span className="hidden sm:block border-l border-gray-300 h-4 mx-1"></span>
            {whatsappStats.repliesUnread > 0 && (
              <button
                onClick={() => setPhoneFilter(phoneFilter === 'replied' ? 'all' : 'replied')}
                title={whatsappStats.repliesBot > 0 ? `${whatsappStats.repliesHuman} humanos · ${whatsappStats.repliesBot} bots` : undefined}
                className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  phoneFilter === 'replied'
                    ? 'bg-green-600 text-white'
                    : repliedLeads.stale.length > 0
                      ? 'bg-red-100 text-red-700 animate-pulse hover:bg-red-200 ring-2 ring-red-400'
                      : whatsappStats.repliesHuman > 0
                        ? 'bg-green-100 text-green-700 animate-pulse hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                💬 {whatsappStats.repliesHuman}
                {repliedLeads.stale.length > 0 && (
                  <span className="ml-1 font-bold">⚠️{repliedLeads.stale.length}</span>
                )}
                {whatsappStats.repliesBot > 0 ? <span className="opacity-60 font-normal"> · {whatsappStats.repliesBot} bot{whatsappStats.repliesBot === 1 ? '' : 's'}</span> : null}
              </button>
            )}
            {whatsappStats.sentToday > 0 && (
              <button
                onClick={() => setPhoneFilter(phoneFilter === 'sent_today' ? 'all' : 'sent_today')}
                title={`${whatsappStats.sentManualToday} enviados por Alejandro · ${whatsappStats.sentAutoToday} enviados por el sistema`}
                className={`text-xs transition-colors cursor-pointer ${
                  phoneFilter === 'sent_today'
                    ? 'text-green-700 font-bold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📱 {whatsappStats.sentToday} enviados hoy{' '}
                <span className="opacity-70">
                  ({whatsappStats.sentManualToday > 0 && <span className="text-orange-600">✋{whatsappStats.sentManualToday}</span>}
                  {whatsappStats.sentManualToday > 0 && whatsappStats.sentAutoToday > 0 && <span> · </span>}
                  {whatsappStats.sentAutoToday > 0 && <span className="text-purple-500">🤖{whatsappStats.sentAutoToday}</span>})
                </span>
              </button>
            )}
          </>
        )}

        {/* Métricas de llamadas IA — OCULTO TEMPORALMENTE */}
      </div>

      {/* Buscador + Filtros */}
      <div className="flex items-center gap-2 mb-2 lg:mb-3 flex-wrap">
        {/* Buscador */}
        <div className="relative flex items-center">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar lead… (/)"
            className={`pl-7 pr-6 py-1 text-xs sm:text-sm rounded-lg border transition-colors focus:outline-none w-40 sm:w-52 ${
              searchQuery
                ? 'bg-blue-50 border-blue-400 text-blue-900 placeholder-blue-300'
                : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 hover:border-gray-300 focus:border-blue-400'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-xs leading-none"
              title="Limpiar búsqueda (Esc)"
            >✕</button>
          )}
        </div>
        {searchQuery && (() => {
          const total = COLUMN_ORDER.reduce((s, col) => s + filteredColumns[col].length, 0);
          return (
            <span className="text-xs text-blue-600 font-medium">
              {total} resultado{total !== 1 ? 's' : ''}
            </span>
          );
        })()}

        {/* Filtro estado WhatsApp */}
        <select
          value={phoneFilter}
          onChange={(e) => setPhoneFilter(e.target.value as 'all' | 'whatsapp' | 'no_phone')}
          className={`text-xs sm:text-sm px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
            phoneFilter !== 'all'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
          }`}
        >
          <option value="all">📱 Todos</option>
          <option value="whatsapp">📱 Con WhatsApp</option>
          <option value="sent_today">📤 Enviados hoy</option>
          <option value="replied">💬 Respondieron</option>
          <option value="no_phone">🚫 Sin WhatsApp</option>
        </select>
        {phoneFilter !== 'all' && (
          <button
            onClick={() => setPhoneFilter('all')}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="Limpiar filtro"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filtro por industria — compact select */}
      {availableIndustries.length > 1 && (
        <div className="flex items-center gap-1.5 mb-2 lg:mb-3">
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value as IndustryCategory | 'all')}
            className={`text-xs sm:text-sm px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
              industryFilter !== 'all'
                ? 'bg-[#0890F1] text-white border-[#0890F1]'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            <option value="all">🏢 {t('kanban.filter_all')} ({COLUMN_ORDER.reduce((sum, col) => sum + columns[col].length, 0)})</option>
            {availableIndustries.map(({ industry, count }) => {
              const info = INDUSTRY_LABELS[industry] || INDUSTRY_LABELS.other;
              return (
                <option key={industry} value={industry}>
                  {info.emoji} {info.label} ({count})
                </option>
              );
            })}
          </select>
          {industryFilter !== 'all' && (
            <button
              onClick={() => setIndustryFilter('all')}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              title="Limpiar filtro"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-4 -mx-2 px-2 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none">
          {COLUMN_ORDER.filter(columnId => {
            if (columnFilter === 'clientes') return columnId === 'cliente';
            if (columnFilter === 'por_cerrar') return columnId === 'interesado' || columnId === 'cotizado';
            return true;
          }).map((columnId) => (
            <KanbanColumn
              key={columnId}
              id={`col-${columnId}`}
              columnId={columnId}
              businesses={filteredColumns[columnId]}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Modal de detalle */}
      {selectedBusiness && (
        <LeadDetailModal
          business={selectedBusiness}
          currentColumn={selectedBusinessColumn}
          onClose={() => setSelectedBusiness(null)}
          onStageChange={handleStageChange}
          onActionRegistered={handleActionRegistered}
        />
      )}

      {/* Modal de AI Insights */}
      {showAIInsights && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAIInsights(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Fixed */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    {t('ai.insights_title')}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {aiCallLeadsList.length} {t('ai.calls')} {insightsTimeFilter === 'today' ? t('ai.today').toLowerCase() : insightsTimeFilter === 'week' ? t('ai.this_week').toLowerCase() : insightsTimeFilter === 'month' ? t('ai.this_month').toLowerCase() : t('ai.all_time').toLowerCase()}
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

              {/* Filtro de tiempo */}
              <div className="flex gap-2 mt-3">
                {[
                  { value: 'today', label: t('ai.today') },
                  { value: 'week', label: t('ai.this_week') },
                  { value: 'month', label: t('ai.this_month') },
                  { value: 'all', label: t('ai.all_time') },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setInsightsTimeFilter(value as typeof insightsTimeFilter)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      insightsTimeFilter === value
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Resumen de resultados */}
              {aiInsightsStats && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    🎯 {aiInsightsStats.outcomes.interested} {t('ai.interested')}
                  </span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                    ❌ {aiInsightsStats.outcomes.notInterested} {t('ai.not_interested')}
                  </span>
                  <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm">
                    📵 {aiInsightsStats.outcomes.noAnswer} {t('ai.no_answer')}
                  </span>
                  <span className="px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-sm">
                    📭 {aiInsightsStats.outcomes.voicemail} {t('ai.voicemail')}
                  </span>
                  {aiInsightsStats.outcomes.other > 0 && (
                    <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-sm">
                      📞 {aiInsightsStats.outcomes.other} {t('ai.others')}
                    </span>
                  )}
                </div>
              )}

              {/* Insights adicionales */}
              {aiInsightsStats && (
                <div className="grid grid-cols-4 gap-3 mt-4 pt-3 border-t border-purple-100">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-700">{aiInsightsStats.connectionRate}%</div>
                    <div className="text-xs text-gray-500">{t('ai.connection_rate')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{aiInsightsStats.interestRate}%</div>
                    <div className="text-xs text-gray-500">{t('ai.interest_rate')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{aiInsightsStats.avgPerDay}</div>
                    <div className="text-xs text-gray-500">{t('ai.calls_day')}</div>
                  </div>
                  {/* Cambios de etapa por IA - inline */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">
                      {aiInsightsStats.totalAIMoves}
                      {aiInsightsStats.totalAIMoves > 0 && (
                        <span className="text-sm ml-1">
                          ({aiInsightsStats.movedToInteresado}🎯 {aiInsightsStats.movedToPerdido}❌)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{t('ai.moved_by_ai')}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
            {/* ALERTA DE ACCIÓN - Leads pendientes de cotización */}
            {aiInsightsStats?.pendingQuotes && aiInsightsStats.pendingQuotes.length > 0 && (
              <div className="mx-6 mt-4 p-4 bg-[#FFF8E7] border-2 border-[#FFD06D] rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔥</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-[#7C622A]">
                      {aiInsightsStats.pendingQuotes.length} {t('ai.pending_quotes')}
                    </h4>
                    <p className="text-sm text-[#9A7A35] mt-1">
                      {t('ai.pending_quotes_desc')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {aiInsightsStats.pendingQuotes.slice(0, 5).map(lead => (
                        <button
                          key={lead.id}
                          onClick={() => {
                            setShowAIInsights(false);
                            setSelectedBusiness(lead);
                          }}
                          className="px-3 py-1 bg-white border border-[#FFD06D] rounded-full text-sm font-medium text-[#7C622A] hover:bg-[#FFE9B3] transition-colors"
                        >
                          {lead.name.split(' ').slice(0, 2).join(' ')}
                        </button>
                      ))}
                      {aiInsightsStats.pendingQuotes.length > 5 && (
                        <span className="px-3 py-1 text-sm text-[#B8923F]">
                          +{aiInsightsStats.pendingQuotes.length - 5} más
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FUNNEL VISUAL */}
            {aiInsightsStats && (
              <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  📊 {t('ai.conversion_funnel')}
                </h4>
                <div className="flex items-center justify-between gap-2">
                  {/* Llamadas */}
                  <div className="flex-1 text-center">
                    <div className="w-full bg-blue-500 text-white rounded-lg py-3 px-2">
                      <div className="text-xl font-bold">{aiCallLeadsList.length}</div>
                      <div className="text-xs opacity-90">{t('ai.funnel_calls')}</div>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                  {/* Conectaron */}
                  <div className="flex-1 text-center">
                    <div className="w-full bg-purple-500 text-white rounded-lg py-3 px-2" style={{ width: `${Math.max(60, aiInsightsStats.connectionRate)}%`, margin: '0 auto' }}>
                      <div className="text-xl font-bold">{aiInsightsStats.connected}</div>
                      <div className="text-xs opacity-90">{t('ai.funnel_connected')}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{aiInsightsStats.connectionRate}%</div>
                  </div>
                  <span className="text-gray-400">→</span>
                  {/* Interesados */}
                  <div className="flex-1 text-center">
                    <div className="w-full bg-green-500 text-white rounded-lg py-3 px-2" style={{ width: `${Math.max(50, aiInsightsStats.interestRate)}%`, margin: '0 auto' }}>
                      <div className="text-xl font-bold">{aiInsightsStats.outcomes.interested}</div>
                      <div className="text-xs opacity-90">{t('ai.funnel_interested')}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{aiInsightsStats.interestRate}%</div>
                  </div>
                  <span className="text-gray-400">→</span>
                  {/* Cotizados (por IA) */}
                  <div className="flex-1 text-center">
                    <div className="w-full bg-[#FFF8E7]0 text-white rounded-lg py-3 px-2">
                      <div className="text-xl font-bold">{aiInsightsStats.aiCotizados}</div>
                      <div className="text-xs opacity-90">{t('ai.funnel_quoted')}</div>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                  {/* Clientes (por IA) */}
                  <div className="flex-1 text-center">
                    <div className="w-full bg-emerald-600 text-white rounded-lg py-3 px-2">
                      <div className="text-xl font-bold">{aiInsightsStats.aiClientes}</div>
                      <div className="text-xs opacity-90">{t('ai.funnel_customers')}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MOVIMIENTOS DE ETAPA POR IA */}
            {aiInsightsStats && aiInsightsStats.totalAIMoves > 0 && (
              <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <h4 className="font-semibold text-gray-800">{t('ai.stage_changes')}</h4>
                    <p className="text-sm text-gray-600">
                      {t('ai.stage_changes_desc')} <strong className="text-indigo-700">{aiInsightsStats.totalAIMoves}</strong>
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  {aiInsightsStats.movedToInteresado > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-green-200">
                      <span className="text-lg">🎯</span>
                      <div>
                        <div className="text-lg font-bold text-green-700">{aiInsightsStats.movedToInteresado}</div>
                        <div className="text-xs text-gray-500">{t('ai.to_interested')}</div>
                      </div>
                    </div>
                  )}
                  {aiInsightsStats.movedToPerdido > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
                      <span className="text-lg">❌</span>
                      <div>
                        <div className="text-lg font-bold text-gray-600">{aiInsightsStats.movedToPerdido}</div>
                        <div className="text-xs text-gray-500">{t('ai.to_lost')}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MEJOR HORARIO */}
            {aiInsightsStats && aiInsightsStats.bestHour !== null && (
              <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⏰</span>
                    <div>
                      <h4 className="font-semibold text-gray-800">{t('ai.best_time')}</h4>
                      <p className="text-sm text-gray-600">
                        <span className="font-bold text-green-700">
                          {aiInsightsStats.bestHour}:00 - {aiInsightsStats.bestHour + 1}:00
                        </span>
                        {' '}{aiInsightsStats.bestHourRate}% {t('ai.connection_at')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{t('ai.tip_schedule')}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de llamadas */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-180px)]">
              <div className="space-y-3">
                {aiCallLeadsList.map((lead) => {
                  const outcomeInfo = getOutcomeInfo(lead.aiCallResult?.outcome || null, lead.aiCallResult?.shortSummary);
                  const leadColumnConfig = columnConfig[lead.currentColumn as KanbanColumnId];
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
                            <span className={`px-2 py-0.5 rounded text-xs ${leadColumnConfig?.bgColor || 'bg-gray-100'} ${leadColumnConfig?.color || 'text-gray-600'}`}>
                              {leadColumnConfig?.icon} {leadColumnConfig?.title || lead.currentColumn}
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
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {lead.aiCallResult?.callDate && (
                            <span className="flex items-center gap-1">
                              📅 {formatCallDate(lead.aiCallResult.callDate)}
                            </span>
                          )}
                          {lead.phone && <span>{lead.phone}</span>}
                        </div>
                        <button
                          onClick={() => {
                            setShowAIInsights(false);
                            setSelectedBusiness(lead);
                          }}
                          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                        >
                          {t('ai.view_detail')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {aiCallLeadsList.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl mb-4 block">🤖</span>
                  <p className="font-medium">{t('ai.no_calls')}</p>
                  <p className="text-sm mt-1">{t('ai.no_calls_desc')}</p>
                </div>
              )}
            </div>
            </div>{/* End scrollable content */}

            {/* Footer - Fixed */}
            <div className="flex-shrink-0 px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>
                  {t('ai.connected')} <strong className="text-blue-600">{aiInsightsStats?.connected || 0}</strong> de {aiCallLeadsList.length}
                </span>
                <span className="text-gray-300">|</span>
                <span>
                  {t('ai.interested_of')} <strong className="text-green-600">
                    {aiInsightsStats?.outcomes.interested || 0}
                  </strong> ({aiInsightsStats?.interestRate || 0}% {t('ai.of_connected')})
                </span>
              </div>
              <button
                onClick={() => setShowAIInsights(false)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                {t('biz.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de agregar lead manual */}
      <AddManualLeadModal
        isOpen={showAddManual}
        onClose={() => setShowAddManual(false)}
        onCreated={fetchKanbanData}
      />

      {/* Modal de Campaña IA */}
      <AICampaignModal
        isOpen={showAICampaign}
        onClose={() => setShowAICampaign(false)}
        leads={{
          nuevos: columns.nuevo,
          seguimiento: [...columns.seguimiento_1, ...columns.seguimiento_2, ...columns.seguimiento_3, ...columns.contactado],
        }}
        onCampaignComplete={() => {
          setTimeout(() => fetchKanbanData(), 2000);
        }}
      />
    </div>
  );
}
