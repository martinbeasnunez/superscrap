'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

interface UserStats {
  name: string;
  whatsapp: number;
  email: number;
  call: number;
  prospects: number;
  discarded: number;
  followUps: number;
}

interface WeekStats {
  contacts: number;
  whatsapp: number;
  email: number;
  call: number;
  prospects: number;
}

interface Stats {
  total: {
    searches: number;
    businesses: number;
    whatsapp: number;
    email: number;
    call: number;
    prospects: number;
    discarded: number;
    needsFollowUp: number;
  };
  today: {
    searches: number;
    whatsapp: number;
    email: number;
    call: number;
    prospects: number;
    discarded: number;
    byUser: UserStats[];
  };
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  insights?: {
    bestType: { name: string; rate: number; prospects: number } | null;
    topDistricts: { name: string; prospects: number }[];
  };
}

// Componente para mostrar comparación semanal
function WeekComparison({ current, previous, label, icon }: {
  current: number;
  previous: number;
  label: string;
  icon: React.ReactNode;
}) {
  const { t } = useI18n();
  const diff = current - previous;
  const percentChange = previous > 0 ? ((diff / previous) * 100) : (current > 0 ? 100 : 0);
  const isUp = diff >= 0;

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="w-8 h-8 sm:w-11 sm:h-11 bg-gray-50 rounded-lg sm:rounded-xl flex items-center justify-center">
          {icon}
        </div>
        {previous > 0 && (
          <div className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
            isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>
            {isUp ? (
              <svg className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {Math.abs(percentChange).toFixed(0)}%
          </div>
        )}
      </div>
      <p className="text-xl sm:text-3xl font-bold text-gray-900">{current}</p>
      <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">{label}</p>
      <p className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-2 hidden sm:block">
        {t('dash.last_week')} {previous}
      </p>
    </div>
  );
}

export default function HomePage() {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Tips de ventas rotativos
  const salesTips = [
    { emoji: '🎯', title: t('dash.tip_followup_title'), tip: t('dash.tip_followup_desc'), action: t('dash.tip_followup_cta'), link: '/seguimiento' },
    { emoji: '⏰', title: t('dash.tip_timing_title'), tip: t('dash.tip_timing_desc'), action: t('dash.tip_timing_cta'), link: '/seguimiento' },
    { emoji: '💬', title: t('dash.tip_whatsapp_title'), tip: t('dash.tip_whatsapp_desc'), action: t('dash.tip_whatsapp_cta'), link: '/buscar' },
    { emoji: '📊', title: t('dash.tip_pipeline_title'), tip: t('dash.tip_pipeline_desc'), action: t('dash.tip_pipeline_cta'), link: '/seguimiento' },
    { emoji: '🏆', title: t('dash.tip_personalize_title'), tip: t('dash.tip_personalize_desc'), action: t('dash.tip_personalize_cta'), link: '/historial' },
  ];

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Rotar tips cada 10 segundos
    const tipInterval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % salesTips.length);
    }, 10000);

    return () => clearInterval(tipInterval);
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 sm:h-10 sm:w-10 border-3 border-[#0890F1] border-t-transparent rounded-full mx-auto mb-3 sm:mb-4"></div>
          <p className="text-gray-500 text-sm sm:text-base">{t('dash.loading')}</p>
        </div>
      </div>
    );
  }

  const currentTip = salesTips[currentTipIndex];
  const todayContacts = stats ? stats.today.whatsapp + stats.today.email + stats.today.call : 0;

  // Calcular días de la semana
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysInWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // Domingo = 7

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto pb-20 lg:pb-8">
      {/* Header con saludo */}
      <div className="flex items-center justify-between mb-4 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {t('dash.greeting')}
          </h1>
          <p className="text-gray-500 text-sm sm:text-base mt-0.5 sm:mt-1">
            {new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link
          href="/buscar"
          className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-[#0890F1] text-white rounded-xl hover:bg-[#0770C5] transition-all font-semibold shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {t('nav.search')} leads
        </Link>
      </div>

      {stats && (
        <>
          {/* Actividad de Hoy - Card prominente */}
          <div className="bg-gradient-to-br from-[#1C2026] to-[#202B93] rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6 text-white">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-white/90">{t('dash.activity_today')}</h2>
                <p className="text-white/60 text-xs sm:text-sm">{t('dash.keep_going')}</p>
              </div>
              <Link
                href="/seguimiento"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-sm font-medium"
              >
                {t('dash.view_pipeline')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              <div className="bg-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold">{stats.today.whatsapp}</p>
                    <p className="text-white/60 text-[10px] sm:text-xs">{t('dash.whatsapp')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold">{stats.today.call}</p>
                    <p className="text-white/60 text-[10px] sm:text-xs">{t('dash.calls')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold">{stats.today.email}</p>
                    <p className="text-white/60 text-[10px] sm:text-xs">{t('dash.emails')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#FFD06D]/30 to-[#0890F1]/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur border border-[#FFD06D]/20">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#FFD06D]/30 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFD06D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-[#FFD06D]">{stats.today.prospects}</p>
                    <p className="text-[#FFD06D]/70 text-[10px] sm:text-xs">{t('dash.prospects')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumen total del día */}
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10 flex items-center justify-between">
              <p className="text-white/70 text-xs sm:text-sm">
                {t('dash.total_today')} <span className="font-bold text-white">{todayContacts}</span>
              </p>
              {todayContacts >= 10 ? (
                <span className="text-emerald-400 text-xs sm:text-sm flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="hidden sm:inline">{t('dash.great_pace')}</span>
                  <span className="sm:hidden">{t('dash.good')}</span>
                </span>
              ) : (
                <span className="text-[#E6B85E] text-xs sm:text-sm">
                  {t('dash.goal')}
                </span>
              )}
            </div>
          </div>

          {/* Progreso Semanal - Comparación */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
                <span className="hidden sm:inline">{t('dash.week_comparison')}</span>
                <span className="sm:hidden">{t('dash.this_week')}</span>
              </h2>
              <span className="text-xs sm:text-sm text-gray-500">
                {t('dash.day_of')} {daysInWeek}/7
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              <WeekComparison
                current={stats.thisWeek.contacts}
                previous={stats.lastWeek.contacts}
                label={t('dash.contacts')}
                icon={
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
              <WeekComparison
                current={stats.thisWeek.whatsapp}
                previous={stats.lastWeek.whatsapp}
                label={t('dash.whatsapp')}
                icon={
                  <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                }
              />
              <WeekComparison
                current={stats.thisWeek.call}
                previous={stats.lastWeek.call}
                label={t('dash.calls')}
                icon={
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                }
              />
              <WeekComparison
                current={stats.thisWeek.prospects}
                previous={stats.lastWeek.prospects}
                label={t('dash.prospects')}
                icon={
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Grid principal */}
          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
            {/* Acciones pendientes - CTA principal */}
            <div className="lg:col-span-2 space-y-3 sm:space-y-4">
              {/* Follow-ups pendientes */}
              {stats.total.needsFollowUp > 0 && (
                <Link
                  href="/seguimiento"
                  className="block bg-gradient-to-r from-[#0890F1] to-sky-400 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-white hover:shadow-lg hover:shadow-blue-200 transition-all group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur flex-shrink-0">
                        <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl sm:text-3xl font-bold">{stats.total.needsFollowUp}</p>
                        <p className="text-white/90 font-medium text-sm sm:text-base">leads esperan follow-up</p>
                        <p className="text-white/70 text-xs sm:text-sm hidden sm:block">+3 días sin contacto</p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 bg-white/20 px-4 py-2 rounded-xl group-hover:bg-white/30 transition-colors flex-shrink-0">
                      <span className="font-semibold">Revisar</span>
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 sm:hidden flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              )}

              {/* Stats del pipeline */}
              <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3 sm:mb-5">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{t('dash.your_pipeline')}</h3>
                  <Link href="/seguimiento" className="text-xs sm:text-sm text-[#0890F1] hover:underline font-medium">
                    {t('dash.view_all')}
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div className="text-center p-2 sm:p-4 bg-blue-50 rounded-lg sm:rounded-xl">
                    <p className="text-xl sm:text-3xl font-bold text-blue-700">{stats.total.whatsapp + stats.total.email + stats.total.call}</p>
                    <p className="text-[10px] sm:text-sm text-blue-600 mt-0.5 sm:mt-1">{t('dash.contacted')}</p>
                  </div>
                  <div className="text-center p-2 sm:p-4 bg-purple-50 rounded-lg sm:rounded-xl">
                    <p className="text-xl sm:text-3xl font-bold text-purple-700">{stats.total.prospects}</p>
                    <p className="text-[10px] sm:text-sm text-purple-600 mt-0.5 sm:mt-1">{t('dash.prospects')}</p>
                  </div>
                  <div className="text-center p-2 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                    <p className="text-xl sm:text-3xl font-bold text-gray-700">{stats.total.discarded}</p>
                    <p className="text-[10px] sm:text-sm text-gray-600 mt-0.5 sm:mt-1">{t('dash.discarded')}</p>
                  </div>
                </div>

                {/* Tasa de conversión simplificada */}
                <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <span className="text-xs sm:text-sm text-gray-600">{t('dash.conversion')}</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900">
                      {((stats.total.prospects / Math.max(stats.total.whatsapp + stats.total.email + stats.total.call, 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 sm:h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#0890F1] to-sky-400 rounded-full transition-all"
                      style={{
                        width: `${Math.min((stats.total.prospects / Math.max(stats.total.whatsapp + stats.total.email + stats.total.call, 1)) * 100, 100)}%`
                      }}
                    />
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 sm:mt-2 hidden sm:block">
                    {t('dash.conversion_info').split(',')[0]}, {((stats.total.prospects / Math.max(stats.total.whatsapp + stats.total.email + stats.total.call, 1)) * 100).toFixed(0)} {t('dash.conversion_info').split(',')[1]?.trim() || 'se convierten en prospectos'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tips y coaching */}
            <div className="space-y-3 sm:space-y-4">
              {/* Tip del día */}
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-white">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <span className="text-xl sm:text-2xl">{currentTip.emoji}</span>
                  <h3 className="font-semibold text-sm sm:text-base">{t('dash.sales_tip')}</h3>
                </div>
                <h4 className="font-bold text-base sm:text-lg mb-1.5 sm:mb-2">{currentTip.title}</h4>
                <p className="text-white/85 text-xs sm:text-sm mb-3 sm:mb-4 leading-relaxed line-clamp-3 sm:line-clamp-none">
                  {currentTip.tip}
                </p>
                <Link
                  href={currentTip.link}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-colors"
                >
                  {currentTip.action}
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                {/* Indicadores de tips */}
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 mt-3 sm:mt-4">
                  {salesTips.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentTipIndex(i)}
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all ${
                        i === currentTipIndex ? 'bg-white w-3 sm:w-4' : 'bg-white/40 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Insights rápidos - Solo en desktop o si hay datos */}
              {stats.insights?.bestType && (
                <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 hidden sm:block">
                  <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                    <span className="text-lg sm:text-xl">🏆</span>
                    {t('dash.best_segment')}
                  </h3>
                  <div className="p-3 sm:p-4 bg-emerald-50 rounded-lg sm:rounded-xl border border-emerald-100">
                    <p className="font-bold text-emerald-800 text-base sm:text-lg">{stats.insights.bestType.name}</p>
                    <p className="text-emerald-700 text-xs sm:text-sm mt-0.5 sm:mt-1">
                      {stats.insights.bestType.prospects} {t('dash.prospects').toLowerCase()} • {stats.insights.bestType.rate.toFixed(0)}% {t('dash.conversion').toLowerCase()}
                    </p>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-2 sm:mt-3">
                    💡 {t('dash.focus_segment')}
                  </p>
                </div>
              )}

              {/* Top zonas - Solo en desktop */}
              {stats.insights?.topDistricts && stats.insights.topDistricts.length > 0 && (
                <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 hidden lg:block">
                  <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                    <span className="text-lg sm:text-xl">📍</span>
                    {t('dash.top_zones')}
                  </h3>
                  <div className="space-y-1.5 sm:space-y-2">
                    {stats.insights.topDistricts.slice(0, 3).map((district, i) => (
                      <div key={district.name} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg sm:rounded-xl">
                        <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold ${
                          i === 0 ? 'bg-[#FFE9B3] text-[#9A7A35]' :
                          i === 1 ? 'bg-gray-200 text-gray-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="flex-1 font-medium text-gray-700 capitalize text-xs sm:text-sm truncate">{district.name}</span>
                        <span className="text-[10px] sm:text-sm text-gray-500 flex-shrink-0">{district.prospects}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actividad del equipo hoy - Solo en desktop */}
          {stats.today.byUser && stats.today.byUser.length > 0 && (
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 hidden sm:block">
              <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">{t('dash.team_activity')}</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {stats.today.byUser.map((user, i) => (
                  <div key={user.name} className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                    <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0 ${
                      i === 0 ? 'bg-gradient-to-br from-[#0890F1] to-[#0770C5]' :
                      i === 1 ? 'bg-gradient-to-br from-[#3AA8F5] to-[#0890F1]' :
                      'bg-gradient-to-br from-sky-300 to-sky-400'
                    }`}>
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate text-sm sm:text-base">{user.name}</p>
                      <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-500">
                        {user.whatsapp > 0 && <span className="text-emerald-600">{user.whatsapp} WA</span>}
                        {user.call > 0 && <span className="text-blue-600">{user.call} <span className="hidden sm:inline">{t('dash.calls').toLowerCase()}</span><span className="sm:hidden">{t('dash.calls_short')}</span></span>}
                        {user.email > 0 && <span className="text-red-600">{user.email} <span className="hidden sm:inline">{t('dash.emails').toLowerCase()}</span></span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg sm:text-xl font-bold text-gray-900">
                        {user.whatsapp + user.email + user.call}
                      </p>
                      {user.prospects > 0 && (
                        <p className="text-[10px] sm:text-xs text-emerald-600 font-medium">+{user.prospects}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
