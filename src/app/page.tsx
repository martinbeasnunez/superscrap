'use client';

import { useState, useEffect } from 'react';
import SearchForm from '@/components/SearchForm';
import LoginForm from '@/components/LoginForm';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay usuario en localStorage
    const savedUser = localStorage.getItem('superscrap_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('superscrap_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('superscrap_user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con usuario */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <span className="text-sm text-gray-600">
            Hola, <span className="font-medium text-gray-900">{user.name}</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">SuperScrap</h1>
          <p className="text-lg text-gray-600">
            Encuentra negocios con necesidades de lavandería industrial
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Formulario */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <SearchForm userId={user.id} />
          </div>

          {/* Guía de uso */}
          <div className="space-y-6">
            {/* Qué textiles necesita cada industria */}
            <div className="bg-blue-50 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-3">Que necesita cada industria</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span className="text-blue-800"><strong>Hoteles/Hostales:</strong> sabanas, toallas, batas</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span className="text-blue-800"><strong>Spas/Gimnasios:</strong> toallas, batas</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span className="text-blue-800"><strong>Restaurantes:</strong> manteles, servilletas, uniformes</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span className="text-blue-800"><strong>Clinicas:</strong> sabanas, batas medicas, uniformes</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span className="text-blue-800"><strong>Seguridad/Limpieza:</strong> uniformes en volumen</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span className="text-blue-800"><strong>Fabricas/Mineras:</strong> overoles, uniformes</span>
                </div>
              </div>
            </div>

            {/* Google Maps vs Directorio */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Cuando usar cada fuente</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-800 mb-1">Google Maps</p>
                  <p className="text-gray-600">Hoteles, spas, restaurantes, clinicas, gimnasios - negocios con local fisico que atienden clientes.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-800 mb-1">Directorio Industrial</p>
                  <p className="text-gray-600">Empresas de seguridad, limpieza, transporte, fabricas - empresas B2B con empleados uniformados.</p>
                </div>
              </div>
            </div>

            {/* Tips rapidos */}
            <div className="bg-green-50 rounded-xl p-6">
              <h3 className="font-semibold text-green-900 mb-3">Tips</h3>
              <ul className="text-sm text-green-800 space-y-2">
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Usa las sugerencias de abajo del buscador</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Agrega nivel: &quot;hotel 5 estrellas&quot; vs &quot;hotel 3 estrellas&quot;</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Prioriza negocios con % alto de match</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Usa el boton de WhatsApp - ya tiene mensaje listo</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/busquedas"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Ver búsquedas anteriores →
          </Link>
        </div>
      </div>
    </div>
  );
}
