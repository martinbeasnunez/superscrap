'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Cargar KanbanBoard dinámicamente para evitar problemas de SSR con drag-drop
const KanbanBoard = dynamic(() => import('@/components/kanban/KanbanBoard'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-gray-500">Cargando pipeline...</p>
      </div>
    </div>
  ),
});

export default function SeguimientoPage() {
  const [showTips, setShowTips] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Pipeline de Ventas
            </h1>
            <p className="text-gray-500 mt-0.5 text-sm">Arrastra leads entre etapas o haz click para ver detalles</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/busquedas"
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
            >
              Ver estadisticas
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Nueva busqueda
            </Link>
          </div>
        </div>

        {/* Tips colapsables */}
        <div className="mb-4">
          <button
            onClick={() => setShowTips(!showTips)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showTips ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            {showTips ? 'Ocultar guia' : 'Ver guia del pipeline'}
          </button>

          {showTips && (
            <div className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <div className="grid md:grid-cols-4 gap-3 text-sm mb-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">📋</span>
                  <div>
                    <p className="font-medium text-gray-800">Nuevos</p>
                    <p className="text-gray-600 text-xs">Sin contactar. Haz el primer contacto!</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">💬</span>
                  <div>
                    <p className="font-medium text-blue-700">1er Contacto</p>
                    <p className="text-gray-600 text-xs">Contactados hace 0-2 días</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">⏰</span>
                  <div>
                    <p className="font-medium text-orange-700">Seguimiento 1</p>
                    <p className="text-gray-600 text-xs">3-5 días sin respuesta. Haz follow-up!</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">🔥</span>
                  <div>
                    <p className="font-medium text-red-700">Seguimiento 2</p>
                    <p className="text-gray-600 text-xs">6+ días. URGENTE - actúa hoy!</p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-lg">⭐</span>
                  <div>
                    <p className="font-medium text-amber-700">Interesados</p>
                    <p className="text-gray-600 text-xs">Respondieron con interés</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">💰</span>
                  <div>
                    <p className="font-medium text-purple-700">Cotizados</p>
                    <p className="text-gray-600 text-xs">Tienen cotización. Cierra!</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">🎉</span>
                  <div>
                    <p className="font-medium text-green-700">Clientes</p>
                    <p className="text-gray-600 text-xs">¡Venta cerrada!</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">❌</span>
                  <div>
                    <p className="font-medium text-gray-500">Perdidos</p>
                    <p className="text-gray-600 text-xs">No interesados</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-gray-700 font-medium mb-2">🎯 LA CLAVE DEL ÉXITO: El seguimiento</p>
                <div className="grid md:grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="bg-white/50 rounded p-2">
                    <span className="font-medium text-orange-700">80% de ventas</span> requieren 5+ follow-ups
                  </div>
                  <div className="bg-white/50 rounded p-2">
                    <span className="font-medium text-red-700">44% de vendedores</span> se rinden después de 1 contacto
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Kanban Board */}
        <KanbanBoard />
      </div>
    </div>
  );
}
