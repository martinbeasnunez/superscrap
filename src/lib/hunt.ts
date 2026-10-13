import { supabase } from '@/lib/supabase';
import { normalizePhone } from '@/lib/dedup';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Caza diaria: piezas compartidas por /api/hunt/* (foto, cazar, guardar, decidir).
// El criterio (qué apuestas cazar hoy, cuáles 10 valen la pena) lo pone la rutina
// agéntica; aquí vive solo lo determinístico.

// Tope diario. La cuota real baja según lo que quedó sin decidir / sin tocar.
export const HUNT_MAX_PER_DAY = 10;

export type HuntRoute = 'humano' | 'bot';
export type HuntDecision = 'humano' | 'bot' | 'descartado';

// Cuenta "grande" = Martín la trabaja en persona (mismo corte que scripts/orcas-parte.mjs).
export const GRANDE_REV = 5000;

const LIMA_DISTRICTS = [
  'miraflores', 'san isidro', 'barranco', 'santiago de surco', 'surco', 'san borja', 'la molina',
  'san miguel', 'magdalena', 'pueblo libre', 'jesus maria', 'jesús maría', 'lince', 'surquillo',
  'chorrillos', 'la victoria', 'breña', 'cercado de lima', 'callao', 'los olivos',
  'san martin de porres', 'san martín de porres', 'independencia', 'comas', 'ate', 'santa anita',
  'san juan de lurigancho', 'san juan de miraflores', 'villa el salvador', 'villa maria del triunfo',
  'lurin', 'lurín', 'punta hermosa', 'asia', 'chaclacayo', 'cieneguilla', 'rimac', 'rímac', 'san luis',
];
const DISTRICT_ALIAS: Record<string, string> = {
  'santiago de surco': 'surco', 'jesús maría': 'jesus maria', 'san martín de porres': 'san martin de porres',
  'lurín': 'lurin', 'rímac': 'rimac',
};

export function districtOf(address: string | null | undefined): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  const hit = LIMA_DISTRICTS.find((d) => lower.includes(d));
  return hit ? (DISTRICT_ALIAS[hit] || hit) : null;
}

// El bot (Kapso) solo puede escribir a celulares.
export function isMobilePhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const c = phone.replace(/\D/g, '');
  return (c.length === 9 && c.startsWith('9')) || (c.startsWith('519') && c.length >= 11);
}

// Hoy en Lima (UTC-5, sin horario de verano) como YYYY-MM-DD.
export function limaToday(): string {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

// Supabase corta en 1000 filas.
export async function fetchAll<T = any>(
  make: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>,
): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await make(page * size, page * size + size - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < size) break;
  }
  return rows;
}

// La migración 019 se corre a mano: mientras no exista la tabla, el módulo responde vacío
// en vez de romper el Pipeline.
export function isMissingHuntTables(error: any): boolean {
  const msg = `${error?.code || ''} ${error?.message || ''}`;
  return /42P01|PGRST205|hunt_(leads|runs)/i.test(msg);
}

// ---- Dedup en memoria (mismas reglas que findExistingBusiness, pero una sola lectura
// de la tabla para toda la corrida en vez de una por candidato) ----
export interface DedupIndex {
  byExternalId: Map<string, string>;
  byPhone: Map<string, string>;
  byNameAddress: Map<string, string>;
}

const nameAddressKey = (name: string, address: string) =>
  `${name.toLowerCase().trim()}|${address.toLowerCase().trim()}`;

export async function loadDedupIndex(): Promise<DedupIndex> {
  const rows = await fetchAll((from, to) =>
    supabase.from('businesses').select('id, external_id, phone, name, address').range(from, to));
  const idx: DedupIndex = { byExternalId: new Map(), byPhone: new Map(), byNameAddress: new Map() };
  for (const b of rows) {
    if (b.external_id && !String(b.external_id).startsWith('pa-')) idx.byExternalId.set(b.external_id, b.id);
    const p = normalizePhone(b.phone);
    if (p && p.length >= 7) idx.byPhone.set(p, b.id);
    if (b.name && b.address) idx.byNameAddress.set(nameAddressKey(b.name, b.address), b.id);
  }
  return idx;
}

// Suma un negocio recién guardado al índice, para que la misma corrida no lo duplique.
export function addToIndex(
  idx: DedupIndex,
  id: string,
  c: { place_id?: string | null; phone?: string | null; name: string; address?: string | null },
): void {
  if (c.place_id && !c.place_id.startsWith('pa-')) idx.byExternalId.set(c.place_id, id);
  const p = normalizePhone(c.phone);
  if (p && p.length >= 7) idx.byPhone.set(p, id);
  if (c.name && c.address) idx.byNameAddress.set(nameAddressKey(c.name, c.address), id);
}

export function findInIndex(
  idx: DedupIndex,
  c: { place_id?: string | null; phone?: string | null; name: string; address?: string | null },
): string | null {
  if (c.place_id && idx.byExternalId.has(c.place_id)) return idx.byExternalId.get(c.place_id)!;
  const p = normalizePhone(c.phone);
  if (p && p.length >= 7 && idx.byPhone.has(p)) return idx.byPhone.get(p)!;
  if (c.name && c.address) {
    const hit = idx.byNameAddress.get(nameAddressKey(c.name, c.address));
    if (hit) return hit;
  }
  return null;
}

// ---- Cuota del día: hasta 10, menos lo que ya está en cola ----
// pendientes     = propuestos y nadie decidió todavía
// tomadosSinTocar = alguien dijo "lo tomo yo" y aún no hay ni un mensaje registrado
export interface HuntCapacity {
  max: number;
  pendientes: number;
  tomadosSinTocar: number;
  quota: number;
}

export async function getHuntCapacity(): Promise<HuntCapacity> {
  const empty: HuntCapacity = { max: HUNT_MAX_PER_DAY, pendientes: 0, tomadosSinTocar: 0, quota: HUNT_MAX_PER_DAY };

  const { data: open, error } = await supabase
    .from('hunt_leads')
    .select('business_id, decision')
    .or('decision.is.null,decision.eq.humano');
  if (error) {
    if (isMissingHuntTables(error)) return empty;
    throw error;
  }

  const pendientes = (open || []).filter((h) => !h.decision).length;
  const takenIds = (open || []).filter((h) => h.decision === 'humano').map((h) => h.business_id);

  let tomadosSinTocar = 0;
  for (let i = 0; i < takenIds.length; i += 150) {
    const chunk = takenIds.slice(i, i + 150);
    const [{ data: biz }, { data: hist }] = await Promise.all([
      supabase.from('businesses').select('id, sales_stage').in('id', chunk),
      supabase.from('contact_history').select('business_id, action_type').in('business_id', chunk),
    ]);
    const worked = new Set(
      (hist || []).filter((e) => e.action_type !== 'note' && e.action_type !== 'stage_change').map((e) => e.business_id),
    );
    tomadosSinTocar += (biz || []).filter(
      (b) => (!b.sales_stage || b.sales_stage === 'nuevo') && !worked.has(b.id),
    ).length;
  }

  return {
    max: HUNT_MAX_PER_DAY,
    pendientes,
    tomadosSinTocar,
    quota: Math.max(0, HUNT_MAX_PER_DAY - pendientes - tomadosSinTocar),
  };
}
