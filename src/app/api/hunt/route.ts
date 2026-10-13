import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { districtOf, isMissingHuntTables, isMobilePhone, limaToday } from '@/lib/hunt';

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/hunt
// Lista "Today's hunt" del Pipeline: los leads que propuso la caza y siguen sin decidir
// (de cualquier día: lo que no se decide se arrastra y le resta cuota a mañana), más el
// resumen de lo decidido hoy y la lectura del estratega de la última corrida.

export interface HuntLeadCard {
  id: string;
  businessId: string;
  huntDate: string;
  rank: number | null;
  thesis: string | null;
  origin: 'nuevo' | 'rescate';
  name: string;
  businessType: string | null;
  address: string | null;
  district: string | null;
  phone: string | null;
  phoneIsMobile: boolean;
  website: string | null;
  email: string | null;
  rating: number | null;
  reviews: number | null;
  score: number | null;
  revenueMin: number | null;
  revenueMax: number | null;
  why: string | null;
  decisionMaker: string | null;
  angle: string | null;
  draftMessage: string | null;
  suggestedRoute: 'humano' | 'bot' | null;
}

const one = (v: any) => (Array.isArray(v) ? v[0] : v) || {};

export async function GET() {
  try {
    const today = limaToday();

    const { data: rows, error } = await supabase
      .from('hunt_leads')
      .select(`
        id, business_id, hunt_date, rank, thesis, origin, why, decision_maker, angle, draft_message,
        suggested_route, decision,
        businesses (
          name, address, phone, website, rating, reviews_count, business_type, decision_makers,
          service_analyses ( potential_score, estimated_revenue_min, estimated_revenue_max )
        )`)
      .or(`decision.is.null,hunt_date.eq.${today}`)
      .order('hunt_date', { ascending: false })
      .order('rank', { ascending: true });

    if (error) {
      if (isMissingHuntTables(error)) {
        return NextResponse.json({ ready: false, pending: [], decidedToday: { humano: 0, bot: 0, descartado: 0 }, run: null });
      }
      throw error;
    }

    const pending: HuntLeadCard[] = (rows || [])
      .filter((h: any) => !h.decision)
      .map((h: any) => {
        const b = one(h.businesses);
        const a = one(b.service_analyses);
        const dms: any[] = Array.isArray(b.decision_makers) ? b.decision_makers : [];
        return {
          id: h.id,
          businessId: h.business_id,
          huntDate: h.hunt_date,
          rank: h.rank,
          thesis: h.thesis,
          origin: h.origin,
          name: b.name || '(no name)',
          businessType: b.business_type || null,
          address: b.address || null,
          district: districtOf(b.address),
          phone: b.phone || null,
          phoneIsMobile: isMobilePhone(b.phone),
          website: b.website || null,
          email: dms.find((d) => d?.email)?.email || null,
          rating: b.rating ?? null,
          reviews: b.reviews_count ?? null,
          score: a.potential_score ?? null,
          revenueMin: a.estimated_revenue_min ?? null,
          revenueMax: a.estimated_revenue_max ?? null,
          why: h.why,
          decisionMaker: h.decision_maker,
          angle: h.angle,
          draftMessage: h.draft_message,
          suggestedRoute: h.suggested_route,
        };
      });

    const decidedToday = { humano: 0, bot: 0, descartado: 0 };
    for (const h of rows || []) {
      if (h.hunt_date === today && h.decision) decidedToday[h.decision as keyof typeof decidedToday]++;
    }

    const { data: runs } = await supabase
      .from('hunt_runs')
      .select('hunt_date, quota, theses, summary')
      .order('created_at', { ascending: false })
      .limit(1);

    return NextResponse.json({ ready: true, today, pending, decidedToday, run: runs?.[0] || null });
  } catch (error) {
    console.error('Hunt list error:', error);
    return NextResponse.json({ error: 'Error al cargar la caza' }, { status: 500 });
  }
}
