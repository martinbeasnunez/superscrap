'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface AddManualLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type Tier = 'orca' | 'delfin' | 'unknown';

export default function AddManualLeadModal({ isOpen, onClose, onCreated }: AddManualLeadModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [tier, setTier] = useState<Tier>('orca');
  const [revenueMin, setRevenueMin] = useState('');
  const [revenueMax, setRevenueMax] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const reset = () => {
    setName(''); setPhone(''); setAddress('');
    setTier('orca'); setRevenueMin(''); setRevenueMax('');
    setNotes(''); setError('');
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/leads/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          tier,
          estimated_revenue_min: revenueMin ? parseInt(revenueMin, 10) : undefined,
          estimated_revenue_max: revenueMax ? parseInt(revenueMax, 10) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('manual.error'));
      }
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('manual.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">{t('manual.title')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('manual.subtitle')}</p>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('manual.name')} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('manual.name_placeholder')}
                required
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('manual.phone')} *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('manual.phone_placeholder')}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('manual.address')}
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('manual.tier')}
              </label>
              <div className="flex gap-2">
                {(['orca', 'delfin', 'unknown'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTier(v)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      tier === v
                        ? v === 'orca'
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : v === 'delfin'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-gray-100 text-gray-700 border-gray-300'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {t(`manual.tier_${v}`)}
                  </button>
                ))}
              </div>
            </div>

            {tier !== 'unknown' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t('manual.revenue_min')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={revenueMin}
                    onChange={(e) => setRevenueMin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t('manual.revenue_max')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={revenueMax}
                    onChange={(e) => setRevenueMax(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('manual.notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('manual.notes_placeholder')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {t('manual.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !phone.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('manual.saving') : t('manual.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
