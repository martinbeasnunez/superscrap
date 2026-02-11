'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ContactStats {
  whatsapp: number;
  email: number;
  call: number;
  contacted: number;
  prospects: number;
  discarded: number;
}

interface SearchWithUser {
  id: string;
  business_type: string;
  city: string;
  required_services: string[];
  status: string;
  total_results: number | null;
  matching_results: number | null;
  created_at: string;
  created_by: string;
  created_by_email: string | null;
  contact_stats: ContactStats;
}

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

export default function EstadisticasPage() {
  const [searches, setSearches] = useState<SearchWithUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [searchesRes, statsRes] = await Promise.all([
          fetch('/api/searches'),
          fetch('/api/stats'),
        ]);

        const searchesData = await searchesRes.json();
        const statsData = await statsRes.json();

        setSearches(searchesData.searches || []);
        setStats(statsData);
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
      completed: 'bg-emerald-100 text-emerald-700',
      processing: 'bg-amber-100 text-amber-700',
      pending: 'bg-gray-100 text-gray-700',
      failed: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      completed: 'Completada',
      processing: 'Procesando',
      pending: 'Pendiente',
      failed: 'Error',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-3 border-[#F6653C] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
          <p className="text-gray-500 mt-1">Métricas de rendimiento y conversión</p>
        </div>
      </div>

      {/* Main Stats */}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-3xl font-bold text-gray-900">{stats.total.searches}</p>
              <p className="text-sm text-gray-500 mt-1">Búsquedas</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-3xl font-bold text-emerald-500">{stats.total.whatsapp}</p>
              <p className="text-sm text-gray-500 mt-1">WhatsApp</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-3xl font-bold text-red-500">{stats.total.email}</p>
              <p className="text-sm text-gray-500 mt-1">Emails</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-3xl font-bold text-blue-500">{stats.total.call}</p>
              <p className="text-sm text-gray-500 mt-1">Llamadas</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-3xl font-bold text-emerald-600">{stats.total.prospects}</p>
              <p className="text-sm text-gray-500 mt-1">Prospectos</p>
            </div>
            <Link href="/seguimiento" className="bg-white rounded-2xl p-5 shadow-sm border-2 border-orange-200 hover:border-orange-300 transition-colors">
              <p className="text-3xl font-bold text-orange-500">{stats.total.needsFollowUp}</p>
              <p className="text-sm text-orange-600 mt-1 font-medium">Pendientes</p>
            </Link>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-3xl font-bold text-gray-400">{stats.total.discarded}</p>
              <p className="text-sm text-gray-500 mt-1">Descartados</p>
            </div>
          </div>

          {/* Funnel & Insights */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Funnel */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Funnel de Conversión
              </h3>

              {(() => {
                const totalContacts = stats.total.whatsapp + stats.total.email + stats.total.call;
                const prospectRate = totalContacts > 0 ? ((stats.total.prospects / totalContacts) * 100).toFixed(1) : '0';
                const discardRate = totalContacts > 0 ? ((stats.total.discarded / totalContacts) * 100).toFixed(1) : '0';
                const pendingRate = totalContacts > 0 ? (((totalContacts - stats.total.prospects - stats.total.discarded) / totalContacts) * 100).toFixed(1) : '0';

                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-24 text-right text-sm text-gray-500">Contactados</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                        <div className="absolute inset-0 bg-blue-500 rounded-full" style={{ width: '100%' }}></div>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">{totalContacts}</span>
                      </div>
                      <div className="w-14 text-sm text-gray-500">100%</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-24 text-right text-sm text-gray-500">En proceso</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                        <div className="absolute inset-0 bg-amber-500 rounded-full" style={{ width: `${pendingRate}%` }}></div>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-700">{totalContacts - stats.total.prospects - stats.total.discarded}</span>
                      </div>
                      <div className="w-14 text-sm font-medium text-amber-600">{pendingRate}%</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-24 text-right text-sm text-gray-500">Prospectos</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                        <div className="absolute inset-0 bg-emerald-500 rounded-full" style={{ width: `${prospectRate}%` }}></div>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-700">{stats.total.prospects}</span>
                      </div>
                      <div className="w-14 text-sm font-medium text-emerald-600">{prospectRate}%</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-24 text-right text-sm text-gray-500">Descartados</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gray-400 rounded-full" style={{ width: `${discardRate}%` }}></div>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-700">{stats.total.discarded}</span>
                      </div>
                      <div className="w-14 text-sm text-gray-500">{discardRate}%</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Insights */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
              <h3 className="font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Insights
              </h3>

              {stats.insights?.bestType && (
                <div className="p-4 bg-white/60 rounded-xl mb-4">
                  <p className="text-sm font-medium text-indigo-800">Mejor tipo de negocio</p>
                  <p className="text-lg font-bold text-indigo-900">{stats.insights.bestType.name}</p>
                  <p className="text-sm text-indigo-700">
                    {stats.insights.bestType.prospects} prospectos ({stats.insights.bestType.rate.toFixed(0)}% conversión)
                  </p>
                </div>
              )}

              {stats.insights?.topDistricts && stats.insights.topDistricts.length > 0 && (
                <div className="p-4 bg-white/60 rounded-xl">
                  <p className="text-sm font-medium text-indigo-800 mb-2">Top distritos</p>
                  <div className="space-y-2">
                    {stats.insights.topDistricts.map((district, i) => (
                      <div key={district.name} className="flex items-center justify-between">
                        <span className="text-sm text-indigo-900">
                          {i + 1}. {district.name}
                        </span>
                        <span className="text-sm font-medium text-indigo-700">
                          {district.prospects} prospectos
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Today's Activity */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Actividad de hoy</h3>

            <div className="flex flex-wrap gap-6 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                <span className="text-sm"><strong>{stats.today.searches}</strong> búsquedas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                <span className="text-sm"><strong>{stats.today.whatsapp}</strong> WhatsApp</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span className="text-sm"><strong>{stats.today.email}</strong> emails</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span className="text-sm"><strong>{stats.today.call}</strong> llamadas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-600 rounded-full"></span>
                <span className="text-sm"><strong>{stats.today.prospects}</strong> prospectos</span>
              </div>
            </div>

            {/* By user */}
            {stats.today.byUser && stats.today.byUser.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-3">Por persona</p>
                <div className="grid gap-2">
                  {stats.today.byUser.map((user) => (
                    <div key={user.name} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {user.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-700">{user.name}</span>
                      </div>
                      <div className="flex gap-4 text-sm">
                        {user.whatsapp > 0 && <span className="text-emerald-600"><strong>{user.whatsapp}</strong> WA</span>}
                        {user.email > 0 && <span className="text-red-600"><strong>{user.email}</strong> email</span>}
                        {user.call > 0 && <span className="text-blue-600"><strong>{user.call}</strong> llamadas</span>}
                        {user.prospects > 0 && <span className="text-emerald-600"><strong>{user.prospects}</strong> prospectos</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Searches List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="font-semibold text-gray-900">Historial de búsquedas</h3>
        </div>

        {searches.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay búsquedas aún
          </div>
        ) : (
          <div className="divide-y">
            {searches.map((search) => (
              <Link
                key={search.id}
                href={`/busquedas/${search.id}`}
                className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-gray-900">
                      {search.business_type} en {search.city}
                    </h4>
                    {getStatusBadge(search.status)}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>{search.created_by}</span>
                    <span>•</span>
                    <span>{formatDate(search.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  {search.contact_stats.whatsapp > 0 && (
                    <span className="text-emerald-600">{search.contact_stats.whatsapp} WA</span>
                  )}
                  {search.contact_stats.prospects > 0 && (
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                      {search.contact_stats.prospects} prospectos
                    </span>
                  )}
                  {search.matching_results !== null && (
                    <span className="text-gray-500">
                      {search.matching_results}/{search.total_results} leads
                    </span>
                  )}
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
