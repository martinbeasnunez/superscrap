'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getAllIndustries } from '@/lib/landing-config';

export default function LandingsPage() {
  const industries = getAllIndustries();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://superscrap.vercel.app';

  const handleCopyUrl = (slug: string) => {
    const url = `${baseUrl}/landing/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(slug);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const industryIcons: Record<string, string> = {
    hoteles: '🏨',
    restaurantes: '🍽️',
    clinicas: '🏥',
    gimnasios: '💪',
    spas: '💆',
    'empresas-seguridad': '🛡️',
    edificios: '🏢',
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Landing Pages</h1>
          <p className="text-gray-500 mt-1">Páginas optimizadas para SEO y conversión por industria</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {industries.length} landings activas
          </span>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-400 rounded-xl cursor-not-allowed font-medium"
            title="Próximamente"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear landing
            <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded ml-1">Pronto</span>
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{industries.length}</p>
              <p className="text-sm text-gray-500">Páginas activas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">SEO</p>
              <p className="text-sm text-gray-500">Optimizado</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">JSON-LD</p>
              <p className="text-sm text-gray-500">Schema.org</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F6653C]/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-[#F6653C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">CRO</p>
              <p className="text-sm text-gray-500">Conversión</p>
            </div>
          </div>
        </div>
      </div>

      {/* Landings Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {industries.map((industry) => (
          <div
            key={industry.slug}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-all"
          >
            {/* Preview Image */}
            <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
              <img
                src={industry.heroImage}
                alt={industry.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span className="text-2xl">{industryIcons[industry.slug] || '📄'}</span>
                <h3 className="text-lg font-bold text-white">{industry.namePlural}</h3>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              {/* SEO Info */}
              <div className="mb-4">
                <p className="text-sm text-gray-600 line-clamp-2">{industry.seo.description}</p>
              </div>

              {/* Keywords */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {industry.seo.keywords.slice(0, 3).map((keyword) => (
                  <span
                    key={keyword}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                  >
                    {keyword}
                  </span>
                ))}
              </div>

              {/* URL */}
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl mb-4">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <code className="text-xs text-gray-600 flex-1 truncate">/landing/{industry.slug}</code>
                <button
                  onClick={() => handleCopyUrl(industry.slug)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Copiar URL"
                >
                  {copiedUrl === industry.slug ? (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/landing/${industry.slug}`}
                  target="_blank"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F6653C] text-white rounded-xl hover:bg-[#e55a35] transition-colors font-medium text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Ver página
                </Link>
                <button
                  onClick={() => handleCopyUrl(industry.slug)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm"
                  title="Copiar URL completa"
                >
                  {copiedUrl === industry.slug ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Help section */}
      <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">¿Cómo usar las Landing Pages?</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Comparte las URLs en campañas de Google Ads segmentadas por industria</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Usa las páginas para SEO orgánico con keywords específicos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Incluye los links en tus mensajes de WhatsApp a prospectos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Los formularios de contacto crean leads automáticamente en el Pipeline</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
