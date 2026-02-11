'use client';

import { useState, useEffect } from 'react';
import SearchForm from '@/components/SearchForm';
import Link from 'next/link';

interface RecentSearch {
  id: string;
  business_type: string;
  city: string;
  created_at: string;
  total_results: number | null;
  matching_results: number | null;
}

export default function BusquedasPage() {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('superscrap_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setUserId(user.id);
      } catch {
        // ignore
      }
    }

    // Fetch recent searches
    async function fetchRecentSearches() {
      try {
        const res = await fetch('/api/searches?limit=5');
        const data = await res.json();
        setRecentSearches(data.searches || []);
      } catch (error) {
        console.error('Error fetching searches:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchRecentSearches();
  }, []);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `hace ${diffMins}m`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    return `hace ${diffDays}d`;
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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nueva Búsqueda</h1>
        <p className="text-gray-500 mt-1">Encuentra negocios con necesidades de lavandería industrial</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Search Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <SearchForm userId={userId || ''} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick tips */}
          <div className="bg-gradient-to-br from-[#F6653C]/10 to-orange-50 rounded-2xl p-6 border border-[#F6653C]/20">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#F6653C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Tips de búsqueda
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3 p-3 bg-white/60 rounded-xl">
                <span className="text-lg">🏨</span>
                <div>
                  <p className="font-medium text-gray-800">Hoteles</p>
                  <p className="text-gray-600 text-xs">Sábanas, toallas, batas</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/60 rounded-xl">
                <span className="text-lg">🍽️</span>
                <div>
                  <p className="font-medium text-gray-800">Restaurantes</p>
                  <p className="text-gray-600 text-xs">Manteles, servilletas, uniformes</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/60 rounded-xl">
                <span className="text-lg">🏥</span>
                <div>
                  <p className="font-medium text-gray-800">Clínicas</p>
                  <p className="text-gray-600 text-xs">Sábanas médicas, batas, uniformes</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/60 rounded-xl">
                <span className="text-lg">🛡️</span>
                <div>
                  <p className="font-medium text-gray-800">Seguridad</p>
                  <p className="text-gray-600 text-xs">Uniformes en volumen</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent searches */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Búsquedas recientes</h3>
              <Link href="/historial" className="text-sm text-[#F6653C] hover:underline">
                Ver todas
              </Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-[#F6653C] border-t-transparent rounded-full"></div>
              </div>
            ) : recentSearches.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No hay búsquedas aún
              </p>
            ) : (
              <div className="space-y-2">
                {recentSearches.map((search) => (
                  <Link
                    key={search.id}
                    href={`/busquedas/${search.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <span className="text-xl">{getIcon(search.business_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#F6653C]">
                        {search.business_type}
                      </p>
                      <p className="text-xs text-gray-500">{search.city}</p>
                    </div>
                    <div className="text-right">
                      {search.matching_results !== null && (
                        <p className="text-xs font-medium text-emerald-600">
                          {search.matching_results} leads
                        </p>
                      )}
                      <p className="text-xs text-gray-400">{formatTimeAgo(search.created_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
