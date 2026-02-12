'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface LoginFormProps {
  onLogin: (user: { id: string; name: string; email: string }) => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError(t('login.name_required'));
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError(t('login.email_invalid'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('login.login_error'));
      }

      // Guardar en localStorage
      localStorage.setItem('superscrap_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.unknown_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#1C2026]">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0890F1] to-[#3AA8F5] p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-bold text-lg text-white">
              SS
            </div>
            <span className="font-bold text-xl text-white">SuperScrap</span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4">
            {t('login.crm_title')}
          </h1>
          <p className="text-white/80 text-lg max-w-md">
            {t('login.crm_desc')}
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">{t('login.smart_search')}</p>
              <p className="text-white/70 text-sm">{t('login.smart_search_desc')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">{t('login.pipeline')}</p>
              <p className="text-white/70 text-sm">{t('login.pipeline_desc')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">{t('login.metrics')}</p>
              <p className="text-white/70 text-sm">{t('login.metrics_desc')}</p>
            </div>
          </div>
        </div>

        <p className="text-white/50 text-sm">
          {t('login.copyright')}
        </p>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-[#0890F1] to-[#3AA8F5] rounded-xl flex items-center justify-center font-bold text-lg text-white">
              SS
            </div>
            <span className="font-bold text-xl text-white">SuperScrap</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">{t('login.welcome')}</h2>
            <p className="text-gray-400">{t('login.enter_to_continue')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('login.name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('login.name_placeholder')}
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-[#0890F1] focus:border-transparent transition-all"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('login.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-[#0890F1] focus:border-transparent transition-all"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#0890F1] text-white font-medium rounded-xl hover:bg-[#0770C5] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  {t('login.logging_in')}
                </>
              ) : (
                <>
                  {t('login.login')}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
