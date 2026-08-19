'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

// ── Actividad por día: nuevos vs follows (últimos 14 días) ────────────────────
interface Vendedor { id: string; name: string; }
interface ActividadResp {
  porDiaNuevoFollow: Record<string, { nuevos: number; follows: number }>;
  vendedores: Vendedor[];
}

/** Hoy en Lima (YYYY-MM-DD). */
function limaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}
/** Los últimos n días de Lima como YYYY-MM-DD (más viejo → más nuevo). */
function lastNDays(n: number): string[] {
  const [y, m, d] = limaToday().split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(base - i * 86400000).toISOString().slice(0, 10));
  return out;
}
function dayLabel(iso: string): string {
  const [, mm, dd] = iso.split('-');
  return `${dd}/${mm}`;
}
function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 || wd === 6;
}

export default function DailyActivity() {
  const { t } = useI18n();
  const [sel, setSel] = useState<string>('all'); // 'all' = equipo, o userId
  const [data, setData] = useState<ActividadResp | null>(null);
  const [loading, setLoading] = useState(true);

  const dias = lastNDays(14);
  const desde = `${dias[0]}T00:00:00-05:00`; // medianoche Lima del día más viejo

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ desde });
    if (sel !== 'all') qs.set('userId', sel);
    fetch(`/api/mi-actividad?${qs.toString()}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then((d: ActividadResp) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    // desde cambia solo con el día; sel es la dependencia real.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const porDia = data?.porDiaNuevoFollow ?? {};
  const serie = dias.map(iso => ({
    iso,
    nuevos: porDia[iso]?.nuevos ?? 0,
    follows: porDia[iso]?.follows ?? 0,
  }));
  const max = Math.max(1, ...serie.map(s => s.nuevos + s.follows));
  const totalNuevos = serie.reduce((a, s) => a + s.nuevos, 0);
  const totalFollows = serie.reduce((a, s) => a + s.follows, 0);
  const hoyIso = limaToday();
  const hoy = porDia[hoyIso] ?? { nuevos: 0, follows: 0 };
  const semana = serie.slice(-7);
  const semNuevos = semana.reduce((a, s) => a + s.nuevos, 0);
  const semFollows = semana.reduce((a, s) => a + s.follows, 0);
  const CHART_H = 120;

  return (
    <div>
      <h3 className="font-bold text-sm text-gray-900 mb-1">📅 {t('insights.activity_title')}</h3>
      <p className="text-xs text-gray-500 mb-2">{t('insights.activity_subtitle')}</p>

      {/* Titular claro: HOY (grande) + esta semana */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
        <span className="text-base font-bold text-gray-900">
          {t('insights.activity_today')}:{' '}
          <span className="text-emerald-600">{hoy.nuevos}</span>
          <span className="text-xs font-medium text-gray-500"> {t('insights.activity_new').toLowerCase()}</span>
          <span className="text-gray-300"> · </span>
          <span className="text-blue-500">{hoy.follows}</span>
          <span className="text-xs font-medium text-gray-500"> {t('insights.activity_follow').toLowerCase()}</span>
        </span>
        <span className="text-[11px] sm:text-xs text-gray-500">
          {t('insights.activity_week')}: <strong className="text-emerald-600">{semNuevos}</strong>
          <span className="text-gray-300"> / </span>
          <strong className="text-blue-500">{semFollows}</strong>
        </span>
      </div>

      {/* Selector de vendedor + leyenda (total 14 días) */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSel('all')}
            className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium transition-colors ${
              sel === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('insights.activity_team')}
          </button>
          {(data?.vendedores ?? []).map(v => (
            <button
              key={v.id}
              onClick={() => setSel(v.id)}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium transition-colors ${
                sel === v.id ? 'bg-[#0890F1] text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
          <span className="text-gray-400">{t('insights.activity_range14')}:</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            {t('insights.activity_new')} <strong>{totalNuevos}</strong>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-400" />
            {t('insights.activity_follow')} <strong>{totalFollows}</strong>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center text-xs text-gray-400">{t('insights.loading')}</div>
      ) : totalNuevos + totalFollows === 0 ? (
        <div className="text-xs text-gray-400 italic py-6 text-center">{t('insights.activity_no_data')}</div>
      ) : (
        <>
          {/* Barras apiladas: follows abajo (azul), nuevos arriba (verde) */}
          <div className="flex gap-0.5 sm:gap-1 border-b border-gray-200" style={{ height: `${CHART_H}px` }}>
            {serie.map(s => {
              const total = s.nuevos + s.follows;
              const totalPx = Math.round((total / max) * CHART_H);
              const followsPx = total > 0 ? Math.round((s.follows / total) * totalPx) : 0;
              const nuevosPx = totalPx - followsPx;
              const weekend = isWeekend(s.iso);
              return (
                <div
                  key={s.iso}
                  className={`flex-1 min-w-0 relative group ${weekend ? 'opacity-60' : ''} ${s.iso === hoyIso ? 'bg-amber-50 ring-1 ring-amber-300 rounded-t' : ''}`}
                  title={`${dayLabel(s.iso)} — ${t('insights.activity_new')} ${s.nuevos} · ${t('insights.activity_follow')} ${s.follows}`}
                  style={{ height: `${CHART_H}px` }}
                >
                  {totalPx > 0 && (
                    <div className="absolute left-0 right-0 bottom-0 flex flex-col rounded-t-sm overflow-hidden" style={{ height: `${totalPx}px` }}>
                      {nuevosPx > 0 && <div className="bg-emerald-500" style={{ height: `${nuevosPx}px` }} />}
                      {followsPx > 0 && <div className="bg-blue-400" style={{ height: `${followsPx}px` }} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Etiquetas X: 1 de cada 2 para que no se apelotonen en móvil */}
          <div className="flex gap-0.5 sm:gap-1 mt-1 text-[9px] text-gray-400">
            {serie.map((s, i) => (
              <div key={s.iso} className="flex-1 text-center min-w-0 truncate">
                {i % 2 === 0 || i === serie.length - 1 ? dayLabel(s.iso) : ''}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
