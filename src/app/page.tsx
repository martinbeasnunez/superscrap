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
            {/* Por qué usar esto vs Google */}
            <div className="bg-blue-50 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-2">Esto NO es Google</h3>
              <p className="text-sm text-blue-800 mb-3">
                Google te da una lista. SuperScrap te da <strong>leads calificados listos para contactar</strong>:
              </p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li className="flex gap-2">
                  <span className="text-blue-500">+</span>
                  <span>Analiza si <strong>realmente usan</strong> los textiles que buscas</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">+</span>
                  <span>Extrae emails y celulares de sus webs (no solo el telefono de Google)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">+</span>
                  <span>Genera mensaje de WhatsApp personalizado por industria</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500">+</span>
                  <span>Ordena por % de match para priorizar los mejores</span>
                </li>
              </ul>
            </div>

            {/* Cómo aprovecharlo */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Como aprovecharlo</h3>
              <ol className="text-sm text-gray-700 space-y-2">
                <li className="flex gap-2">
                  <span className="font-medium text-gray-500">1.</span>
                  <span><strong>Se especifico:</strong> &quot;spa con piscina&quot; en vez de solo &quot;spa&quot;</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-500">2.</span>
                  <span><strong>Piensa en nichos:</strong> &quot;hostales en Barranco&quot;, &quot;clinicas esteticas&quot;</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-500">3.</span>
                  <span><strong>Filtra por nivel:</strong> &quot;hoteles 5 estrellas&quot; vs &quot;hoteles 3 estrellas&quot;</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-500">4.</span>
                  <span><strong>Contacta rapido:</strong> usa el boton de WhatsApp con mensaje listo</span>
                </li>
              </ol>
            </div>

            {/* Industrias que funcionan bien */}
            <div className="bg-green-50 rounded-xl p-6">
              <h3 className="font-semibold text-green-900 mb-3">Funciona bien para</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-green-800"><strong>Hoteles/Hostales</strong> - publican que tienen habitaciones</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-green-800"><strong>Spas/Saunas</strong> - mencionan toallas y batas</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-green-800"><strong>Clinicas/Hospitales</strong> - info de servicios en web</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-green-800"><strong>Restaurantes premium</strong> - fotos con manteles</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-green-800"><strong>Gimnasios/Clubs</strong> - mencionan amenities</span>
                </div>
              </div>
            </div>

            {/* Directorio Industrial */}
            <div className="bg-orange-50 rounded-xl p-6">
              <h3 className="font-semibold text-orange-900 mb-3">Directorio Industrial</h3>
              <p className="text-sm text-orange-800 mb-2">
                Usa el boton &quot;Directorio Industrial&quot; para buscar:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                  <span className="text-orange-500">🏭</span>
                  <span className="text-orange-800"><strong>Fabricas de uniformes</strong></span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                  <span className="text-orange-500">🏭</span>
                  <span className="text-orange-800"><strong>Confecciones industriales</strong></span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                  <span className="text-orange-500">🏭</span>
                  <span className="text-orange-800"><strong>Talleres de costura</strong></span>
                </div>
              </div>
              <p className="text-xs text-orange-700 mt-3">
                Busca en Paginas Amarillas Peru con emails y telefonos directos
              </p>
            </div>

            {/* Tips */}
            <div className="bg-amber-50 rounded-xl p-6">
              <h3 className="font-semibold text-amber-900 mb-3">Tips</h3>
              <ul className="text-sm text-amber-800 space-y-2">
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Incluye el nivel o categoría: &quot;hotel 5 estrellas&quot; encuentra diferentes resultados que &quot;hotel 3 estrellas&quot;</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Usa palabras como &quot;premium&quot;, &quot;de lujo&quot;, &quot;boutique&quot; para filtrar por calidad</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Sé específico: &quot;clínica dermatológica&quot; es mejor que solo &quot;clínica&quot;</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Enfócate en distritos premium: Miraflores, San Isidro, Surco, San Borja</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Negocios con sitio web tienen más probabilidad de tener contacto directo</span>
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
