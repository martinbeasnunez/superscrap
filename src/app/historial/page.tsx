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

export default function HistorialPage() {
  const [searches, setSearches] = useState<SearchWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'with_prospects' | 'completed'>('all');

  useEffect(() => {
    async function fetchSearches() {
      try {
        const res = await fetch('/api/searches');
        const data = await res.json();
        setSearches(data.searches || []);
      } catch (error) {
        console.error('Error fetching searches:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSearches();
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

  const industryIcons: Record<string, string> = {
    hotel: '🏨',
    hostal: '🛏️',
    restaurante: '🍽️',
    cevicheria: '🐟',
    clinica: '🏥',
    gimnasio: '💪',
    spa: '💆',
    seguridad: '🛡️',
    limpieza: '🧹',
    edificio: '🏢',
  };

  const getIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    for (const [key, icon] of Object.entries(industryIcons)) {
      if (lowerType.includes(key)) return icon;
    }
    return '🔍';
  };

  // Filtrar búsquedas
  const filteredSearches = searches.filter((search) => {
    if (filter === 'with_prospects') return search.contact_stats.prospects > 0;
    if (filter === 'completed') return search.status === 'completed';
    return true;
  });

  // Stats
  const totalSearches = searches.length;
  const totalLeads = searches.reduce((acc, s) => acc + (s.matching_results || 0), 0);
  const totalProspects = searches.reduce((acc, s) => acc + s.contact_stats.prospects, 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-3 border-[#F6653C] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando historial...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Búsquedas</h1>
          <p className="text-gray-500 mt-1">Todas las búsquedas realizadas por el equipo</p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#F6653C] text-white rounded-xl hover:bg-[#e55a35] transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva búsqueda
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalSearches}</p>
              <p className="text-sm text-gray-500">Búsquedas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
              <p className="text-sm text-gray-500">Leads encontrados</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalProspects}</p>
              <p className="text-sm text-gray-500">Prospectos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-gray-500">Filtrar:</span>
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Todas ({searches.length})
          </button>
          <button
            onClick={() => setFilter('with_prospects')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === 'with_prospects'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Con prospectos ({searches.filter(s => s.contact_stats.prospects > 0).length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === 'completed'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Completadas ({searches.filter(s => s.status === 'completed').length})
          </button>
        </div>
      </div>

      {/* Searches List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredSearches.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-2">No hay búsquedas que coincidan</p>
            <Link href="/" className="inline-flex items-center gap-2 text-[#F6653C] hover:underline font-medium">
              Crear nueva búsqueda
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredSearches.map((search) => (
              <Link
                key={search.id}
                href={`/busquedas/${search.id}`}
                className="flex items-center p-5 hover:bg-gray-50 transition-colors group"
              >
                {/* Icon */}
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl mr-4 group-hover:bg-gray-200 transition-colors">
                  {getIcon(search.business_type)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-[#F6653C] transition-colors">
                      {search.business_type}
                    </h3>
                    {getStatusBadge(search.status)}
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{search.city}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {search.created_by}
                    </span>
                    <span>{formatDate(search.created_at)}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6">
                  {search.matching_results !== null && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-700">{search.matching_results}</p>
                      <p className="text-xs text-gray-500">Leads</p>
                    </div>
                  )}
                  {search.contact_stats.whatsapp > 0 && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-emerald-600">{search.contact_stats.whatsapp}</p>
                      <p className="text-xs text-gray-500">WhatsApp</p>
                    </div>
                  )}
                  {search.contact_stats.prospects > 0 && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-purple-600">{search.contact_stats.prospects}</p>
                      <p className="text-xs text-gray-500">Prospectos</p>
                    </div>
                  )}
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
