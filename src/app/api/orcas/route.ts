import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Vista "Cerrar Orcas": lista enfocada de leads tier=orca con dueño, stage,
// score y días sin contacto, para trabajar el cierre uno por uno.

export interface OrcaLead {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  businessType: string | null;
  city: string | null;
  score: number | null;
  revenueMin: number | null;
  revenueMax: number | null;
  stage: string;
  contacted: boolean;
  ownerId: string | null;
  ownerName: string | null;
  contactedAt: string | null;
  daysSinceContact: number | null;
  source: string | null;
}

const STAGES = [
  'nuevo', 'contactado', 'seguimiento_1', 'seguimiento_2',
  'seguimiento_3', 'interesado', 'cotizado', 'cliente', 'perdido',
];

export async function GET() {
  try {
    // Supabase corta en 1000 filas — paginamos aunque hoy sean ~481 orcas,
    // a prueba de crecimiento.
    const fetchAll = async (
      make: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
    ): Promise<any[]> => {
      const pageSize = 1000;
      const rows: any[] = [];
      let page = 0;
      while (true) {
        const { data, error } = await make(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < pageSize) break;
        page += 1;
      }
      return rows;
    };

    // !inner filtra el padre (businesses) por el tier del hijo (service_analyses).
    const rows = await fetchAll((from, to) =>
      supabase
        .from('businesses')
        .select(`
          id, name, phone, address, contact_actions, sales_stage, contacted_at, contacted_by, source,
          searches ( business_type, city ),
          service_analyses!inner ( potential_tier, potential_score, estimated_revenue_min, estimated_revenue_max )
        `)
        .eq('service_analyses.potential_tier', 'orca')
        .range(from, to));

    const { data: users } = await supabase.from('users').select('id, name');
    const userMap = new Map<string, string>((users || []).map((u) => [u.id, u.name]));

    const now = Date.now();
    const one = (v: any) => (Array.isArray(v) ? v[0] : v) || {};

    const orcas: OrcaLead[] = rows.map((b) => {
      const a = one(b.service_analyses);
      const s = one(b.searches);
      const stage = STAGES.includes(b.sales_stage) ? b.sales_stage : 'nuevo';
      const actions: string[] = Array.isArray(b.contact_actions) ? b.contact_actions : [];
      const contacted = actions.length > 0 || (b.sales_stage && b.sales_stage !== 'nuevo');
      const days = b.contacted_at
        ? Math.floor((now - new Date(b.contacted_at).getTime()) / 86400000)
        : null;
      return {
        id: b.id,
        name: b.name,
        phone: b.phone,
        address: b.address,
        businessType: s.business_type || null,
        city: s.city || null,
        score: a.potential_score ?? null,
        revenueMin: a.estimated_revenue_min ?? null,
        revenueMax: a.estimated_revenue_max ?? null,
        stage,
        contacted: !!contacted,
        ownerId: b.contacted_by || null,
        ownerName: b.contacted_by ? (userMap.get(b.contacted_by) || 'Desconocido') : null,
        contactedAt: b.contacted_at || null,
        daysSinceContact: days,
        source: b.source || null,
      };
    });

    // Orden por defecto: score desc (nulls al final), luego más frío arriba.
    orcas.sort((a, b) => {
      const sa = a.score ?? -1, sb = b.score ?? -1;
      if (sb !== sa) return sb - sa;
      return (b.daysSinceContact ?? -1) - (a.daysSinceContact ?? -1);
    });

    const open = orcas.filter((o) => !['cliente', 'perdido'].includes(o.stage));
    const summary = {
      total: orcas.length,
      open: open.length,
      won: orcas.filter((o) => o.stage === 'cliente').length,
      lost: orcas.filter((o) => o.stage === 'perdido').length,
      hot: orcas.filter((o) => o.stage === 'interesado' || o.stage === 'cotizado').length,
      untouched: orcas.filter((o) => !o.contacted).length,
      sinDueno: open.filter((o) => !o.ownerId).length,
      revenueMin: open.reduce((s, o) => s + (o.revenueMin || 0), 0),
      revenueMax: open.reduce((s, o) => s + (o.revenueMax || 0), 0),
      byStage: Object.fromEntries(STAGES.map((s) => [s, orcas.filter((o) => o.stage === s).length])),
    };

    return NextResponse.json({ orcas, summary });
  } catch (error) {
    console.error('Orcas endpoint error:', error);
    return NextResponse.json({ error: 'Error al obtener orcas' }, { status: 500 });
  }
}
