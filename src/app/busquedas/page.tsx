'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
}

interface Stats {
  total: {
    searches: number;
    businesses: number;
    whatsapp: number;
    called: number;
    contacted: number;
  };
  today: {
    searches: number;
    whatsapp: number;
    called: number;
    contacted: number;
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
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Nueva búsqueda
          </Link>
        </div>

        {/* Stats Panel */}
        {stats && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900">{stats.total.searches}</p>
                <p className="text-sm text-gray-500">Búsquedas totales</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{stats.total.whatsapp}</p>
                <p className="text-sm text-gray-500">WhatsApp enviados</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{stats.total.called}</p>
                <p className="text-sm text-gray-500">Llamados</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">{stats.total.contacted}</p>
                <p className="text-sm text-gray-500">Contactados</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-gray-500 uppercase font-medium mb-3">Hoy</p>
              <div className="flex flex-wrap gap-4">
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  <strong>{stats.today.searches}</strong> búsquedas
                </span>
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <strong>{stats.today.whatsapp}</strong> WhatsApp
                </span>
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <strong>{stats.today.called}</strong> llamados
                </span>
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <strong>{stats.today.contacted}</strong> contactados
                </span>
              </div>
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
                      <p className="text-sm text-gray-600 mt-2">
                        {search.matching_results} de {search.total_results} coinciden
                      </p>
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
