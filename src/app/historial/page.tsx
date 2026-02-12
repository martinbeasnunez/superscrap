'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

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
  const { t, locale } = useI18n();

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
    return new Date(date).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', {
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
      processing: 'bg-[#FFF8E7] text-[#9A7A35] border-[#FFD06D]',
      pending: 'bg-gray-50 text-gray-700 border-gray-200',
      failed: 'bg-red-50 text-red-700 border-red-200',
    };
    const labels: Record<string, string> = {
      completed: t('status.completed'),
      processing: t('status.processing'),
      pending: t('status.pending'),
      failed: t('status.failed'),
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
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-3 border-[#0890F1] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">{t('hist.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('hist.title')}</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">{t('hist.subtitle')}</p>
        </div>
        <Link
          href="/buscar"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0890F1] text-white rounded-xl hover:bg-[#0770C5] transition-colors font-medium text-sm sm:text-base"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('hist.new_search')}
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 rounded-lg sm:rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalSearches}</p>
              <p className="text-xs sm:text-sm text-gray-500">{t('hist.searches')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#FFF8E7] rounded-lg sm:rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#B8923F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalLeads}</p>
              <p className="text-xs sm:text-sm text-gray-500">{t('hist.leads')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-lg sm:rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalProspects}</p>
              <p className="text-xs sm:text-sm text-gray-500">{t('hist.prospects')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        <span className="text-sm text-gray-500 hidden sm:inline">{t('hist.filter')}</span>
        <div className="flex bg-gray-100 rounded-xl p-1 min-w-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              filter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('hist.all')} ({searches.length})
          </button>
          <button
            onClick={() => setFilter('with_prospects')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              filter === 'with_prospects'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('hist.with_prospects')} ({searches.filter(s => s.contact_stats.prospects > 0).length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              filter === 'completed'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('hist.completed')} ({searches.filter(s => s.status === 'completed').length})
          </button>
        </div>
      </div>

      {/* Searches List */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredSearches.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-2">{t('hist.no_match')}</p>
            <Link href="/buscar" className="inline-flex items-center gap-2 text-[#0890F1] hover:underline font-medium">
              {t('hist.create_new')}
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
                className="flex items-center p-3 sm:p-5 hover:bg-gray-50 transition-colors group"
              >
                {/* Icon */}
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-lg sm:rounded-xl flex items-center justify-center text-xl sm:text-2xl mr-3 sm:mr-4 flex-shrink-0 group-hover:bg-gray-200 transition-colors">
                  {getIcon(search.business_type)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-[#0890F1] transition-colors">
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
                <div className="hidden sm:flex items-center gap-6">
                  {search.matching_results !== null && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-700">{search.matching_results}</p>
                      <p className="text-xs text-gray-500">{t('hist.leads')}</p>
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
                      <p className="text-xs text-gray-500">{t('hist.prospects')}</p>
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
