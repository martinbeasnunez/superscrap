// Reactivación B2B — Misión 2, campaña de SETIEMBRE 2026.
// Capa de olas/timeline ENCIMA del módulo. Todo se DERIVA de los datos reales
// (tier, prioridad, list_type, fechas de toque) — no hay columnas nuevas.
//
// Principio rector: front-load por recencia. Los frescos (Tier A, prioridad Alta)
// se tocan primero para que tengan el mes completo para volver a pedir.

import type { ReactClient } from './reactivation';

export interface CampaignWave {
  n: 1 | 2 | 3 | 4;
  name: string;
  start: string;      // YYYY-MM-DD (martes)
  end: string;        // YYYY-MM-DD (jueves) — deadline del 1er toque de la ola
  checkpoint?: string; // viernes
  focus: string;
}

export const CAMPAIGN = {
  name: 'Reactivación B2B · Setiembre 2026',
  start: '2026-09-09',
  end: '2026-09-30',
  discountStart: 10,
  discountMax: 15,
  waves: [
    { n: 1, name: 'Semana 1', start: '2026-09-09', end: '2026-09-11', checkpoint: '2026-09-11', focus: 'Tier A (verificar + llamada) · 1er toque B/C prioridad Alta' },
    { n: 2, name: 'Semana 2', start: '2026-09-16', end: '2026-09-18', checkpoint: '2026-09-18', focus: '1er toque B/C Media · 2do toque a los que no respondieron (S1)' },
    { n: 3, name: 'Semana 3', start: '2026-09-23', end: '2026-09-25', checkpoint: '2026-09-25', focus: '1er toque Baja + Primera recompra · 2do toque (S2)' },
    { n: 4, name: 'Cierre', start: '2026-09-29', end: '2026-09-30', focus: 'Medición del lift y resultados finales' },
  ] as CampaignWave[],
} as const;

export const CHECKPOINTS = ['2026-09-11', '2026-09-18', '2026-09-25'];

// Fecha de hoy (local Lima) como YYYY-MM-DD.
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// Días enteros entre dos ISO (b - a).
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

// Ola asignada a un cliente (1|2|3). Control/excluir → null (no entran a la campaña).
export function waveFor(c: Pick<ReactClient, 'is_control' | 'list_type' | 'tier' | 'priority'>): 1 | 2 | 3 | null {
  if (c.is_control || c.list_type === 'excluir') return null;
  if (c.list_type === 'primera_recompra') return 3;
  if (c.tier === 'A') return 1;
  if (c.priority === 'alta') return 1;
  if (c.priority === 'media') return 2;
  return 3; // fría/baja o sin señal → cola
}

// Fecha objetivo del 1er toque = fin de su ola.
export function targetTouch1(c: Parameters<typeof waveFor>[0]): string | null {
  const w = waveFor(c);
  if (!w) return null;
  return CAMPAIGN.waves.find((x) => x.n === w)?.end ?? null;
}

// Fecha objetivo del 2do toque = fecha del 1er toque + 7 días (solo si no respondió).
export function targetTouch2(c: Pick<ReactClient, 'touch1_date' | 'responded'>): string | null {
  if (!c.touch1_date || c.responded) return null;
  return addDays(c.touch1_date, 7);
}

export type OverdueWhich = 'toque1' | 'toque2' | null;

// ¿Vencido? Pasó la fecha objetivo y sigue sin el toque registrado.
export function overdue(c: ReactClient, today: string): OverdueWhich {
  if (c.is_control || c.list_type === 'excluir') return null;
  // 2do toque vencido (tiene prioridad: es una acción más urgente)
  const t2 = targetTouch2(c);
  if (c.touch1_date && !c.responded && !c.touch2_date && t2 && today > t2) return 'toque2';
  // 1er toque vencido
  const t1 = targetTouch1(c);
  if (!c.touch1_date && t1 && today > t1) return 'toque1';
  return null;
}

// "Hecho" del 1er toque = fecha de toque registrada (data real, nunca hardcode).
export function touch1Done(c: Pick<ReactClient, 'touch1_date'>): boolean {
  return !!c.touch1_date;
}

export type WaveStatus = 'proxima' | 'en_curso' | 'pasada';

export function waveStatus(w: CampaignWave, today: string): WaveStatus {
  if (today < w.start) return 'proxima';
  if (today <= w.end) return 'en_curso';
  return 'pasada';
}

// Ola "actual": la primera cuya fecha fin no pasó todavía (o la de cierre).
export function currentWave(today: string): CampaignWave {
  return CAMPAIGN.waves.find((w) => today <= w.end) ?? CAMPAIGN.waves[CAMPAIGN.waves.length - 1];
}

// Próximo checkpoint (viernes) a partir de hoy.
export function nextCheckpoint(today: string): string | null {
  return CHECKPOINTS.find((c) => c >= today) ?? null;
}

export const WAVE_STATUS_LABEL: Record<WaveStatus, string> = {
  proxima: 'Próxima',
  en_curso: 'En curso',
  pasada: 'Cerrada',
};

// Formato corto de fecha: "11 set".
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
export function fmtShort(iso: string | null): string {
  if (!iso) return '—';
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}
