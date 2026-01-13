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
            {/* Objetivo */}
            <div className="bg-blue-50 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-2">Objetivo</h3>
              <p className="text-sm text-blue-800">
                Encontrar negocios que usen textiles en sus operaciones diarias
                (toallas, sábanas, manteles, uniformes) y contactarlos para
                ofrecer el servicio de GetLavado.
              </p>
            </div>

            {/* Cómo funciona */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Cómo funciona</h3>
              <ol className="text-sm text-gray-700 space-y-2">
                <li className="flex gap-2">
                  <span className="font-medium text-gray-500">1.</span>
                  <span>Buscamos negocios en Google Maps según tu criterio</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-500">2.</span>
                  <span>Analizamos cada negocio para ver si usa los servicios textiles que buscas</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-500">3.</span>
                  <span>Extraemos emails y teléfonos de sus sitios web</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-500">4.</span>
                  <span>Te mostramos los negocios ordenados por potencial</span>
                </li>
              </ol>
            </div>

            {/* Ejemplos de búsquedas efectivas */}
            <div className="bg-green-50 rounded-xl p-6">
              <h3 className="font-semibold text-green-900 mb-3">Búsquedas efectivas</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-white rounded-lg p-3">
                  <p className="font-medium text-green-800">Clínicas y hospitales</p>
                  <p className="text-green-700 text-xs mt-1">
                    Tipo: &quot;clínicas privadas&quot; → Servicios: sábanas, batas, toallas
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="font-medium text-green-800">Hoteles boutique</p>
                  <p className="text-green-700 text-xs mt-1">
                    Tipo: &quot;hoteles 4 estrellas&quot; → Servicios: sábanas, toallas, albornoces
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="font-medium text-green-800">Spas y salones</p>
                  <p className="text-green-700 text-xs mt-1">
                    Tipo: &quot;spa masajes&quot; → Servicios: toallas, batas, sábanas
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="font-medium text-green-800">Restaurantes premium</p>
                  <p className="text-green-700 text-xs mt-1">
                    Tipo: &quot;restaurantes miraflores&quot; → Servicios: manteles, servilletas, uniformes
                  </p>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-amber-50 rounded-xl p-6">
              <h3 className="font-semibold text-amber-900 mb-3">Tips</h3>
              <ul className="text-sm text-amber-800 space-y-2">
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Sé específico en el tipo de negocio (mejor &quot;clínicas dermatológicas&quot; que solo &quot;clínicas&quot;)</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Los negocios con sitio web tienen más probabilidad de tener contacto directo</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Enfócate en distritos premium: Miraflores, San Isidro, Surco, San Borja</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Usa el botón de WhatsApp para contactar celulares directamente</span>
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
