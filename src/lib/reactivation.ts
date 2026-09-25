// Reactivación B2B — parseo y mapeo de la lista mensual (Excel o texto pegado).
// Una sola fuente de verdad: los headers del Excel se mapean a estos campos.
// Ver migración 013 (tabla reactivation_clients).

export type ReactPriority = 'alta' | 'media' | 'fria';
export type ReactTier = 'A' | 'B' | 'C';
export type ReactChannel = 'whatsapp' | 'call';
export type ReactStatus = 'pendiente' | 'toque1' | 'respondio' | 'reservo' | 'no_reservo';
export type ReactListType = 'reactivacion' | 'primera_recompra' | 'excluir';
// Desenlace de la cuenta (juicio del vendedor sobre la nota, no del sistema):
//   vivo = en juego este mes · octubre = vuelve más adelante · muerto = perdido
export type ReactOutcome = 'vivo' | 'octubre' | 'muerto';

// Fila parseada desde el Excel (solo campos que vienen del import).
export interface ParsedRow {
  company: string;
  phone: string | null;
  phone_norm: string | null;
  last_order_date: string | null; // YYYY-MM-DD
  days_inactive: number | null;
  total_orders: number | null;
  tier: ReactTier | null;
  segment: string | null;
  priority: ReactPriority | null;
  owner: string | null;
  is_control: boolean;
  needs_verify: boolean;
  list_type: ReactListType;
}

// Registro completo tal como vive en la DB (incluye progreso de campaña).
export interface ReactClient extends ParsedRow {
  id: string;
  touch1_date: string | null;
  touch1_channel: ReactChannel | null;
  touch2_date: string | null;
  touch2_channel: ReactChannel | null;
  responded: boolean | null;
  reserved: boolean | null;
  discount_pct: number | null;
  status: ReactStatus;
  notes: string | null;
  contact_name: string | null; // nombre de la persona ({contacto} en plantillas)
  brand: string | null;        // marca en los textos (default "Lavado")
  email: string | null;        // canal alterno si el teléfono está viejo
  verified_at: string | null;  // Tier A: cuándo Joaquín lo verificó (habilita a Fer)
  verified_by: string | null;  // quién verificó
  recontact_date: string | null; // "próximo mes": cuándo volver a contactarlo
  outcome: ReactOutcome | null; // desenlace: vivo / octubre / muerto (o sin marcar)
  updated_at?: string;
}

// Normaliza texto: minúsculas, sin acentos, sin puntuación extra.
export function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Teléfono → solo dígitos (llave de dedup). '' → null.
export function normPhone(p: unknown): string | null {
  const digits = String(p ?? '').replace(/\D/g, '');
  return digits.length ? digits : null;
}

// Fecha en varios formatos → YYYY-MM-DD. Acepta Date, serial Excel, dd/mm/aaaa.
export function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return isoDate(v);
  if (typeof v === 'number') {
    // Serial de Excel (días desde 1899-12-30)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : isoDate(d);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/); // dd/mm/aaaa
  if (m) {
    const [, d, mo, y] = m;
    const yr = y.length === 2 ? `20${y}` : y;
    return `${yr}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // aaaa-mm-dd
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function parsePriority(v: unknown): ReactPriority | null {
  const s = norm(v);
  if (!s) return null;
  if (s.includes('alta')) return 'alta';
  if (s.includes('media')) return 'media';
  if (s.includes('baja') || s.includes('fri')) return 'fria';
  return null;
}

function parseTier(v: unknown): ReactTier | null {
  const s = String(v ?? '');
  const m = s.match(/tier\s*([abc])/i);
  return m ? (m[1].toUpperCase() as ReactTier) : null;
}

function parseInt2(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

// Mapa de campo → lista de alias (normalizados) que puede tener el header.
const HEADER_ALIASES: Record<string, string[]> = {
  company: ['nombre', 'empresa', 'cliente', 'razon social'],
  phone: ['telefono', 'celular', 'whatsapp', 'numero'],
  last_order_date: ['ultima orden', 'ultimo pedido', 'fecha ultima orden', 'ultima compra'],
  days_inactive: ['dias sin pedir', 'dias sin comprar', 'dias inactivo', 'recencia', 'dias'],
  total_orders: ['total pedidos', 'total de pedidos', 'pedidos', 'ordenes', 'total ordenes'],
  priority: ['prioridad'],
  tier: ['tier segmento', 'tier', 'segmento', 'segment'],
  owner: ['dueno', 'responsable', 'owner', 'vendedor'],
  group: ['grupo contactar control', 'grupo', 'control', 'contactar control'],
  verify: ['verificar antes', 'verificar', 'revisar antes'],
  touch1_date: ['1er toque fecha', 'primer toque fecha', '1er toque'],
  touch1_channel: ['1er toque canal', 'primer toque canal'],
  touch2_date: ['2do toque llamada fecha', '2do toque fecha', 'segundo toque'],
  responded: ['respondio', 'contesto'],
  reserved: ['volvio a pedir', 'reservo', 'volvio a comprar', 'recompro'],
  notes: ['notas', 'nota', 'comentarios'],
};

// Dado los headers de una fila, devuelve índice de columna por campo.
function mapHeaders(headers: unknown[]): Record<string, number> {
  const normed = headers.map(norm);
  const idx: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    // Mejor match: header que contenga (o sea contenido por) algún alias.
    let best = -1;
    for (let i = 0; i < normed.length; i++) {
      const h = normed[i];
      if (!h) continue;
      if (aliases.some((a) => h === a || h.includes(a) || a.includes(h))) {
        best = i;
        break;
      }
    }
    if (best >= 0) idx[field] = best;
  }
  return idx;
}

// Detecta el list_type a partir del nombre de la hoja.
export function listTypeFromSheet(sheetName: string): ReactListType {
  const s = norm(sheetName);
  if (s.includes('primera') || s.includes('recompra')) return 'primera_recompra';
  if (s.includes('excluir') || s.includes('revisar') || s.includes('excluidos')) return 'excluir';
  return 'reactivacion';
}

// Convierte una matriz de celdas (incluye filas de título) en ParsedRow[].
// Busca la fila de headers (la que contiene "nombre"/"empresa" y "telefono").
export function parseRows(matrix: unknown[][], listType: ReactListType): ParsedRow[] {
  let headerRow = -1;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const row = matrix[i].map(norm);
    const hasName = row.some((c) => c === 'nombre' || c === 'empresa' || c === 'cliente');
    const hasPhone = row.some((c) => c.includes('telefono') || c.includes('celular') || c.includes('whatsapp'));
    if (hasName && hasPhone) {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) return [];
  const idx = mapHeaders(matrix[headerRow]);
  const get = (row: unknown[], f: string) => (idx[f] != null ? row[idx[f]] : undefined);

  const out: ParsedRow[] = [];
  for (let i = headerRow + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const company = String(get(row, 'company') ?? '').trim();
    if (!company) continue;
    const phoneRaw = get(row, 'phone');
    const group = norm(get(row, 'group'));
    out.push({
      company,
      phone: phoneRaw != null && String(phoneRaw).trim() ? String(phoneRaw).trim() : null,
      phone_norm: normPhone(phoneRaw),
      last_order_date: parseDate(get(row, 'last_order_date')),
      days_inactive: parseInt2(get(row, 'days_inactive')),
      total_orders: parseInt2(get(row, 'total_orders')),
      tier: parseTier(get(row, 'tier')),
      segment: get(row, 'tier') != null ? String(get(row, 'tier')).trim() : null,
      priority: parsePriority(get(row, 'priority')),
      owner: get(row, 'owner') != null ? String(get(row, 'owner')).split('(')[0].trim() || null : null,
      is_control: group.includes('control'),
      needs_verify: !!norm(get(row, 'verify')),
      list_type: listType,
    });
  }
  return out;
}

// Deriva el estado a partir del progreso registrado.
export function deriveStatus(c: {
  touch1_date: string | null;
  responded: boolean | null;
  reserved: boolean | null;
}): ReactStatus {
  if (c.reserved === true) return 'reservo';
  if (c.reserved === false) return 'no_reservo';
  if (c.responded === true) return 'respondio';
  if (c.touch1_date) return 'toque1';
  return 'pendiente';
}

export const REACT_STATUS_LABEL: Record<ReactStatus, string> = {
  pendiente: 'Sin tocar',
  toque1: 'Ya le escribí',
  respondio: 'Respondió',
  reservo: 'Volvió a pedir',
  no_reservo: 'No volvió',
};

// Etiquetas en cristiano para el tamaño de cuenta (evita "Tier A/B/C").
export const TIER_LABEL: Record<ReactTier, string> = {
  A: 'Grande',
  B: 'Mediano',
  C: 'Chico',
};

// Etiqueta y color del desenlace (chip en la lista + botones en la ficha).
export const OUTCOME_META: Record<ReactOutcome, { label: string; short: string; dot: string; chip: string }> = {
  vivo: { label: '🟢 Vivo · en juego', short: 'Vivo', dot: '🟢', chip: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  octubre: { label: '🟡 Vuelve en octubre', short: 'Octubre', dot: '🟡', chip: 'bg-amber-50 text-amber-700 border border-amber-200' },
  muerto: { label: '⚫ Muerto · no vuelve', short: 'Muerto', dot: '⚫', chip: 'bg-gray-100 text-gray-500 border border-gray-200' },
};

export const REACT_STATUS_ORDER: ReactStatus[] = [
  'pendiente',
  'toque1',
  'respondio',
  'reservo',
  'no_reservo',
];
