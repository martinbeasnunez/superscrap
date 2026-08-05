'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useI18n } from '@/lib/i18n';

// Cargar KanbanBoard dinámicamente para evitar problemas de SSR con drag-drop
const KanbanBoard = dynamic(() => import('@/components/kanban/KanbanBoard'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin h-10 w-10 border-3 border-[#0890F1] border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-gray-500">Cargando pipeline...</p>
      </div>
    </div>
  ),
});

// War-room de orcas — pestaña dentro del pipeline (client-only, hace su propio fetch)
const OrcaWarRoom = dynamic(() => import('@/components/OrcaWarRoom'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-10 w-10 border-3 border-[#0890F1] border-t-transparent rounded-full" />
    </div>
  ),
});

type PipelineView = 'kanban' | 'orcas';

interface QuickStats {
  newLeads: number;
  followUpNeeded: number;
  interested: number;
  quoted: number;
}

export default function PipelinePage() {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [view, setView] = useState<PipelineView>('kanban');
  const { t } = useI18n();

  useEffect(() => {
    // Fetch quick stats
    async function fetchStats() {
      try {
        const res = await fetch('/api/kanban');
        const data = await res.json();

        if (data.columns) {
          setStats({
            newLeads: data.columns.find((c: { id: string }) => c.id === 'new')?.leads?.length || 0,
            followUpNeeded:
              (data.columns.find((c: { id: string }) => c.id === 'follow_up_1')?.leads?.length || 0) +
              (data.columns.find((c: { id: string }) => c.id === 'follow_up_2')?.leads?.length || 0),
            interested: data.columns.find((c: { id: string }) => c.id === 'interested')?.leads?.length || 0,
            quoted: data.columns.find((c: { id: string }) => c.id === 'quoted')?.leads?.length || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
      {/* Header - Hidden on mobile, shown in top bar */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('pipe.title')}</h1>
          <p className="text-gray-500 mt-0.5">{t('pipe.subtitle')}</p>
        </div>

        {/* Quick Stats - Desktop */}
        {view === 'kanban' && stats && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-6 bg-white rounded-xl px-6 py-3 shadow-sm border border-gray-100">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{stats.newLeads}</p>
                <p className="text-xs text-gray-500">{t('pipe.new')}</p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{stats.followUpNeeded}</p>
                <p className="text-xs text-gray-500">{t('pipe.followup')}</p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#D4A84F]">{stats.interested}</p>
                <p className="text-xs text-gray-500">{t('pipe.interested')}</p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-500">{stats.quoted}</p>
                <p className="text-xs text-gray-500">{t('pipe.quoted')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs: Kanban | Orcas */}
      <div className="flex items-center gap-1 mb-4 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
        <button
          onClick={() => setView('kanban')}
          className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
            view === 'kanban' ? 'bg-[#0890F1] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {t('pipe.tab_kanban')}
        </button>
        <button
          onClick={() => setView('orcas')}
          className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
            view === 'orcas' ? 'bg-[#0890F1] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          🐋 {t('pipe.tab_orcas')}
        </button>
      </div>

      {/* Tips collapsible - Desktop only (solo en vista Kanban) */}
      <div className={`${view === 'kanban' ? 'hidden lg:block' : 'hidden'} mb-4`}>
        <button
          onClick={() => setShowTips(!showTips)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showTips ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          {showTips ? t('pipe.hide_guide') : t('pipe.show_guide')}
        </button>

        {showTips && (
          <div className="mt-3 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="grid md:grid-cols-4 gap-4 text-sm mb-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <span className="text-xl">📋</span>
                <div>
                  <p className="font-medium text-gray-900">{t('pipe.new')}</p>
                  <p className="text-gray-500 text-xs">{t('pipe.guide_new')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                <span className="text-xl">💬</span>
                <div>
                  <p className="font-medium text-blue-700">{t('pipe.guide_1st')}</p>
                  <p className="text-gray-500 text-xs">{t('pipe.guide_1st_desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                <span className="text-xl">⏰</span>
                <div>
                  <p className="font-medium text-blue-700">{t('pipe.guide_followup')}</p>
                  <p className="text-gray-500 text-xs">{t('pipe.guide_followup_desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-[#FFF8E7] rounded-xl">
                <span className="text-xl">⭐</span>
                <div>
                  <p className="font-medium text-[#9A7A35]">{t('pipe.guide_interested')}</p>
                  <p className="text-gray-500 text-xs">{t('pipe.guide_interested_desc')}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
              <div className="text-3xl">🎯</div>
              <div>
                <p className="font-semibold text-emerald-800">{t('pipe.success_key')}</p>
                <p className="text-sm text-emerald-700 mt-1">{t('pipe.success_desc')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contenido según pestaña */}
      {view === 'kanban' ? (
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 p-2 sm:p-3 lg:p-4 overflow-hidden">
          <KanbanBoard />
        </div>
      ) : (
        <OrcaWarRoom />
      )}
    </div>
  );
}
