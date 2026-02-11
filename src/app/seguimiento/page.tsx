'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Cargar KanbanBoard dinámicamente para evitar problemas de SSR con drag-drop
const KanbanBoard = dynamic(() => import('@/components/kanban/KanbanBoard'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin h-10 w-10 border-3 border-[#F6653C] border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-gray-500">Cargando pipeline...</p>
      </div>
    </div>
  ),
});

interface QuickStats {
  newLeads: number;
  followUpNeeded: number;
  interested: number;
  quoted: number;
}

export default function PipelinePage() {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    // Fetch quick stats
    async function fetchStats() {
      try {
        const res = await fetch('/api/kanban');
        const data = await res.json();

        if (data.columns) {
          setStats({
            newLeads: data.columns.find((c: { id: string }) => c.id === 'new')?.leads?.length || 0,
            followUpNeeded:
              (data.columns.find((c: { id: string }) => c.id === 'follow_up_1')?.leads?.length || 0) +
              (data.columns.find((c: { id: string }) => c.id === 'follow_up_2')?.leads?.length || 0),
            interested: data.columns.find((c: { id: string }) => c.id === 'interested')?.leads?.length || 0,
            quoted: data.columns.find((c: { id: string }) => c.id === 'quoted')?.leads?.length || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline de Ventas</h1>
          <p className="text-gray-500 mt-0.5">Gestiona tus leads y cierra más ventas</p>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-6 bg-white rounded-xl px-6 py-3 shadow-sm border border-gray-100">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{stats.newLeads}</p>
                <p className="text-xs text-gray-500">Nuevos</p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">{stats.followUpNeeded}</p>
                <p className="text-xs text-gray-500">Follow-up</p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-500">{stats.interested}</p>
                <p className="text-xs text-gray-500">Interesados</p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-500">{stats.quoted}</p>
                <p className="text-xs text-gray-500">Cotizados</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tips collapsible */}
      <div className="mb-4">
        <button
          onClick={() => setShowTips(!showTips)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showTips ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          {showTips ? 'Ocultar guía' : 'Ver guía del pipeline'}
        </button>

        {showTips && (
          <div className="mt-3 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="grid md:grid-cols-4 gap-4 text-sm mb-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <span className="text-xl">📋</span>
                <div>
                  <p className="font-medium text-gray-900">Nuevos</p>
                  <p className="text-gray-500 text-xs">Sin contactar. ¡Haz el primer contacto!</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                <span className="text-xl">💬</span>
                <div>
                  <p className="font-medium text-blue-700">1er Contacto</p>
                  <p className="text-gray-500 text-xs">Contactados hace 0-2 días</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl">
                <span className="text-xl">⏰</span>
                <div>
                  <p className="font-medium text-orange-700">Seguimiento</p>
                  <p className="text-gray-500 text-xs">3+ días sin respuesta</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl">
                <span className="text-xl">⭐</span>
                <div>
                  <p className="font-medium text-amber-700">Interesados</p>
                  <p className="text-gray-500 text-xs">Respondieron con interés</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
              <div className="text-3xl">🎯</div>
              <div>
                <p className="font-semibold text-emerald-800">La clave del éxito: El seguimiento</p>
                <p className="text-sm text-emerald-700 mt-1">
                  <strong>80% de ventas</strong> requieren 5+ follow-ups. Solo <strong>44% de vendedores</strong> hacen más de 1 contacto.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-x-auto">
        <KanbanBoard />
      </div>
    </div>
  );
}
