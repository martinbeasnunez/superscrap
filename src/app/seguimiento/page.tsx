'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useI18n } from '@/lib/i18n';
import type { KanbanBusiness, KanbanColumnId } from '@/app/api/kanban/route';

// Filtro por vendedor/dueño compartido entre las dos vistas (Lista y Tablero).
export type OwnerFilter = 'all' | 'martin' | 'alejandro' | 'bot';

// Tablero (kanban) — carga dinámica para evitar problemas de SSR con drag-drop
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

// Lista (brújula de orcas priorizada) — client-only, hace su propio fetch
const OrcaWarRoom = dynamic(() => import('@/components/OrcaWarRoom'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-10 w-10 border-3 border-[#0890F1] border-t-transparent rounded-full" />
    </div>
  ),
});

type PipelineView = 'lista' | 'tablero';
interface CurrentUser { id: string; name: string; email: string }
interface QuickStats { newLeads: number; followUpNeeded: number; interested: number; quoted: number }
interface MyStats { total: number; orcas: number; prospects: number }
/**
 * Actividad real separada por origen. Antes "Tu día" contaba `contacted_at`, que
 * el cron de auto-followup también escribe: al vendedor le aparecían como propios
 * los envíos automáticos del bot. Ahora se cuenta el historial y se separa.
 */
interface MiActividad {
  trabajoNuestroHoy: number;
  trabajoNuestroRango: number;
  negociosTrabajados: number;
  porOrigen: { humano: number; agente: number; cron: number; cliente: number };
  porOrigenHoy: { humano: number; agente: number; cron: number; cliente: number };
}

// ¿Este lead es de Martín? (tolera "Martin"/"Martín")
function isMartin(name: string | null | undefined): boolean {
  const n = (name || '').toLowerCase();
  return n === 'martin' || n === 'martín';
}

// ¿El lead pertenece al usuario logueado? (por nombre de dueño)
function ownsLead(ownerName: string | null | undefined, userName: string): boolean {
  if (userName.toLowerCase().startsWith('mart')) return isMartin(ownerName);
  return (ownerName || '').toLowerCase() === userName.toLowerCase();
}

export default function PipelinePage() {
  const [columns, setColumns] = useState<Record<KanbanColumnId, KanbanBusiness[]> | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [view, setView] = useState<PipelineView>('tablero');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const { t } = useI18n();

  // Recordar la última vista elegida (respetar el contexto del usuario).
  // Se lee en effect (no en el initializer) para no romper la hidratación SSR.
  useEffect(() => {
    const v = localStorage.getItem('orbit_pipeline_view');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v === 'lista' || v === 'tablero') setView(v);
    const saved = localStorage.getItem('orbit_user');
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* ignore */ } }
  }, []);

  const changeView = useCallback((v: PipelineView) => {
    setView(v);
    localStorage.setItem('orbit_pipeline_view', v);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/kanban');
        const data = await res.json();
        if (data.columns) setColumns(data.columns);
      } catch (error) {
        console.error('Error fetching pipeline data:', error);
      }
    }
    fetchData();
  }, []);

  const flat = useMemo(() => (columns ? Object.values(columns).flat() : []), [columns]);

  const stats: QuickStats | null = useMemo(() => {
    if (!columns) return null;
    return {
      newLeads: columns.nuevo.length,
      followUpNeeded: columns.seguimiento_1.length + columns.seguimiento_2.length,
      interested: columns.interesado.length,
      quoted: columns.cotizado.length,
    };
  }, [columns]);

  // 👑 Tu día — computado desde los leads del usuario logueado
  const myStats: MyStats | null = useMemo(() => {
    if (!user || flat.length === 0) return null;
    const mine = flat.filter((l) => ownsLead(l.owner_name, user.name));
    if (mine.length === 0) return null;
    return {
      total: mine.length,
      orcas: mine.filter((l) => l.potential_tier === 'orca').length,
      prospects: mine.filter((l) => l.sales_stage === 'interesado' || l.sales_stage === 'cotizado').length,
    };
  }, [flat, user]);

  // Actividad real de la semana, separada por origen (a mano / dirigido / automático).
  const [actividad, setActividad] = useState<MiActividad | null>(null);
  useEffect(() => {
    if (!user) return;
    fetch(`/api/mi-actividad?userId=${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setActividad(d))
      .catch(() => {});
  }, [user]);

  // Clave de dueño del usuario actual (para el botón "Ver los míos")
  const myOwnerKey: OwnerFilter | null = user
    ? (isMartin(user.name) ? 'martin' : user.name === 'Alejandro' ? 'alejandro' : null)
    : null;

  // Conteos por vendedor para los chips compartidos
  const ownerCounts = useMemo(() => ({
    martin: flat.filter((l) => isMartin(l.owner_name)).length,
    alejandro: flat.filter((l) => l.owner_name === 'Alejandro').length,
    bot: flat.filter((l) => !l.contacted_by && l.contacted_at).length,
  }), [flat]);

  const toggleOwner = (key: OwnerFilter) => setOwnerFilter((cur) => (cur === key ? 'all' : key));

  const ownerChip = (key: 'martin' | 'alejandro' | 'bot', label: string, count: number, on: string, off: string) => (
    count === 0 ? null : (
      <button
        onClick={() => toggleOwner(key)}
        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${ownerFilter === key ? on : off}`}
      >
        {label} {count}
      </button>
    )
  );

  return (
    <div className="p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="hidden lg:flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('pipe.title')}</h1>
          <p className="text-gray-500 mt-0.5">Una sola sección · tus leads en dos lentes</p>
        </div>
        {view === 'tablero' && stats && (
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
        )}
      </div>

      {/* 👑 Tu día — franja persistente, arriba de ambas vistas */}
      {myStats && (
        <button
          onClick={() => myOwnerKey && toggleOwner(myOwnerKey)}
          disabled={!myOwnerKey}
          className={`w-full text-left rounded-xl px-4 py-3 mb-3 border transition-colors ${
            myOwnerKey && ownerFilter === myOwnerKey
              ? 'bg-[#0890F1] border-[#0890F1] text-white'
              : 'bg-[#0890F1]/5 border-[#0890F1]/20 hover:bg-[#0890F1]/10'
          } ${!myOwnerKey ? 'cursor-default' : ''}`}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-4 flex-wrap">
              <span className={`font-bold ${myOwnerKey && ownerFilter === myOwnerKey ? 'text-white' : 'text-[#0890F1]'}`}>👑 Tu día</span>
              <span className={`text-sm ${myOwnerKey && ownerFilter === myOwnerKey ? 'text-white/90' : 'text-gray-600'}`}>
                {actividad ? (
                  <>
                    Hoy trabajaste <b>{actividad.trabajoNuestroHoy}</b> · esta semana <b>{actividad.trabajoNuestroRango}</b> en <b>{actividad.negociosTrabajados}</b> cuentas
                    {actividad.porOrigen.cron > 0 && (
                      <span className={myOwnerKey && ownerFilter === myOwnerKey ? 'text-white/60' : 'text-gray-400'}>
                        {' '}· el bot mandó <b>{actividad.porOrigen.cron}</b> aparte
                      </span>
                    )}
                  </>
                ) : (
                  <>Cargando tu actividad…</>
                )}
                {' '}· <b>{myStats.prospects}</b> prospectos · <b>{myStats.orcas}</b> orcas · <b>{myStats.total}</b> leads tuyos
              </span>
            </div>
            {myOwnerKey && (
              <span className={`text-xs font-semibold ${ownerFilter === myOwnerKey ? 'text-white' : 'text-[#0890F1]'}`}>
                {ownerFilter === myOwnerKey ? '✓ viendo los tuyos' : 'Ver los míos →'}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Barra compartida: toggle de vista + filtros por vendedor (aplican a Lista y Tablero) */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => changeView('lista')}
            className={`text-sm font-medium px-3.5 py-1.5 rounded-lg transition-colors ${
              view === 'lista' ? 'bg-[#0890F1] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            ☰ Lista
          </button>
          <button
            onClick={() => changeView('tablero')}
            className={`text-sm font-medium px-3.5 py-1.5 rounded-lg transition-colors ${
              view === 'tablero' ? 'bg-[#0890F1] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            ▦ Tablero
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200 mx-0.5" />

        {ownerChip('martin', '👑 Martín', ownerCounts.martin, 'bg-[#0890F1] text-white', 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200')}
        {ownerChip('alejandro', '🧑 Alejandro', ownerCounts.alejandro, 'bg-teal-600 text-white', 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200')}
        {ownerChip('bot', '🤖 Bot', ownerCounts.bot, 'bg-purple-600 text-white', 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200')}
        {ownerFilter !== 'all' && (
          <button onClick={() => setOwnerFilter('all')} className="text-xs text-gray-400 hover:text-gray-600" title="Quitar filtro de vendedor">✕ limpiar</button>
        )}
      </div>

      {/* Guía de etapas — solo Tablero, colapsable */}
      <div className={`${view === 'tablero' ? 'hidden lg:block' : 'hidden'} mb-4`}>
        <button
          onClick={() => setShowTips(!showTips)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${showTips ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
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

      {/* Contenido según vista */}
      {view === 'tablero' ? (
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 p-2 sm:p-3 lg:p-4 overflow-hidden">
          <KanbanBoard ownerFilter={ownerFilter} onOwnerFilterChange={setOwnerFilter} />
        </div>
      ) : (
        <OrcaWarRoom ownerFilter={ownerFilter} />
      )}
    </div>
  );
}
