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
  insights?: {
    bestType: { name: string; rate: number; prospects: number } | null;
    topDistricts: { name: string; prospects: number }[];
  };
}

// Mini bar chart component
function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((value, i) => (
        <div
          key={i}
          className="flex-1 rounded-t transition-all hover:opacity-80"
          style={{
            height: `${(value / max) * 100}%`,
            backgroundColor: color,
            minHeight: value > 0 ? '4px' : '2px',
          }}
        />
      ))}
    </div>
  );
}

// Circular progress component
function CircularProgress({ value, max, color, size = 120 }: { value: number; max: number; color: string; size?: number }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{percentage.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export default function EstadisticasPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      processing: 'bg-amber-50 text-amber-700 border-amber-200',
      pending: 'bg-gray-50 text-gray-700 border-gray-200',
      failed: 'bg-red-50 text-red-700 border-red-200',
    };
    const labels: Record<string, string> = {
      completed: 'Completada',
      processing: 'Procesando',
      pending: 'Pendiente',
      failed: 'Error',
    };
    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-3 border-[#F6653C] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  const totalContacts = stats ? stats.total.whatsapp + stats.total.email + stats.total.call : 0;
  const conversionRate = totalContacts > 0 ? (stats!.total.prospects / totalContacts) * 100 : 0;

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
          <p className="text-gray-500 mt-1">Métricas de rendimiento y análisis de conversión</p>
        </div>

        <Link
          href="/historial"
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Ver historial
        </Link>
      </div>

      {stats && (
        <>
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Total Contacts */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-medium">
                  +{stats.today.whatsapp + stats.today.email + stats.today.call} hoy
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{totalContacts}</p>
              <p className="text-sm text-gray-500 mt-1">Contactos totales</p>
            </div>

            {/* Prospects */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-medium">
                  +{stats.today.prospects} hoy
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.total.prospects}</p>
              <p className="text-sm text-gray-500 mt-1">Prospectos</p>
            </div>

            {/* Follow-ups needed */}
            <Link href="/seguimiento" className="bg-white rounded-2xl p-6 shadow-sm border border-orange-200 hover:border-orange-300 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-orange-600">{stats.total.needsFollowUp}</p>
              <p className="text-sm text-orange-600 mt-1 font-medium">Pendientes de follow-up</p>
            </Link>

            {/* Conversion Rate */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{conversionRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-500 mt-1">Tasa de conversión</p>
            </div>
          </div>

          {/* Main Stats Grid */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Conversion Funnel */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900">Funnel de Conversión</h3>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-500 rounded"></span> Contactados
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-amber-500 rounded"></span> En proceso
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-emerald-500 rounded"></span> Prospectos
                  </span>
                </div>
              </div>

              {/* Funnel visualization */}
              <div className="space-y-4">
                {(() => {
                  const inProcess = totalContacts - stats.total.prospects - stats.total.discarded;
                  const prospectRate = totalContacts > 0 ? (stats.total.prospects / totalContacts) * 100 : 0;
                  const inProcessRate = totalContacts > 0 ? (inProcess / totalContacts) * 100 : 0;
                  const discardRate = totalContacts > 0 ? (stats.total.discarded / totalContacts) * 100 : 0;

                  return (
                    <>
                      <div className="flex items-center gap-4">
                        <div className="w-28 text-right">
                          <span className="text-sm font-medium text-gray-700">Contactados</span>
                        </div>
                        <div className="flex-1 h-10 bg-gray-100 rounded-xl overflow-hidden relative">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-xl flex items-center justify-end pr-4"
                            style={{ width: '100%' }}
                          >
                            <span className="text-white font-bold text-sm">{totalContacts}</span>
                          </div>
                        </div>
                        <div className="w-16 text-right">
                          <span className="text-sm font-medium text-gray-500">100%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-28 text-right">
                          <span className="text-sm font-medium text-gray-700">En proceso</span>
                        </div>
                        <div className="flex-1 h-10 bg-gray-100 rounded-xl overflow-hidden relative">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-xl flex items-center pr-4"
                            style={{ width: `${inProcessRate}%`, minWidth: inProcess > 0 ? '60px' : '0' }}
                          >
                            <span className="text-white font-bold text-sm ml-auto">{inProcess}</span>
                          </div>
                        </div>
                        <div className="w-16 text-right">
                          <span className="text-sm font-medium text-amber-600">{inProcessRate.toFixed(0)}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-28 text-right">
                          <span className="text-sm font-medium text-gray-700">Prospectos</span>
                        </div>
                        <div className="flex-1 h-10 bg-gray-100 rounded-xl overflow-hidden relative">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-xl flex items-center pr-4"
                            style={{ width: `${prospectRate}%`, minWidth: stats.total.prospects > 0 ? '60px' : '0' }}
                          >
                            <span className="text-white font-bold text-sm ml-auto">{stats.total.prospects}</span>
                          </div>
                        </div>
                        <div className="w-16 text-right">
                          <span className="text-sm font-bold text-emerald-600">{prospectRate.toFixed(1)}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-28 text-right">
                          <span className="text-sm font-medium text-gray-500">Descartados</span>
                        </div>
                        <div className="flex-1 h-10 bg-gray-100 rounded-xl overflow-hidden relative">
                          <div
                            className="h-full bg-gray-400 rounded-xl flex items-center pr-4"
                            style={{ width: `${discardRate}%`, minWidth: stats.total.discarded > 0 ? '60px' : '0' }}
                          >
                            <span className="text-white font-bold text-sm ml-auto">{stats.total.discarded}</span>
                          </div>
                        </div>
                        <div className="w-16 text-right">
                          <span className="text-sm text-gray-500">{discardRate.toFixed(0)}%</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Conversion Circle */}
            <div className="bg-gradient-to-br from-[#F6653C]/5 to-orange-50 rounded-2xl p-6 border border-[#F6653C]/10">
              <h3 className="font-semibold text-gray-900 mb-6">Tasa de Conversión</h3>

              <div className="flex justify-center mb-6">
                <CircularProgress
                  value={stats.total.prospects}
                  max={totalContacts}
                  color="#F6653C"
                  size={140}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                  <span className="text-sm text-gray-600">Benchmark industria</span>
                  <span className="text-sm font-medium text-gray-900">2.5%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                  <span className="text-sm text-gray-600">Tu conversión</span>
                  <span className={`text-sm font-bold ${conversionRate >= 2.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {conversionRate.toFixed(1)}%
                  </span>
                </div>
                {conversionRate >= 2.5 ? (
                  <p className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-xl">
                    🎉 ¡Estás por encima del promedio de la industria!
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl">
                    💡 El follow-up aumenta la conversión hasta 80%
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Second Row */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Channel Breakdown */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-6">Canales de contacto</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-700">WhatsApp</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{stats.total.whatsapp}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${totalContacts > 0 ? (stats.total.whatsapp / totalContacts) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-700">Email</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{stats.total.email}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${totalContacts > 0 ? (stats.total.email / totalContacts) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-700">Llamadas</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{stats.total.call}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${totalContacts > 0 ? (stats.total.call / totalContacts) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Insights */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
              <h3 className="font-semibold mb-6 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Insights IA
              </h3>

              {stats.insights?.bestType && (
                <div className="p-4 bg-white/10 rounded-xl mb-4 backdrop-blur">
                  <p className="text-sm text-white/80 mb-1">🏆 Mejor tipo de negocio</p>
                  <p className="text-xl font-bold">{stats.insights.bestType.name}</p>
                  <p className="text-sm text-white/70">
                    {stats.insights.bestType.prospects} prospectos • {stats.insights.bestType.rate.toFixed(0)}% conversión
                  </p>
                </div>
              )}

              {stats.insights?.topDistricts && stats.insights.topDistricts.length > 0 && (
                <div className="p-4 bg-white/10 rounded-xl backdrop-blur">
                  <p className="text-sm text-white/80 mb-3">📍 Top zonas</p>
                  <div className="space-y-2">
                    {stats.insights.topDistricts.slice(0, 3).map((district, i) => (
                      <div key={district.name} className="flex items-center justify-between">
                        <span className="text-sm flex items-center gap-2">
                          <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs">
                            {i + 1}
                          </span>
                          {district.name}
                        </span>
                        <span className="text-sm font-medium">{district.prospects}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Team Performance */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-6">Actividad de hoy</h3>

              {stats.today.byUser && stats.today.byUser.length > 0 ? (
                <div className="space-y-3">
                  {stats.today.byUser.map((user, i) => (
                    <div key={user.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                        i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                        i === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                        'bg-gradient-to-br from-orange-300 to-orange-400'
                      }`}>
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{user.name}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {user.whatsapp > 0 && <span>{user.whatsapp} WA</span>}
                          {user.call > 0 && <span>{user.call} llamadas</span>}
                          {user.prospects > 0 && <span className="text-emerald-600 font-medium">{user.prospects} prospectos</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {user.whatsapp + user.email + user.call}
                        </p>
                        <p className="text-xs text-gray-500">contactos</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>Sin actividad hoy</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
