'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SearchWithResults, BusinessWithAnalysis } from '@/types';
import BusinessCard, { isPriorityDistrict } from '@/components/BusinessCard';

export default function SearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<{
    search: SearchWithResults;
    businesses: BusinessWithAnalysis[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'matching'>('all');
  const [deleting, setDeleting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreMessage, setLoadMoreMessage] = useState('');

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar esta búsqueda? Se perderán todos los negocios encontrados.')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/searches/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/busquedas');
      } else {
        alert('Error al eliminar la búsqueda');
      }
    } catch {
      alert('Error al eliminar la búsqueda');
    } finally {
      setDeleting(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    setLoadMoreMessage('');
    try {
      const response = await fetch(`/api/searches/${id}/load-more`, {
        method: 'POST',
      });
      const result = await response.json();

      if (response.ok) {
        setLoadMoreMessage(`+${result.added} negocios agregados`);
        // Recargar datos
        const refreshResponse = await fetch(`/api/searches/${id}`);
        if (refreshResponse.ok) {
          const refreshedData = await refreshResponse.json();
          setData(refreshedData);
        }
      } else {
        setLoadMoreMessage(result.error || 'Error al cargar más');
      }
    } catch {
      setLoadMoreMessage('Error de conexión');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    async function fetchSearchDetail() {
      try {
        const response = await fetch(`/api/searches/${id}`);
        if (!response.ok) {
          throw new Error('Búsqueda no encontrada');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchSearchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4"
            viewBox="0 0 24 24"
          >
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
          <p className="text-gray-600">Cargando resultados...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Error al cargar'}</p>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const { search, businesses } = data;
  const filteredBusinesses =
    filter === 'matching'
      ? businesses.filter((b) => b.analysis?.matches_requirements)
      : businesses;

  // Sort by priority district (top zones first)
  const sortedBusinesses = [...filteredBusinesses].sort((a, b) => {
    const aPriority = isPriorityDistrict(a.address) ? 1 : 0;
    const bPriority = isPriorityDistrict(b.address) ? 1 : 0;
    return bPriority - aPriority;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link
          href="/busquedas"
          className="text-blue-600 hover:text-blue-800 mb-6 inline-block"
        >
          ← Volver al historial
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {search.business_type} en {search.city}
          </h1>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-gray-500">Servicios buscados:</span>
            {search.required_services.map((service) => (
              <span
                key={service}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
              >
                {service}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-gray-600">
              <span>
                <strong className="text-gray-900">{search.total_results}</strong>{' '}
                negocios encontrados
              </span>
              <span>
                <strong className="text-green-600">{search.matching_results}</strong>{' '}
                coinciden con tus criterios
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Buscando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    +20 más
                  </>
                )}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
          {loadMoreMessage && (
            <p className={`mt-2 text-sm ${loadMoreMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {loadMoreMessage}
            </p>
          )}
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Resultados</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Todos ({businesses.length})
            </button>
            <button
              onClick={() => setFilter('matching')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'matching'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Coinciden ({businesses.filter((b) => b.analysis?.matches_requirements).length})
            </button>
          </div>
        </div>

        {sortedBusinesses.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-gray-500">
              {filter === 'matching'
                ? 'Ningún negocio coincide con todos los criterios'
                : 'No se encontraron negocios'}
            </p>
          </div>
        ) : (
          (() => {
            // Agrupar negocios por fecha (dia)
            const groupedByDate: Record<string, typeof sortedBusinesses> = {};
            sortedBusinesses.forEach((business) => {
              const date = new Date(business.created_at).toLocaleDateString('es-PE', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });
              // Agrupar por hora redondeada (para separar cargas del mismo dia)
              const hourKey = new Date(business.created_at).toISOString().slice(0, 13); // YYYY-MM-DDTHH
              if (!groupedByDate[hourKey]) {
                groupedByDate[hourKey] = [];
              }
              groupedByDate[hourKey].push(business);
            });

            const dateGroups = Object.entries(groupedByDate).sort((a, b) => a[0].localeCompare(b[0]));

            return (
              <div className="space-y-6">
                {dateGroups.map(([hourKey, groupBusinesses], groupIndex) => {
                  const firstBusiness = groupBusinesses[0];
                  const groupDate = new Date(firstBusiness.created_at);
                  const isToday = new Date().toDateString() === groupDate.toDateString();
                  const timeLabel = groupDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                  const dateLabel = isToday
                    ? `Hoy ${timeLabel}`
                    : groupDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) + ` ${timeLabel}`;

                  return (
                    <div key={hourKey}>
                      {/* Mostrar separador si hay mas de un grupo */}
                      {dateGroups.length > 1 && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1 h-px bg-gray-300"></div>
                          <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                            groupIndex === dateGroups.length - 1
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {groupIndex === dateGroups.length - 1 && dateGroups.length > 1 ? '🆕 ' : ''}
                            {dateLabel} ({groupBusinesses.length})
                          </span>
                          <div className="flex-1 h-px bg-gray-300"></div>
                        </div>
                      )}
                      <div className="grid gap-4 md:grid-cols-2">
                        {groupBusinesses.map((business) => (
                          <BusinessCard
                            key={business.id}
                            business={business}
                            requiredServices={search.required_services}
                            businessType={search.business_type}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
