'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useI18n, LanguageSelector } from '@/lib/i18n';

interface User {
  id: string;
  name: string;
  email: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const { t } = useI18n();

  const navigation = [
    {
      name: t('nav.home'),
      href: '/estadisticas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      badge: null,
    },
    {
      name: t('nav.pipeline'),
      href: '/seguimiento',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      ),
      badge: null,
    },
    {
      name: t('nav.search'),
      href: '/buscar',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      badge: null,
    },
    {
      name: t('nav.history'),
      href: '/historial',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      badge: null,
    },
    {
      name: t('nav.landings'),
      href: '/landings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
      badge: null,
    },
  ];

  useEffect(() => {
    const savedUser = localStorage.getItem('orbit_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // ignore
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('orbit_user');
    window.location.href = '/login';
  };

  // Check if current path matches or starts with nav item href
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen bg-[#1C2026] text-white flex flex-col z-50
          transition-transform duration-300 ease-in-out
          w-64
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-14 lg:h-16 flex items-center justify-between px-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0890F1] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 100 100" fill="white">
                <path d="M50 10 C35 10, 10 25, 10 50 C10 75, 30 95, 50 95 C70 95, 90 75, 90 50 C90 25, 65 10, 50 10 Z M50 20 C42 20, 25 18, 20 40 C18 50, 25 65, 50 85 C75 65, 82 50, 80 40 C75 18, 58 20, 50 20 Z"/>
              </svg>
            </div>
            <span className="font-semibold text-lg">ORBIT</span>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quick action */}
        <div className="p-4">
          <Link
            href="/buscar"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#0890F1] hover:bg-[#0770C5] text-white rounded-lg font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('nav.new_search')}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  active
                    ? 'bg-[#0890F1]/20 text-[#0890F1]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="flex-1 font-medium">{item.name}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 bg-[#0890F1] text-white text-xs rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Language selector */}
        <div className="px-4 py-2 border-t border-white/10">
          <LanguageSelector className="justify-center" />
        </div>

        {/* User section */}
        <div className="border-t border-white/10 p-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center font-medium text-sm flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <button
                  onClick={handleLogout}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {t('nav.logout')}
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>{t('nav.login')}</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
