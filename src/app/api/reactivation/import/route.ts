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

    if (contentType.includes('multipart/form-data')) {
      // --- Subida de archivo .xlsx ---
      const form = await request.formData();
      const file = form.get('file');
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

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      total: incoming.length,
      sheets: sheetSummary,
    });
  } catch (e) {
    console.error('reactivation import exception:', e);
    const msg = e instanceof Error ? e.message : 'Error al importar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Evita que Next intente prerenderizar / cachear
export const dynamic = 'force-dynamic';
