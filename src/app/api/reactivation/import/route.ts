import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import {
  parseRows,
  listTypeFromSheet,
  norm,
  type ParsedRow,
  type ReactListType,
} from '@/lib/reactivation';

// Campos "de lista" que SÍ se refrescan al re-importar.
// El progreso de campaña (touch*, responded, reserved, status, notes) NO se toca.
const STATIC_FIELDS: (keyof ParsedRow)[] = [
  'company', 'phone', 'phone_norm', 'last_order_date', 'days_inactive',
  'total_orders', 'tier', 'segment', 'priority', 'owner',
  'is_control', 'needs_verify', 'list_type',
];

function pickStatic(r: ParsedRow): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of STATIC_FIELDS) o[k] = r[k];
  return o;
}

// Recencia → cubeta (igual que el pitch): reciente ≤90, medio 91-180, viejo >180.
function recencyBucket(d: number | null | undefined): 'reciente' | 'medio' | 'viejo' {
  if (d == null) return 'medio';
  if (d <= 90) return 'reciente';
  if (d <= 180) return 'medio';
  return 'viejo';
}

// Arma un grupo CONTROL estratificado por recencia sobre las filas NUEVAS de
// reactivación: separa ~size clientes (proporcional a cada cubeta) para dejarlos
// SIN contactar y medir contra ellos. Muta is_control en las filas elegidas.
// Devuelve el desglose por cubeta.
function assignStratifiedControl(
  rows: Record<string, unknown>[],
  size: number
): Record<string, number> {
  const eligible = rows.filter((r) => r.list_type === 'reactivacion');
  const n = Math.min(size, eligible.length);
  if (n <= 0) return {};
  const buckets: Record<string, Record<string, unknown>[]> = { reciente: [], medio: [], viejo: [] };
  for (const r of eligible) buckets[recencyBucket(r.days_inactive as number | null)].push(r);
  // Baraja cada cubeta (Fisher-Yates) para que el control sea aleatorio dentro de ella.
  for (const b of Object.values(buckets)) {
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
  }
  const chosen: Record<string, number> = { reciente: 0, medio: 0, viejo: 0 };
  // Cuota proporcional por cubeta (redondeo); el resto se completa por tamaño.
  const order = ['reciente', 'medio', 'viejo'].sort((a, b) => buckets[b].length - buckets[a].length);
  let left = n;
  for (const b of order) {
    const quota = Math.min(buckets[b].length, Math.round((buckets[b].length / eligible.length) * n));
    chosen[b] = Math.min(quota, left);
    left -= chosen[b];
  }
  // Completa lo que falte desde las cubetas con stock (por si el redondeo dejó hueco).
  for (const b of order) {
    while (left > 0 && chosen[b] < buckets[b].length) { chosen[b]++; left--; }
  }
  for (const b of order) {
    for (let i = 0; i < chosen[b]; i++) buckets[b][i].is_control = true;
  }
  return chosen;
}

// Parsea texto pegado (TSV o CSV) a matriz de celdas.
function parsePastedText(text: string): unknown[][] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim().length);
  const delim = lines[0]?.includes('\t') ? '\t' : ',';
  return lines.map((l) => l.split(delim).map((c) => c.trim()));
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const parsed: ParsedRow[] = [];
    const sheetSummary: Record<string, number> = {};
    let controlSize = 0; // 0 = usar lo que marque el Excel; >0 = armar control auto

    if (contentType.includes('multipart/form-data')) {
      // --- Subida de archivo .xlsx ---
      const form = await request.formData();
      const file = form.get('file');
      controlSize = Math.max(0, parseInt(String(form.get('controlSize') ?? '0'), 10) || 0);
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No se recibió archivo.' }, { status: 400 });
      }
      const buf = Buffer.from(await (file as File).arrayBuffer());
      const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
        const lt = listTypeFromSheet(sheetName);
        const rows = parseRows(matrix, lt);
        if (rows.length) {
          parsed.push(...rows);
          sheetSummary[sheetName] = rows.length;
        }
      }
    } else {
      // --- Texto pegado (JSON body: { text, list_type }) ---
      const body = await request.json();
      const text: string = body.text || '';
      const lt: ReactListType = body.list_type || 'reactivacion';
      controlSize = Math.max(0, parseInt(String(body.controlSize ?? '0'), 10) || 0);
      if (!text.trim()) return NextResponse.json({ error: 'No se recibió texto.' }, { status: 400 });
      const matrix = parsePastedText(text);
      const rows = parseRows(matrix, lt);
      parsed.push(...rows);
      sheetSummary['(texto pegado)'] = rows.length;
    }

    if (!parsed.length) {
      return NextResponse.json(
        { error: 'No se encontraron filas. Revisa que estén los headers (Nombre, Teléfono, ...).' },
        { status: 422 }
      );
    }

    // De-dup dentro del propio import (por phone_norm o nombre)
    const seen = new Map<string, ParsedRow>();
    for (const r of parsed) {
      const key = r.phone_norm || `name:${norm(r.company)}`;
      seen.set(key, r); // el último gana
    }
    const incoming = [...seen.values()];

    // Traer existentes para decidir insert vs update (sin pisar progreso)
    const { data: existing, error: exErr } = await supabase
      .from('reactivation_clients')
      .select('id, phone_norm, company');
    if (exErr) {
      console.error('import: fetch existing error', exErr);
      return NextResponse.json({ error: exErr.message }, { status: 500 });
    }
    const byPhone = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const e of existing ?? []) {
      if (e.phone_norm) byPhone.set(e.phone_norm, e.id);
      byName.set(norm(e.company), e.id);
    }

    let inserted = 0;
    let updated = 0;
    const toInsert: Record<string, unknown>[] = [];

    for (const r of incoming) {
      const matchId =
        (r.phone_norm && byPhone.get(r.phone_norm)) ||
        byName.get(norm(r.company)) ||
        null;
      if (matchId) {
        const { error } = await supabase
          .from('reactivation_clients')
          .update({ ...pickStatic(r), updated_at: new Date().toISOString() })
          .eq('id', matchId);
        if (error) console.error('import update error', r.company, error.message);
        else updated++;
      } else {
        toInsert.push(pickStatic(r));
      }
    }

    // Control grande estratificado por recencia: solo sobre los NUEVOS (no pisa
    // septiembre; estable si re-importas, porque los repetidos son update, no insert).
    let controlAssigned: Record<string, number> = {};
    if (controlSize > 0 && toInsert.length) {
      controlAssigned = assignStratifiedControl(toInsert, controlSize);
    }

    if (toInsert.length) {
      const { error, data } = await supabase
        .from('reactivation_clients')
        .insert(toInsert)
        .select('id');
      if (error) {
        console.error('import insert error', error);
        return NextResponse.json({ error: error.message, inserted, updated }, { status: 500 });
      }
      inserted = data?.length ?? toInsert.length;
    }

    const controlTotal = Object.values(controlAssigned).reduce((a, b) => a + b, 0);
    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      total: incoming.length,
      sheets: sheetSummary,
      control: controlTotal > 0 ? { total: controlTotal, byRecency: controlAssigned } : undefined,
    });
  } catch (e) {
    console.error('reactivation import exception:', e);
    const msg = e instanceof Error ? e.message : 'Error al importar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Evita que Next intente prerenderizar / cachear
export const dynamic = 'force-dynamic';
