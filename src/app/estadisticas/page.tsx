'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
  const diff = current - previous;
  const percentChange = previous > 0 ? ((diff / previous) * 100) : (current > 0 ? 100 : 0);
  const isUp = diff >= 0;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 bg-gray-50 rounded-xl flex items-center justify-center">
          {icon}
        </div>
        {previous > 0 && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>
            {isUp ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {Math.abs(percentChange).toFixed(0)}%
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900">{current}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      <p className="text-xs text-gray-400 mt-2">
        Semana pasada: {previous}
      </p>
    </div>
  );
}

// Tips de ventas rotativos
const salesTips = [
  {
    emoji: '🎯',
    title: 'El follow-up es la clave',
    tip: '80% de las ventas requieren 5+ contactos. Solo 44% de vendedores hacen más de 1 follow-up.',
    action: 'Revisa tus leads pendientes',
    link: '/seguimiento',
  },
  {
    emoji: '⏰',
    title: 'Timing perfecto',
    tip: 'Contactar entre 8-10 AM o 4-6 PM aumenta la tasa de respuesta hasta 3x.',
    action: 'Ver leads sin contactar',
    link: '/seguimiento',
  },
  {
    emoji: '💬',
    title: 'WhatsApp primero',
    tip: 'Los mensajes de WhatsApp tienen 98% de apertura vs 20% de emails. Úsalo como primer contacto.',
    action: 'Buscar nuevos leads',
    link: '/buscar',
  },
  {
    emoji: '📊',
    title: 'Conoce tu pipeline',
    tip: 'Un vendedor top mantiene 3x más leads en "interesados" que en "nuevos". Mueve tus leads.',
    action: 'Ir al pipeline',
    link: '/seguimiento',
  },
  {
    emoji: '🏆',
    title: 'Personaliza siempre',
    tip: 'Mencionar el nombre del negocio y un detalle específico aumenta respuestas 2.5x.',
    action: 'Ver historial de búsquedas',
    link: '/historial',
  },
];

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

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
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-3 border-[#F6653C] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando tu dashboard...</p>
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
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header con saludo */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            ¡Hola! 👋
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link
          href="/buscar"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#F6653C] text-white rounded-xl hover:bg-[#e55a35] transition-all font-semibold shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Buscar leads
        </Link>
      </div>

      {stats && (
        <>
          {/* Actividad de Hoy - Card prominente */}
          <div className="bg-gradient-to-br from-[#1a1d21] to-[#2d3138] rounded-3xl p-6 mb-6 text-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white/90">Tu actividad de hoy</h2>
                <p className="text-white/60 text-sm">Sigue así, cada contacto cuenta</p>
              </div>
              <Link
                href="/seguimiento"
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-sm font-medium"
              >
                Ver pipeline
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 rounded-2xl p-4 backdrop-blur">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.today.whatsapp}</p>
                    <p className="text-white/60 text-xs">WhatsApp</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 rounded-2xl p-4 backdrop-blur">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.today.call}</p>
                    <p className="text-white/60 text-xs">Llamadas</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 rounded-2xl p-4 backdrop-blur">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.today.email}</p>
                    <p className="text-white/60 text-xs">Emails</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-2xl p-4 backdrop-blur border border-amber-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-500/30 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-300">{stats.today.prospects}</p>
                    <p className="text-amber-200/70 text-xs">Nuevos prospectos</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumen total del día */}
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <p className="text-white/70 text-sm">
                Total de contactos hoy: <span className="font-bold text-white">{todayContacts}</span>
              </p>
              {todayContacts >= 10 ? (
                <span className="text-emerald-400 text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  ¡Excelente ritmo!
                </span>
              ) : (
                <span className="text-amber-400 text-sm">
                  Meta: 10 contactos/día
                </span>
              )}
            </div>
          </div>

          {/* Progreso Semanal - Comparación */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Esta semana vs semana pasada
              </h2>
              <span className="text-sm text-gray-500">
                Día {daysInWeek} de 7
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <WeekComparison
                current={stats.thisWeek.contacts}
                previous={stats.lastWeek.contacts}
                label="Contactos"
                icon={
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
              <WeekComparison
                current={stats.thisWeek.whatsapp}
                previous={stats.lastWeek.whatsapp}
                label="WhatsApp"
                icon={
                  <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                }
              />
              <WeekComparison
                current={stats.thisWeek.call}
                previous={stats.lastWeek.call}
                label="Llamadas"
                icon={
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                }
              />
              <WeekComparison
                current={stats.thisWeek.prospects}
                previous={stats.lastWeek.prospects}
                label="Prospectos"
                icon={
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Grid principal */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Acciones pendientes - CTA principal */}
            <div className="lg:col-span-2 space-y-4">
              {/* Follow-ups pendientes */}
              {stats.total.needsFollowUp > 0 && (
                <Link
                  href="/seguimiento"
                  className="block bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white hover:shadow-lg hover:shadow-orange-200 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-3xl font-bold">{stats.total.needsFollowUp}</p>
                        <p className="text-white/90 font-medium">leads esperan tu follow-up</p>
                        <p className="text-white/70 text-sm">+3 días sin contacto</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-xl group-hover:bg-white/30 transition-colors">
                      <span className="font-semibold">Revisar ahora</span>
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              )}

              {/* Stats del pipeline */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-gray-900">Tu pipeline</h3>
                  <Link href="/seguimiento" className="text-sm text-[#F6653C] hover:underline font-medium">
                    Ver todo →
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-xl">
                    <p className="text-3xl font-bold text-blue-700">{stats.total.whatsapp + stats.total.email + stats.total.call}</p>
                    <p className="text-sm text-blue-600 mt-1">Contactados</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-xl">
                    <p className="text-3xl font-bold text-purple-700">{stats.total.prospects}</p>
                    <p className="text-sm text-purple-600 mt-1">Prospectos</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-3xl font-bold text-gray-700">{stats.total.discarded}</p>
                    <p className="text-sm text-gray-600 mt-1">Descartados</p>
                  </div>
                </div>

                {/* Tasa de conversión simplificada */}
                <div className="mt-5 pt-5 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Tasa de conversión</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {((stats.total.prospects / Math.max(stats.total.whatsapp + stats.total.email + stats.total.call, 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#F6653C] to-amber-500 rounded-full transition-all"
                      style={{
                        width: `${Math.min((stats.total.prospects / Math.max(stats.total.whatsapp + stats.total.email + stats.total.call, 1)) * 100, 100)}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    De cada 100 contactos, {((stats.total.prospects / Math.max(stats.total.whatsapp + stats.total.email + stats.total.call, 1)) * 100).toFixed(0)} se convierten en prospectos
                  </p>
                </div>
              </div>
            </div>

            {/* Tips y coaching */}
            <div className="space-y-4">
              {/* Tip del día */}
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">{currentTip.emoji}</span>
                  <h3 className="font-semibold">Tip de ventas</h3>
                </div>
                <h4 className="font-bold text-lg mb-2">{currentTip.title}</h4>
                <p className="text-white/85 text-sm mb-4 leading-relaxed">
                  {currentTip.tip}
                </p>
                <Link
                  href={currentTip.link}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  {currentTip.action}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                {/* Indicadores de tips */}
                <div className="flex items-center justify-center gap-1.5 mt-4">
                  {salesTips.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentTipIndex(i)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === currentTipIndex ? 'bg-white w-4' : 'bg-white/40 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Insights rápidos */}
              {stats.insights?.bestType && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-xl">🏆</span>
                    Tu mejor segmento
                  </h3>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="font-bold text-emerald-800 text-lg">{stats.insights.bestType.name}</p>
                    <p className="text-emerald-700 text-sm mt-1">
                      {stats.insights.bestType.prospects} prospectos • {stats.insights.bestType.rate.toFixed(0)}% conversión
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    💡 Enfócate en este tipo de negocio para mejores resultados
                  </p>
                </div>
              )}

              {/* Top zonas */}
              {stats.insights?.topDistricts && stats.insights.topDistricts.length > 0 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-xl">📍</span>
                    Top zonas
                  </h3>
                  <div className="space-y-2">
                    {stats.insights.topDistricts.slice(0, 3).map((district, i) => (
                      <div key={district.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-amber-100 text-amber-700' :
                          i === 1 ? 'bg-gray-200 text-gray-600' :
                          'bg-orange-100 text-orange-600'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="flex-1 font-medium text-gray-700 capitalize">{district.name}</span>
                        <span className="text-sm text-gray-500">{district.prospects} prospectos</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actividad del equipo hoy */}
          {stats.today.byUser && stats.today.byUser.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Actividad del equipo hoy</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.today.byUser.map((user, i) => (
                  <div key={user.name} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold ${
                      i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                      i === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                      'bg-gradient-to-br from-orange-300 to-orange-400'
                    }`}>
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{user.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {user.whatsapp > 0 && <span className="text-emerald-600">{user.whatsapp} WA</span>}
                        {user.call > 0 && <span className="text-blue-600">{user.call} llamadas</span>}
                        {user.email > 0 && <span className="text-red-600">{user.email} emails</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">
                        {user.whatsapp + user.email + user.call}
                      </p>
                      {user.prospects > 0 && (
                        <p className="text-xs text-emerald-600 font-medium">+{user.prospects} prospectos</p>
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
