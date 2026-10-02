'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { KanbanBusiness, KanbanColumnId, KanbanResponse } from '@/app/api/kanban/route';
import KanbanColumn from './KanbanColumn';
import LeadDetailModal from './LeadDetailModal';
import AICampaignModal from './AICampaignModal';
import AddManualLeadModal from './AddManualLeadModal';
import InsightsModal from './InsightsModal';
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

// 'YYYY-MM' -> 'June 2026'
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Motivational quotes about follow-up
const FOLLOW_UP_QUOTES = [
  { quote: "80% of sales require 5 follow-ups. 44% of salespeople give up after 1.", author: "B2B sales statistic" },
  { quote: "The fortune is in the follow-up.", author: "Jim Rohn" },
  { quote: "One follow-up is worth more than 100 first contacts.", author: "Sales wisdom" },
  { quote: "He who perseveres, sells.", author: "Sales saying" },
  { quote: "Every follow-up brings you closer to the close.", author: "Sales principle" },
];

const INDUSTRY_LABELS: Record<string, { emoji: string; label: string }> = {
  hotel_luxury: { emoji: '🏨', label: 'Hotels 5★' },
  hotel_mid: { emoji: '🏨', label: 'Hotels 3-4★' },
  hotel_budget: { emoji: '🛏️', label: 'Hostels' },
  hospital: { emoji: '🏥', label: 'Hospitals' },
  clinic: { emoji: '⚕️', label: 'Clinics' },
  club: { emoji: '🏌️', label: 'Clubs' },
  spa_premium: { emoji: '💆', label: 'Premium Spas' },
  spa_basic: { emoji: '💆', label: 'Spas' },
  gym_premium: { emoji: '🏋️', label: 'Premium Gyms' },
  gym_basic: { emoji: '🏋️', label: 'Gyms' },
  pilates: { emoji: '🧘', label: 'Pilates' },
  restaurant_gourmet: { emoji: '🍽️', label: 'Gourmet Rest.' },
  restaurant_mid: { emoji: '🍽️', label: 'Restaurants' },
  security: { emoji: '🛡️', label: 'Security' },
  cleaning: { emoji: '🧹', label: 'Cleaning' },
  industrial: { emoji: '🏭', label: 'Industrial' },
  events: { emoji: '🎪', label: 'Events' },
  residence: { emoji: '🏠', label: 'Nursing homes' },
  university: { emoji: '🎓', label: 'Universities' },
  cooperative: { emoji: '🤝', label: 'Cooperatives' },
  real_estate: { emoji: '🏢', label: 'Real Estate' },
  other: { emoji: '🏢', label: 'Other' },
};

// Follow-up tips by situation
function getFollowUpTip(urgentCount: number, criticalCount: number, contactedWithoutFollowUp: number, finalCount?: number): string {
  if (finalCount && finalCount > 0) {
    return `💀 ${finalCount} leads have gone +9 days! It's now or never. Killer message: "Yes or no?"`;
  }
  if (criticalCount > 0) {
    return `🔥 ${criticalCount} leads have gone 6-8 days without contact! Interest cools fast. Act TODAY.`;
  }
  if (urgentCount > 0) {
    return `⏰ ${urgentCount} leads need follow-up (3-5 days). A message now can close the sale.`;
  }
  if (contactedWithoutFollowUp > 5) {
    return `💡 Tip: The best salespeople make 3-5 contacts per lead. Have you followed up yet?`;
  }
  return `✅ Great work! Keep a steady follow-up pace.`;
}

type OwnerFilter = 'all' | 'martin' | 'alejandro' | 'bot';

export default function KanbanBoard({
  ownerFilter: ownerFilterProp,
  onOwnerFilterChange,
}: {
  ownerFilter?: OwnerFilter;
  onOwnerFilterChange?: (o: OwnerFilter) => void;
} = {}) {
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
  const [showInsights, setShowInsights] = useState(false);
  // Bumped after deleting a lead so Insights re-fetches with a fresh duplicate list
  const [insightsRefreshKey, setInsightsRefreshKey] = useState(0);
  const [insightsTimeFilter, setInsightsTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [industryFilter, setIndustryFilter] = useState<IndustryCategory | 'all'>('all');
  const [phoneFilter, setPhoneFilter] = useState<'all' | 'whatsapp' | 'replied_human' | 'replied_bot' | 'replied_today' | 'sent_today' | 'no_phone'>('all');
  const [columnFilter, setColumnFilter] = useState<'all' | 'clientes' | 'por_cerrar'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'orca' | 'delfin'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual'>('all');
  const [focusFilter, setFocusFilter] = useState<'all' | 'focus'>('all');
  // Rep/owner filter: see how each one is doing (Martín, Alejandro, Bot).
  // Controlled from the Pipeline (shared bar) when it arrives by prop; otherwise local.
  const [ownerFilterInternal, setOwnerFilterInternal] = useState<OwnerFilter>('all');
  const ownerFilter = ownerFilterProp ?? ownerFilterInternal;
  const setOwnerFilter = onOwnerFilterChange ?? setOwnerFilterInternal;
  // Filter by lead creation month ('all' | 'YYYY-MM')
  const [monthFilter, setMonthFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Audio player for AI insights modal
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pick a random motivational quote (but stable during the session)
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

  // Calculate follow-up metrics - now based on the columns
  const followUpMetrics = useMemo(() => {
    const seguimiento1Count = columns.seguimiento_1.length;
    const seguimiento2Count = columns.seguimiento_2.length;
    const seguimiento3Count = columns.seguimiento_3.length;
    const recentCount = columns.contactado.length;

    // Leads contacted only once in the entire active pipeline
    const allActiveLeads = [
      ...columns.contactado,
      ...columns.seguimiento_1,
      ...columns.seguimiento_2,
      ...columns.seguimiento_3,
      ...columns.interesado,
      ...columns.cotizado,
    ];
    const singleContactLeads = allActiveLeads.filter(l => l.contactCount === 1).length;

    // Count leads that had an AI call
    const allLeads = COLUMN_ORDER.flatMap(col => columns[col]);
    const aiCallLeads = allLeads.filter(l => l.aiCallResult?.hasAICall).length;

    // Count by AI call outcome
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
    // Filter out industries with 0, sort alphabetically by label
    return Object.entries(industryCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => {
        const labelA = INDUSTRY_LABELS[a[0]]?.label || a[0];
        const labelB = INDUSTRY_LABELS[b[0]]?.label || b[0];
        return labelA.localeCompare(labelB, 'es');
      })
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

  // Available months (by lead creation date), most recent to oldest
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    COLUMN_ORDER.forEach(col => {
      columns[col].forEach(lead => {
        if (lead.created_at) set.add(lead.created_at.slice(0, 7)); // 'YYYY-MM'
      });
    });
    return Array.from(set).sort().reverse();
  }, [columns]);

  // Filtered columns based on industry + phone + search + month filters
  const filteredColumns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (industryFilter === 'all' && phoneFilter === 'all' && tierFilter === 'all' && sourceFilter === 'all' && focusFilter === 'all' && ownerFilter === 'all' && monthFilter === 'all' && !q) return columns;
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
        if (phoneFilter === 'replied_human' && !lead.has_human_reply) return false;
        if (phoneFilter === 'replied_bot' && !(lead.has_unread_reply && !lead.has_human_reply)) return false;
        if (phoneFilter === 'replied_today' && !lead.replied_today) return false;
        if (phoneFilter === 'sent_today' && !lead.contacted_today) return false;
        if (phoneFilter === 'no_phone' && hasWhatsApp(lead.phone)) return false;
        if (tierFilter !== 'all' && lead.potential_tier !== tierFilter) return false;
        if (sourceFilter === 'manual' && lead.source !== 'manual') return false;
        if (focusFilter === 'focus' && !lead.is_focus) return false;
        if (ownerFilter === 'martin' && !(lead.owner_name === 'Martin' || lead.owner_name === 'Martín')) return false;
        if (ownerFilter === 'alejandro' && lead.owner_name !== 'Alejandro') return false;
        if (ownerFilter === 'bot' && !(!lead.contacted_by && lead.contacted_at)) return false;
        if (monthFilter !== 'all' && (lead.created_at?.slice(0, 7) ?? '') !== monthFilter) return false;
        if (q) {
          const haystack = [lead.name, lead.phone, lead.address, lead.business_type, lead.city]
            .filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
    });
    return filtered;
  }, [columns, industryFilter, phoneFilter, tierFilter, sourceFilter, focusFilter, ownerFilter, monthFilter, searchQuery]);

  const updateBusinessStage = async (businessId: string, newStage: KanbanColumnId, oldStage?: KanbanColumnId) => {
    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_stage: newStage,
          previous_stage: oldStage // To record the history
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update stage');
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

    // Update in DB with the previous stage
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
    setSelectedBusinessColumn(newStage); // Update the modal's column
    updateBusinessStage(businessId, newStage, sourceColumn);
  };

  const handleActionRegistered = () => {
    setTimeout(() => fetchKanbanData(), 500);
    // Bump insights refreshKey so the duplicate list updates after deletes/edits
    setInsightsRefreshKey(k => k + 1);
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

  // Get all leads with AI calls for the insights modal
  const aiCallLeadsList = useMemo(() => {
    const allLeads = COLUMN_ORDER.flatMap(col =>
      columns[col].map(lead => ({ ...lead, currentColumn: col }))
    );

    // Filter by time
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
        // First sort by date (most recent first)
        const dateA = a.aiCallResult?.callDate ? new Date(a.aiCallResult.callDate).getTime() : 0;
        const dateB = b.aiCallResult?.callDate ? new Date(b.aiCallResult.callDate).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;

        // If same date, sort by outcome: interested first
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

  // Play AI call audio
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

  // Get outcome label and color
  const getOutcomeInfo = (outcome: string | null, shortSummary?: string | null) => {
    const summary = shortSummary || '';

    switch (outcome) {
      case 'wants_quote':
        return { label: `💰 ${summary || 'Wants a quote'}`, color: 'text-green-700', bg: 'bg-green-100' };
      case 'interested':
        return { label: `🎯 ${summary || 'Interested'}`, color: 'text-blue-700', bg: 'bg-blue-100' };
      case 'not_interested':
        return { label: `❌ ${summary || 'Not interested'}`, color: 'text-gray-600', bg: 'bg-gray-100' };
      case 'callback':
        return { label: `📅 ${summary || 'Call later'}`, color: 'text-[#9A7A35]', bg: 'bg-[#FFE9B3]' };
      case 'no_answer':
        return { label: `📵 ${summary || 'No answer'}`, color: 'text-red-600', bg: 'bg-red-50' };
      case 'voicemail':
        return { label: `📭 ${summary || 'Voicemail'}`, color: 'text-gray-500', bg: 'bg-gray-50' };
      default:
        // For 'completed', use the short summary which is more descriptive
        return { label: `📞 ${summary || 'Call completed'}`, color: 'text-purple-700', bg: 'bg-purple-100' };
    }
  };

  // Format call date (inside component to use t())
  const formatCallDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `${t('ai.today_at')} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `${t('ai.yesterday_at')} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} ${t('ai.days_ago')}`;
    } else {
      return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    }
  };

  // Calculate additional insights
  const aiInsightsStats = useMemo(() => {
    if (aiCallLeadsList.length === 0) return null;

    // Calculate outcomes based on the filtered list
    const filteredOutcomes = {
      interested: aiCallLeadsList.filter(l => l.aiCallResult?.outcome === 'interested' || l.aiCallResult?.outcome === 'wants_quote').length,
      notInterested: aiCallLeadsList.filter(l => l.aiCallResult?.outcome === 'not_interested').length,
      noAnswer: aiCallLeadsList.filter(l => l.aiCallResult?.outcome === 'no_answer').length,
      voicemail: aiCallLeadsList.filter(l => l.aiCallResult?.outcome === 'voicemail').length,
      other: aiCallLeadsList.filter(l => l.aiCallResult?.hasAICall && !['interested', 'wants_quote', 'not_interested', 'no_answer', 'voicemail'].includes(l.aiCallResult?.outcome || '')).length,
    };

    // Connection rate (calls that connected vs total)
    const connected = aiCallLeadsList.filter(l =>
      ['wants_quote', 'interested', 'not_interested', 'callback'].includes(l.aiCallResult?.outcome || '')
    ).length;
    const connectionRate = Math.round((connected / aiCallLeadsList.length) * 100);

    // Interest rate (interested vs connected)
    const interested = filteredOutcomes.interested;
    const interestRate = connected > 0 ? Math.round((interested / connected) * 100) : 0;

    // Calls per day (approximate)
    const dates = aiCallLeadsList
      .map(l => l.aiCallResult?.callDate)
      .filter(Boolean)
      .map(d => new Date(d!).toDateString());
    const uniqueDays = new Set(dates).size;
    const avgPerDay = uniqueDays > 0 ? Math.round(aiCallLeadsList.length / uniqueDays) : 0;

    // NEW: Leads that asked for a quote but aren't in "cotizado" or "cliente"
    const pendingQuotes = aiCallLeadsList.filter(l =>
      (l.aiCallResult?.outcome === 'wants_quote' || l.aiCallResult?.outcome === 'interested') &&
      !['cotizado', 'cliente'].includes(l.currentColumn)
    );

    // NEW: Best time slots (analysis of when they answer)
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

    // Find the best time slot
    let bestHour = null;
    let bestRate = 0;
    Object.entries(hourStats).forEach(([hour, stats]) => {
      if (stats.total >= 3) { // Only consider if there are at least 3 calls
        const rate = stats.connected / stats.total;
        if (rate > bestRate) {
          bestRate = rate;
          bestHour = parseInt(hour);
        }
      }
    });

    // NEW: Estimated cost (approx 1000 credits per 1-min call)
    const estimatedCreditsUsed = aiCallLeadsList.length * 1500; // estimated average
    const costPerLead = interested > 0 ? Math.round(estimatedCreditsUsed / interested) : 0;

    // Count quoted and customers that were contacted by AI
    const aiCotizados = aiCallLeadsList.filter(l => l.currentColumn === 'cotizado').length;
    const aiClientes = aiCallLeadsList.filter(l => l.currentColumn === 'cliente').length;

    // Stage changes by AI result
    // Counts based on the call OUTCOME, not the current column
    // If the AI classified as interested/wants_quote = the AI moved it to "Interesado"
    // If the AI classified as not_interested = the AI moved it to "Perdido"
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
      {/* Follow-up banner - Only if there are leads that need attention */}
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

      {/* ⭐ Focus leads banner — current sprint */}
      {(() => {
        // Only active leads — won/lost are no longer actionable focus
        const activeFocusCols: KanbanColumnId[] = [
          'nuevo', 'contactado', 'seguimiento_1', 'seguimiento_2',
          'seguimiento_3', 'interesado', 'cotizado',
        ];
        const focused = activeFocusCols.flatMap(col => columns[col]).filter(l => l.is_focus);
        if (focused.length === 0) return null;
        return (
          <div className="mb-3 p-3 lg:p-4 rounded-xl border-2 bg-yellow-50 border-yellow-300">
            <div className="flex items-start gap-3">
              <div className="text-2xl sm:text-3xl">⭐</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-yellow-900">
                  {t('kanban.focus_banner_title').replace('{n}', String(focused.length))}
                </h3>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {focused.slice(0, 8).map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => handleCardClick(lead, lead.sales_stage as KanbanColumnId)}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-white text-yellow-900 border border-yellow-300 hover:bg-yellow-100 transition-colors"
                      title={`${lead.name} — ${lead.sales_stage || 'nuevo'}`}
                    >
                      {lead.name.split(' ').slice(0, 3).join(' ')}
                    </button>
                  ))}
                  {focused.length > 8 && (
                    <button
                      onClick={() => setFocusFilter('focus')}
                      className="px-2 py-0.5 rounded-full text-xs text-yellow-700 hover:text-yellow-900 underline"
                    >
                      +{focused.length - 8} more
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ⚠️ Alert for pending human replies — top priority */}
      {repliedLeads.total > 0 && (
        <div className={`mb-3 p-3 lg:p-4 rounded-xl border-2 ${
          repliedLeads.stale.length > 0
            ? 'bg-red-50 border-red-400'
            : 'bg-green-50 border-green-400'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
              <div className={`text-2xl sm:text-3xl flex-shrink-0 ${repliedLeads.stale.length > 0 ? 'animate-bounce' : ''}`}>
                💬
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-bold text-sm sm:text-base ${repliedLeads.stale.length > 0 ? 'text-red-800' : 'text-green-800'}`}>
                  {repliedLeads.stale.length > 0 ? (
                    <>{repliedLeads.stale.length} {repliedLeads.stale.length === 1 ? 'customer replied' : 'customers replied'} +{STALE_REPLY_DAYS} days ago — advance or discard</>
                  ) : (
                    <>{repliedLeads.recent.length} {repliedLeads.recent.length === 1 ? 'customer replied' : 'customers replied'} — advance or discard</>
                  )}
                </h3>
                <p className={`text-xs mt-0.5 hidden sm:block ${repliedLeads.stale.length > 0 ? 'text-red-600' : 'text-green-700'}`}>
                  These leads are hot. Open them, quote or discard them before they cool off.
                </p>
                {/* Clickable chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[...repliedLeads.stale, ...repliedLeads.recent].slice(0, 8).map(({ lead, days }) => (
                    <button
                      key={lead.id}
                      onClick={() => handleCardClick(lead, lead.sales_stage as KanbanColumnId)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        days >= STALE_REPLY_DAYS
                          ? 'bg-red-200 text-red-900 hover:bg-red-300 border border-red-300'
                          : 'bg-white text-green-800 hover:bg-green-100 border border-green-200'
                      }`}
                      title={`${days}d without reply`}
                    >
                      {lead.name.split(' ').slice(0, 3).join(' ')} <span className="opacity-60">· {days}d</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* View all button */}
            <button
              onClick={() => setPhoneFilter(phoneFilter === 'replied_human' ? 'all' : 'replied_human')}
              className={`flex-shrink-0 self-center px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm ${
                repliedLeads.stale.length > 0
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              View all →
            </button>
          </div>
        </div>
      )}

      {/* Motivational quote - Hidden on mobile */}
      <div className="hidden lg:block mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-800 italic">"{motivationalQuote.quote}"</p>
        <p className="text-xs text-blue-600 mt-1">— {motivationalQuote.author}</p>
      </div>

      {/* Quick stats with follow-up metrics */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3 lg:mb-4 text-xs sm:text-sm">
        {/* AI Campaign button — TEMPORARILY HIDDEN */}

        <button
          onClick={() => setShowAddManual(true)}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 transition-colors"
          title={t('manual.subtitle')}
        >
          {t('kanban.add_lead')}
        </button>

        <button
          onClick={() => setShowInsights(true)}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border border-indigo-200 transition-colors"
          title={t('kanban.insights_title')}
        >
          📊 {t('kanban.insights_label')}
        </button>

        {(() => {
          const manualCount = COLUMN_ORDER.reduce(
            (sum, col) => sum + columns[col].filter(l => l.source === 'manual').length,
            0
          );
          if (manualCount === 0) return null;
          return (
            <button
              onClick={() => setSourceFilter(sourceFilter === 'manual' ? 'all' : 'manual')}
              title={t('kanban.filter_manual_title')}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                sourceFilter === 'manual'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              ✋ {manualCount}
            </button>
          );
        })()}

        {(() => {
          // Chip counts only active ones so it doesn't contradict the banner
          const activeFocusCols: KanbanColumnId[] = [
            'nuevo', 'contactado', 'seguimiento_1', 'seguimiento_2',
            'seguimiento_3', 'interesado', 'cotizado',
          ];
          const focusCount = activeFocusCols.reduce(
            (sum, col) => sum + columns[col].filter(l => l.is_focus).length,
            0
          );
          if (focusCount === 0) return null;
          return (
            <button
              onClick={() => setFocusFilter(focusFilter === 'focus' ? 'all' : 'focus')}
              title={t('kanban.filter_focus_title')}
              className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                focusFilter === 'focus'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-yellow-50 text-yellow-800 hover:bg-yellow-100 border border-yellow-300'
              }`}
            >
              ⭐ {focusCount}
            </button>
          );
        })()}

        {/* Rep filter: see how each one is doing.
            Hidden when the Pipeline controls the filter (shared bar). */}
        {!onOwnerFilterChange && (() => {
          const flat = Object.values(columns).flat();
          const mCount = flat.filter(l => l.owner_name === 'Martin' || l.owner_name === 'Martín').length;
          const aCount = flat.filter(l => l.owner_name === 'Alejandro').length;
          const bCount = flat.filter(l => !l.contacted_by && l.contacted_at).length;
          const chip = (key: 'martin' | 'alejandro' | 'bot', label: string, count: number, on: string, off: string) => (
            count === 0 ? null : (
              <button
                key={key}
                onClick={() => setOwnerFilter(ownerFilter === key ? 'all' : key)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${ownerFilter === key ? on : off}`}
              >
                {label} {count}
              </button>
            )
          );
          return (
            <>
              {chip('martin', '👑 Martín', mCount, 'bg-[#0890F1] text-white', 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200')}
              {chip('alejandro', '🧑 Alejandro', aCount, 'bg-teal-600 text-white', 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200')}
              {chip('bot', '🤖 Bot', bCount, 'bg-purple-600 text-white', 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200')}
            </>
          );
        })()}

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
                title="Filter Orcas"
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
                title="Filter Dolphins"
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
                  ~S/{(pipelineValue / 1000).toFixed(0)}k/mo
                </span>
              )}
            </>
          );
        })()}

        {/* WhatsApp stats */}
        {(whatsappStats.sentToday > 0 || whatsappStats.repliesUnread > 0) && (
          <>
            <span className="hidden sm:block border-l border-gray-300 h-4 mx-1"></span>
            {whatsappStats.repliesHuman > 0 && (
              <button
                onClick={() => setPhoneFilter(phoneFilter === 'replied_human' ? 'all' : 'replied_human')}
                title={`Filter ${whatsappStats.repliesHuman} leads with a human reply`}
                className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  phoneFilter === 'replied_human'
                    ? 'bg-green-600 text-white'
                    : repliedLeads.stale.length > 0
                      ? 'bg-red-100 text-red-700 animate-pulse hover:bg-red-200 ring-2 ring-red-400'
                      : 'bg-green-100 text-green-700 animate-pulse hover:bg-green-200'
                }`}
              >
                💬 {whatsappStats.repliesHuman}
                {repliedLeads.stale.length > 0 && (
                  <span className="ml-1 font-bold">⚠️{repliedLeads.stale.length}</span>
                )}
              </button>
            )}
            {whatsappStats.repliesBot > 0 && (
              <button
                onClick={() => setPhoneFilter(phoneFilter === 'replied_bot' ? 'all' : 'replied_bot')}
                title={`Filter ${whatsappStats.repliesBot} leads whose reply was only an automatic bot`}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  phoneFilter === 'replied_bot'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🤖 {whatsappStats.repliesBot} bot{whatsappStats.repliesBot === 1 ? '' : 's'}
              </button>
            )}
            {whatsappStats.sentToday > 0 && (
              <button
                onClick={() => setPhoneFilter(phoneFilter === 'sent_today' ? 'all' : 'sent_today')}
                title={`${whatsappStats.sentManualToday} sent by Alejandro · ${whatsappStats.sentAutoToday} sent by the system`}
                className={`text-xs transition-colors cursor-pointer ${
                  phoneFilter === 'sent_today'
                    ? 'text-green-700 font-bold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📱 {whatsappStats.sentToday} sent today{' '}
                <span className="opacity-70">
                  ({whatsappStats.sentManualToday > 0 && <span className="text-orange-600">✋{whatsappStats.sentManualToday}</span>}
                  {whatsappStats.sentManualToday > 0 && whatsappStats.sentAutoToday > 0 && <span> · </span>}
                  {whatsappStats.sentAutoToday > 0 && <span className="text-purple-500">🤖{whatsappStats.sentAutoToday}</span>})
                </span>
              </button>
            )}
          </>
        )}

        {/* AI call metrics — TEMPORARILY HIDDEN */}
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-2 mb-2 lg:mb-3 flex-wrap">
        {/* Search */}
        <div className="relative flex items-center">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lead… (/)"
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
              title="Clear search (Esc)"
            >✕</button>
          )}
        </div>
        {searchQuery && (() => {
          const total = COLUMN_ORDER.reduce((s, col) => s + filteredColumns[col].length, 0);
          return (
            <span className="text-xs text-blue-600 font-medium">
              {total} result{total !== 1 ? 's' : ''}
            </span>
          );
        })()}

        {/* WhatsApp status filter */}
        <select
          value={phoneFilter}
          onChange={(e) => setPhoneFilter(e.target.value as 'all' | 'whatsapp' | 'no_phone')}
          className={`text-xs sm:text-sm px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
            phoneFilter !== 'all'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
          }`}
        >
          <option value="all">📱 All</option>
          <option value="whatsapp">📱 With WhatsApp</option>
          <option value="sent_today">📤 Sent today</option>
          <option value="replied_today">💬 Replied today</option>
          <option value="replied_human">💬 Replied (all)</option>
          <option value="replied_bot">🤖 Bot replied</option>
          <option value="no_phone">🚫 No WhatsApp</option>
        </select>
        {phoneFilter !== 'all' && (
          <button
            onClick={() => setPhoneFilter('all')}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear filter"
          >
            ✕
          </button>
        )}

        {/* Filter by lead creation month */}
        {availableMonths.length > 0 && (
          <>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className={`text-xs sm:text-sm px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                monthFilter !== 'all'
                  ? 'bg-[#0890F1] text-white border-[#0890F1]'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
              }`}
            >
              <option value="all">📅 All months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            {monthFilter !== 'all' && (
              <button
                onClick={() => setMonthFilter('all')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                title="Clear filter"
              >
                ✕
              </button>
            )}
          </>
        )}
      </div>

      {/* Industry filter — compact select */}
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
              title="Clear filter"
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
              onFocusToggled={fetchKanbanData}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Detail modal */}
      {selectedBusiness && (
        <LeadDetailModal
          business={selectedBusiness}
          currentColumn={selectedBusinessColumn}
          onClose={() => setSelectedBusiness(null)}
          onStageChange={handleStageChange}
          onActionRegistered={handleActionRegistered}
        />
      )}

      {/* AI Insights modal */}
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

              {/* Time filter */}
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

              {/* Results summary */}
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

              {/* Additional insights */}
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
                  {/* Stage changes by AI - inline */}
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
            {/* ACTION ALERT - Leads pending a quote */}
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
                          +{aiInsightsStats.pendingQuotes.length - 5} more
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
                  {/* Calls */}
                  <div className="flex-1 text-center">
                    <div className="w-full bg-blue-500 text-white rounded-lg py-3 px-2">
                      <div className="text-xl font-bold">{aiCallLeadsList.length}</div>
                      <div className="text-xs opacity-90">{t('ai.funnel_calls')}</div>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                  {/* Connected */}
                  <div className="flex-1 text-center">
                    <div className="w-full bg-purple-500 text-white rounded-lg py-3 px-2" style={{ width: `${Math.max(60, aiInsightsStats.connectionRate)}%`, margin: '0 auto' }}>
                      <div className="text-xl font-bold">{aiInsightsStats.connected}</div>
                      <div className="text-xs opacity-90">{t('ai.funnel_connected')}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{aiInsightsStats.connectionRate}%</div>
                  </div>
                  <span className="text-gray-400">→</span>
                  {/* Interested */}
                  <div className="flex-1 text-center">
                    <div className="w-full bg-green-500 text-white rounded-lg py-3 px-2" style={{ width: `${Math.max(50, aiInsightsStats.interestRate)}%`, margin: '0 auto' }}>
                      <div className="text-xl font-bold">{aiInsightsStats.outcomes.interested}</div>
                      <div className="text-xs opacity-90">{t('ai.funnel_interested')}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{aiInsightsStats.interestRate}%</div>
                  </div>
                  <span className="text-gray-400">→</span>
                  {/* Quoted (by AI) */}
                  <div className="flex-1 text-center">
                    <div className="w-full bg-[#FFF8E7]0 text-white rounded-lg py-3 px-2">
                      <div className="text-xl font-bold">{aiInsightsStats.aiCotizados}</div>
                      <div className="text-xs opacity-90">{t('ai.funnel_quoted')}</div>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                  {/* Customers (by AI) */}
                  <div className="flex-1 text-center">
                    <div className="w-full bg-emerald-600 text-white rounded-lg py-3 px-2">
                      <div className="text-xl font-bold">{aiInsightsStats.aiClientes}</div>
                      <div className="text-xs opacity-90">{t('ai.funnel_customers')}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE MOVES BY AI */}
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

            {/* BEST TIME SLOT */}
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

            {/* Call list */}
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
                          {/* Name and stage */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 truncate">{lead.name}</h3>
                            <span className={`px-2 py-0.5 rounded text-xs ${leadColumnConfig?.bgColor || 'bg-gray-100'} ${leadColumnConfig?.color || 'text-gray-600'}`}>
                              {leadColumnConfig?.icon} {leadColumnConfig?.title || lead.currentColumn}
                            </span>
                          </div>

                          {/* Business type and district */}
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            {lead.business_type && <span>{lead.business_type}</span>}
                            {lead.city && <span>📍 {lead.city}</span>}
                          </div>

                          {/* Call result */}
                          <div className="mt-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium ${outcomeInfo.bg} ${outcomeInfo.color}`}>
                              {outcomeInfo.label}
                              {lead.aiCallResult?.contactName && (
                                <span className="ml-2 font-normal opacity-75">
                                  • Contact: {lead.aiCallResult.contactName}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Play button */}
                        {conversationId && (
                          <button
                            onClick={() => handlePlayAudio(conversationId)}
                            disabled={isLoading}
                            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${
                              isPlaying
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                            } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                            title={isPlaying ? 'Pause' : 'Listen to call'}
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

                      {/* View detail button */}
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
                  {t('ai.connected')} <strong className="text-blue-600">{aiInsightsStats?.connected || 0}</strong> of {aiCallLeadsList.length}
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

      {/* Add manual lead modal */}
      <AddManualLeadModal
        isOpen={showAddManual}
        onClose={() => setShowAddManual(false)}
        onCreated={fetchKanbanData}
      />

      {/* Insights modal */}
      <InsightsModal
        isOpen={showInsights}
        onClose={() => setShowInsights(false)}
        refreshKey={insightsRefreshKey}
        onOpenLead={(id) => {
          // Look up the full KanbanBusiness in any column and open the detail modal
          // stacked on top of Insights (Insights stays open underneath).
          for (const col of COLUMN_ORDER) {
            const found = columns[col].find(b => b.id === id);
            if (found) {
              setSelectedBusiness(found);
              setSelectedBusinessColumn(col);
              return;
            }
          }
        }}
      />

      {/* AI Campaign modal */}
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
