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
}

export default function BusquedasPage() {
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      processing: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-gray-100 text-gray-800',
      failed: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      completed: 'Completada',
      processing: 'Procesando',
      pending: 'Pendiente',
      failed: 'Error',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Búsquedas del equipo
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/seguimiento"
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Seguimiento
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Nueva búsqueda
            </Link>
          </div>
        </div>

        {/* Stats Panel */}
        {stats && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900">{stats.total.searches}</p>
                <p className="text-sm text-gray-500">Busquedas</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{stats.total.whatsapp}</p>
                <p className="text-sm text-gray-500">WhatsApp</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">{stats.total.email}</p>
                <p className="text-sm text-gray-500">Emails</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{stats.total.call}</p>
                <p className="text-sm text-gray-500">Llamadas</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-3xl font-bold text-emerald-600">{stats.total.prospects}</p>
                <p className="text-sm text-gray-500">Prospectos</p>
              </div>
              <Link href="/seguimiento" className="text-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                <p className="text-3xl font-bold text-orange-600">{stats.total.needsFollowUp}</p>
                <p className="text-sm text-gray-500">Follow Up</p>
              </Link>
              <div className="text-center p-4 bg-gray-100 rounded-lg">
                <p className="text-3xl font-bold text-gray-500">{stats.total.discarded}</p>
                <p className="text-sm text-gray-500">Descartados</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-gray-500 uppercase font-medium mb-3">Hoy</p>
              <div className="flex flex-wrap gap-4 mb-4">
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  <strong>{stats.today.searches}</strong> busquedas
                </span>
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <strong>{stats.today.whatsapp}</strong> WhatsApp
                </span>
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <strong>{stats.today.email}</strong> emails
                </span>
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <strong>{stats.today.call}</strong> llamadas
                </span>
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <strong>{stats.today.prospects}</strong> prospectos
                </span>
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  <strong>{stats.today.discarded}</strong> descartados
                </span>
              </div>

              {/* Stats por usuario */}
              {stats.today.byUser && stats.today.byUser.length > 0 && (
                <div className="mt-4 pt-4 border-t border-dashed">
                  <p className="text-xs text-gray-500 uppercase font-medium mb-3">Por persona hoy</p>
                  <div className="grid gap-2">
                    {stats.today.byUser.map((user) => (
                      <div key={user.name} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-medium text-gray-700">{user.name}</span>
                        <div className="flex gap-3 text-sm">
                          {user.whatsapp > 0 && (
                            <span className="text-green-600">
                              <strong>{user.whatsapp}</strong> WA
                            </span>
                          )}
                          {user.email > 0 && (
                            <span className="text-red-600">
                              <strong>{user.email}</strong> email
                            </span>
                          )}
                          {user.call > 0 && (
                            <span className="text-blue-600">
                              <strong>{user.call}</strong> llamadas
                            </span>
                          )}
                          {user.prospects > 0 && (
                            <span className="text-emerald-600">
                              <strong>{user.prospects}</strong> prospectos
                            </span>
                          )}
                          {user.discarded > 0 && (
                            <span className="text-gray-500">
                              <strong>{user.discarded}</strong> descart.
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        ) : searches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <p className="text-gray-500 mb-4">No hay búsquedas aún</p>
            <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
              Crear la primera búsqueda →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {searches.map((search) => (
              <Link
                key={search.id}
                href={`/busquedas/${search.id}`}
                className="block bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {search.business_type} en {search.city}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {search.required_services.map((service) => (
                        <span
                          key={service}
                          className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {search.created_by}
                      </span>
                      <span>•</span>
                      <span>{formatDate(search.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    {getStatusBadge(search.status)}
                    {search.status === 'completed' && (
                      <>
                        <p className="text-sm text-gray-600 mt-2">
                          {search.matching_results} de {search.total_results} coinciden
                        </p>
                        {/* Progreso de contacto */}
                        {(search.contact_stats.contacted > 0 || search.contact_stats.prospects > 0) && (
                          <div className="flex items-center justify-end gap-2 mt-2 text-xs">
                            {search.contact_stats.whatsapp > 0 && (
                              <span className="inline-flex items-center gap-1 text-green-600" title="WhatsApp enviados">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                {search.contact_stats.whatsapp}
                              </span>
                            )}
                            {search.contact_stats.email > 0 && (
                              <span className="inline-flex items-center gap-1 text-red-500" title="Emails enviados">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {search.contact_stats.email}
                              </span>
                            )}
                            {search.contact_stats.call > 0 && (
                              <span className="inline-flex items-center gap-1 text-blue-500" title="Llamadas realizadas">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {search.contact_stats.call}
                              </span>
                            )}
                            {search.contact_stats.prospects > 0 && (
                              <span className="inline-flex items-center gap-1 text-emerald-600" title="Prospectos interesados">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {search.contact_stats.prospects}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
