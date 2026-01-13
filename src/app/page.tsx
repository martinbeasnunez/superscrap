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

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">SuperScrap</h1>
          <p className="text-lg text-gray-600">
            Encuentra negocios con necesidades de lavandería industrial
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <SearchForm userId={user.id} />
        </div>

        <div className="text-center mt-6">
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
