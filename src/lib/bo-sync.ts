import { supabase } from '@/lib/supabase';

// ──────────────────────────────────────────────────────────────────────────
// Sync automático contra el BO de getlavado (api.apps.getlavado.com).
//
// Reemplaza el ritual manual de bajar los 2 reportes xlsx a mano. Lee los
// mismos dos endpoints que arman esos reportes y refresca ORBIT con la
// verdad: la fecha real de última orden (arregla los "días sin pedir" que se
// quedaban congelados en el import del mes) y marca los recuperados reales.
//
//  - GET /v1/b2bPartners/lapsed-clients   → ~167 en riesgo, con última orden
//  - GET /v1/b2bPartners/dormant-clients  → ~15 recuperados, con última orden
//
// OJO: usamos SOLO estos dos endpoints (no el detalle por-id), porque el
// reporte agrega bien las empresas con varias sedes y el detalle por-id no.
// Token en BO_API_TOKEN (hoy es el de n8n de Jovanny; cuando dé el de ORBIT,
// se cambia solo la env, nada de código).
// ──────────────────────────────────────────────────────────────────────────

type BoClient = { name: string; phone: string; lastOrderDate: string | null; totalOrders: number | null };

const last9 = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '').slice(-9);

function boHeaders() {
  const token = process.env.BO_API_TOKEN;
  if (!token) throw new Error('Falta BO_API_TOKEN en el entorno');
  return { Authorization: `Bearer ${token}` };
}

async function boFetch(path: string): Promise<BoClient[]> {
  const base = process.env.BO_API_BASE || 'https://api.apps.getlavado.com';
  const res = await fetch(base + path, { headers: boHeaders() });
  if (!res.ok) throw new Error(`BO ${path} respondió ${res.status}`);
  const json = await res.json();
  const data = json?.data ?? json;
  return Array.isArray(data) ? data : [];
}

// ISO (2026-09-16T22:22:16Z) → fecha YYYY-MM-DD; null si no hay.
const isoToDate = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : null);

export type BoSyncResult = {
  lapsed: number;
  recovered: number;
  scanned: number;
  matched: number;
  daysRefreshed: number;
  recoveredMarked: number;
  noMatch: number;
  errors: number;
};

export async function syncFromBO(): Promise<BoSyncResult> {
  const [lapsed, dormant] = await Promise.all([
    boFetch('/v1/b2bPartners/lapsed-clients'),
    boFetch('/v1/b2bPartners/dormant-clients'),
  ]);

  // Índice por teléfono (últimos 9 dígitos). dormant = recuperado; si un
  // cliente sale en ambos, gana recuperado (es el dato más reciente).
  const byPhone = new Map<string, { last: string | null; recovered: boolean }>();
  for (const c of lapsed) {
    const p = last9(c.phone);
    if (p.length >= 8) byPhone.set(p, { last: isoToDate(c.lastOrderDate), recovered: false });
  }
  for (const c of dormant) {
    const p = last9(c.phone);
    if (p.length >= 8) byPhone.set(p, { last: isoToDate(c.lastOrderDate), recovered: true });
  }

  // Clientes de reactivación en ORBIT.
  const { data: orbit, error } = await supabase
    .from('reactivation_clients')
    .select('id, phone, phone_norm, days_inactive, last_order_date, reserved');
  if (error) throw new Error('Supabase: ' + error.message);

  const today = new Date();
  const daysSince = (d: string | null) => {
    if (!d) return null;
    return Math.floor((today.getTime() - new Date(d + 'T12:00:00Z').getTime()) / 86_400_000);
  };

  let matched = 0, daysRefreshed = 0, recoveredMarked = 0, noMatch = 0, errors = 0;

  // Actualiza de a tandas para no saturar.
  const CHUNK = 15;
  for (let i = 0; i < (orbit ?? []).length; i += CHUNK) {
    const slice = (orbit ?? []).slice(i, i + CHUNK);
    await Promise.all(slice.map(async (o) => {
      const hit = byPhone.get(last9(o.phone || o.phone_norm));
      if (!hit || !hit.last) { noMatch++; return; }
      matched++;
      const nd = daysSince(hit.last);
      const patch: Record<string, unknown> = {
        last_order_date: hit.last,
        days_inactive: nd,
        updated_at: new Date().toISOString(),
      };
      // Recuperado real: marca volvió (pero nunca desmarca — eso lo decide un humano).
      if (hit.recovered) { patch.reserved = true; patch.status = 'reservo'; }

      const changedDays = o.last_order_date !== hit.last || o.days_inactive !== nd;
      const changedRec = hit.recovered && o.reserved !== true;

      const { error: upErr } = await supabase.from('reactivation_clients').update(patch).eq('id', o.id);
      if (upErr) { errors++; return; }
      if (changedDays) daysRefreshed++;
      if (changedRec) recoveredMarked++;
    }));
  }

  return {
    lapsed: lapsed.length,
    recovered: dormant.length,
    scanned: (orbit ?? []).length,
    matched,
    daysRefreshed,
    recoveredMarked,
    noMatch,
    errors,
  };
}
