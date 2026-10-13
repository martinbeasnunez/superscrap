import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { detectIndustry } from '@/lib/scoring';
import { isLikelyBotReply } from '@/lib/reply-classifier';
import { districtOf, fetchAll, getHuntCapacity, isMissingHuntTables, limaToday } from '@/lib/hunt';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 60;

// GET /api/hunt/snapshot
// La "foto del día" para el estratega de la caza: capacidad (cuántos leads caben hoy),
// qué rubros y distritos rindieron de verdad, qué búsquedas ya están quemadas, cómo
// les fue a las apuestas anteriores y qué orcas ya están en ORBIT sin trabajar.
// Solo lectura y determinístico: el criterio lo pone el agente.

const COMM_OUT = new Set(['whatsapp', 'email', 'auto_whatsapp', 'call', 'ai_call']);
const one = (v: any) => (Array.isArray(v) ? v[0] : v) || {};

interface Bucket {
  leads: number; orcas: number; contactados: number; respondieron: number;
  calientes: number; clientes: number; perdidos: number;
  motivosPerdida: Record<string, number>;
}
const emptyBucket = (): Bucket => ({
  leads: 0, orcas: 0, contactados: 0, respondieron: 0, calientes: 0, clientes: 0, perdidos: 0, motivosPerdida: {},
});

export async function GET() {
  try {
    const capacity = await getHuntCapacity();

    const businesses = await fetchAll((from, to) =>
      supabase
        .from('businesses')
        .select(`
          id, name, address, phone, website, business_type, sales_stage, contacted_by, lost_reason,
          searches ( business_type, city ),
          service_analyses ( potential_tier, potential_score, estimated_revenue_min, estimated_revenue_max )`)
        .range(from, to));

    // Actividad real por negocio: ¿le escribimos? ¿respondió un humano (no una autorespuesta)?
    const contacted = new Set<string>();
    const replied = new Set<string>();
    const outbound = await fetchAll((from, to) =>
      supabase.from('contact_history').select('business_id, action_type').neq('action_type', 'whatsapp_reply').range(from, to));
    for (const e of outbound) if (COMM_OUT.has(e.action_type)) contacted.add(e.business_id);
    const replies = await fetchAll((from, to) =>
      supabase.from('contact_history').select('business_id, notes').eq('action_type', 'whatsapp_reply').range(from, to));
    for (const e of replies) if (!isLikelyBotReply(e.notes)) replied.add(e.business_id);

    const byRubro = new Map<string, Bucket>();
    const byDistrito = new Map<string, Bucket>();
    const add = (map: Map<string, Bucket>, key: string, b: any, tier: string | null) => {
      if (!map.has(key)) map.set(key, emptyBucket());
      const k = map.get(key)!;
      k.leads++;
      if (tier === 'orca') k.orcas++;
      if (contacted.has(b.id) || replied.has(b.id)) k.contactados++;
      if (replied.has(b.id)) k.respondieron++;
      if (b.sales_stage === 'interesado' || b.sales_stage === 'cotizado') k.calientes++;
      if (b.sales_stage === 'cliente') k.clientes++;
      if (b.sales_stage === 'perdido') {
        k.perdidos++;
        const r = b.lost_reason || 'sin_motivo';
        k.motivosPerdida[r] = (k.motivosPerdida[r] || 0) + 1;
      }
    };

    for (const b of businesses) {
      const a = one(b.service_analyses);
      const s = one(b.searches);
      const rubro = detectIndustry(s.business_type || b.business_type || null, b.name || '');
      add(byRubro, rubro, b, a.potential_tier || null);
      add(byDistrito, districtOf(b.address) || 'otro/sin dirección', b, a.potential_tier || null);
    }

    const rank = (map: Map<string, Bucket>, keyName: string) =>
      [...map.entries()]
        .map(([k, v]) => ({
          [keyName]: k,
          ...v,
          tasaRespuesta: v.contactados ? Math.round((v.respondieron / v.contactados) * 100) : null,
        }))
        .sort((x: any, y: any) => y.leads - x.leads);

    // Búsquedas ya hechas (rubro × zona): para no repetir lo quemado.
    const searches = await fetchAll((from, to) =>
      supabase.from('searches').select('business_type, city, total_results, created_at').range(from, to));
    const cov = new Map<string, { rubro: string; zona: string; veces: number; ultima: string; guardados: number }>();
    for (const s of searches) {
      const key = `${(s.business_type || '').toLowerCase().trim()}|${(s.city || '').toLowerCase().trim()}`;
      const cur = cov.get(key) || { rubro: s.business_type, zona: s.city, veces: 0, ultima: '', guardados: 0 };
      cur.veces++;
      cur.guardados += s.total_results || 0;
      const d = (s.created_at || '').slice(0, 10);
      if (d > cur.ultima) cur.ultima = d;
      cov.set(key, cur);
    }
    const busquedasHechas = [...cov.values()].sort((a, b) => (a.ultima < b.ultima ? 1 : -1));

    // Aprendizaje: cómo les fue a las apuestas de las cazas anteriores.
    let apuestasAnteriores: any[] = [];
    let corridasRecientes: any[] = [];
    const huntedIds = new Set<string>();
    const { data: huntLeads, error: huntErr } = await supabase
      .from('hunt_leads')
      .select('business_id, thesis, decision, discard_reason, hunt_date');
    if (huntErr && !isMissingHuntTables(huntErr)) throw huntErr;
    if (huntLeads) {
      const stageOf = new Map<string, string>(businesses.map((b: any) => [b.id, b.sales_stage || 'nuevo']));
      const t = new Map<string, any>();
      for (const h of huntLeads) {
        huntedIds.add(h.business_id);
        const key = h.thesis || '(sin apuesta)';
        if (!t.has(key)) {
          t.set(key, {
            apuesta: key, propuestos: 0, pendientes: 0, humano: 0, bot: 0, descartados: 0,
            motivosDescarte: [] as string[], contactados: 0, respondieron: 0, calientes: 0, clientes: 0, ultima: '',
          });
        }
        const k = t.get(key);
        k.propuestos++;
        if (!h.decision) k.pendientes++;
        else if (h.decision === 'humano') k.humano++;
        else if (h.decision === 'bot') k.bot++;
        else { k.descartados++; if (h.discard_reason) k.motivosDescarte.push(h.discard_reason); }
        if (contacted.has(h.business_id) || replied.has(h.business_id)) k.contactados++;
        if (replied.has(h.business_id)) k.respondieron++;
        const st = stageOf.get(h.business_id);
        if (st === 'interesado' || st === 'cotizado') k.calientes++;
        if (st === 'cliente') k.clientes++;
        if (h.hunt_date > k.ultima) k.ultima = h.hunt_date;
      }
      apuestasAnteriores = [...t.values()].sort((a, b) => (a.ultima < b.ultima ? 1 : -1));

      const { data: runs } = await supabase
        .from('hunt_runs')
        .select('hunt_date, quota, theses, summary')
        .order('created_at', { ascending: false })
        .limit(10);
      corridasRecientes = runs || [];
    }

    // Inventario: orcas que ya están en ORBIT y nadie trabajó (candidatas a "rescate").
    // Tener dueño no cuenta como trabajada: casi todas están asignadas y sin un solo mensaje.
    const { data: users } = await supabase.from('users').select('id, name');
    const userName = new Map<string, string>((users || []).map((u) => [u.id, u.name]));
    const inventarioSinTrabajar = businesses
      .filter((b: any) => {
        const a = one(b.service_analyses);
        return a.potential_tier === 'orca'
          && (!b.sales_stage || b.sales_stage === 'nuevo')
          && !contacted.has(b.id) && !replied.has(b.id)
          && !huntedIds.has(b.id);
      })
      .map((b: any) => {
        const a = one(b.service_analyses);
        const s = one(b.searches);
        return {
          business_id: b.id, name: b.name, rubro: s.business_type || b.business_type || null,
          distrito: districtOf(b.address), address: b.address, phone: b.phone, website: b.website,
          dueno: b.contacted_by ? (userName.get(b.contacted_by) || 'Desconocido') : null,
          score: a.potential_score ?? null, revMin: a.estimated_revenue_min ?? null, revMax: a.estimated_revenue_max ?? null,
        };
      })
      .sort((x, y) => (y.score ?? -1) - (x.score ?? -1));

    return NextResponse.json({
      fecha: limaToday(),
      objetivo: 'orcas',
      capacidad: capacity,
      totales: {
        negocios: businesses.length,
        orcas: businesses.filter((b: any) => one(b.service_analyses).potential_tier === 'orca').length,
        clientes: businesses.filter((b: any) => b.sales_stage === 'cliente').length,
      },
      porRubro: rank(byRubro, 'rubro'),
      porDistrito: rank(byDistrito, 'distrito'),
      busquedasHechas,
      apuestasAnteriores,
      corridasRecientes,
      inventarioSinTrabajar: {
        total: inventarioSinTrabajar.length,
        top: inventarioSinTrabajar.slice(0, 40),
      },
    });
  } catch (error) {
    console.error('Hunt snapshot error:', error);
    return NextResponse.json({ error: 'Error al armar la foto del día' }, { status: 500 });
  }
}
