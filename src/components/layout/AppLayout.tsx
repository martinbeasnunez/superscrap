'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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

export default function AppLayout({ children }: AppLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
      router.push('/seguimiento');
    }} />;
  }

  // Layout con sidebar para usuarios autenticados
  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <Sidebar />
      <main className="ml-64 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
