'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from './Sidebar';
import LoginForm from '../LoginForm';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
}

// Rutas públicas que no requieren autenticación (landing pages para SEO)
// /landing/[industria] es público, pero /landings (gestión) requiere auth
const isPublicLandingPage = (path: string) => {
  // Solo las landing pages públicas: /landing, /landing/hoteles, etc.
  // NO incluye /landings (con s) que es la página de gestión
  return path === '/landing' || (path.startsWith('/landing/') && !path.startsWith('/landings'));
};

// Títulos de página según la ruta
const getPageTitle = (pathname: string) => {
  if (pathname === '/estadisticas' || pathname === '/') return 'Home';
  if (pathname === '/seguimiento') return 'Pipeline';
  if (pathname === '/buscar') return 'Buscar';
  if (pathname === '/historial') return 'Historial';
  if (pathname === '/landings') return 'Landings';
  return 'SuperScrap';
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Verificar si es una ruta pública
  const isPublicRoute = pathname === '/login' || isPublicLandingPage(pathname);

  useEffect(() => {
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

  // Cerrar sidebar cuando cambia la ruta
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F6653C]"></div>
      </div>
    );
  }

  // Rutas públicas (landings) - mostrar sin layout
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Si no hay usuario, mostrar login
  if (!user) {
    return <LoginForm onLogin={(u) => {
      setUser(u);
      router.push('/estadisticas');
    }} />;
  }

  // Layout con sidebar para usuarios autenticados
  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30 lg:hidden">
        {/* Menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Page title */}
        <h1 className="font-semibold text-gray-900">{getPageTitle(pathname)}</h1>

        {/* User avatar or action */}
        <Link
          href="/buscar"
          className="p-2 -mr-2 text-[#F6653C] hover:bg-orange-50 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Link>
      </header>

      {/* Main content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen transition-all duration-300">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around py-2 z-30 lg:hidden safe-area-bottom">
        <Link
          href="/estadisticas"
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
            pathname === '/estadisticas' || pathname === '/'
              ? 'text-[#F6653C]'
              : 'text-gray-500'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs font-medium">Home</span>
        </Link>

        <Link
          href="/seguimiento"
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
            pathname === '/seguimiento'
              ? 'text-[#F6653C]'
              : 'text-gray-500'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <span className="text-xs font-medium">Pipeline</span>
        </Link>

        <Link
          href="/buscar"
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
            pathname === '/buscar'
              ? 'text-[#F6653C]'
              : 'text-gray-500'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs font-medium">Buscar</span>
        </Link>

        <Link
          href="/historial"
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
            pathname === '/historial'
              ? 'text-[#F6653C]'
              : 'text-gray-500'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium">Historial</span>
        </Link>
      </nav>
    </div>
  );
}
