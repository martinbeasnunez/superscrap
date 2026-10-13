import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculatePotentialScore } from '@/lib/scoring';
import {
  GRANDE_REV, addToIndex, findInIndex, getHuntCapacity, isMissingHuntTables, isMobilePhone, limaToday, loadDedupIndex,
  type HuntRoute,
} from '@/lib/hunt';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 60;

// POST /api/hunt/save
// Cierra la corrida del día: guarda las apuestas del estratega y los leads que el
// calificador aprobó. El servidor vuelve a aplicar las reglas duras (no confía en el
// agente): cuota del día, anti-duplicado y corte de orca (S/2,500/mes).
// Los leads nuevos entran con auto_followup_enabled = false: el bot NO les escribe
// hasta que alguien elige "bot" en la lista "Today's hunt".

interface ThesisInput {
  rubro: string; zona: string; why?: string;
  found?: number; duplicates?: number; below_orca?: number;
}
interface LeadInput {
  thesis?: number;                 // índice en theses[]
  business_id?: string;            // solo rescate: orca que ya estaba en ORBIT
  place_id?: string | null;
  name?: string;
  type?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  rating?: number | null;
  reviews?: number | null;
  description?: string | null;
  thumbnail?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  emails?: string[];
  phones?: string[];
  why?: string;
  decision_maker?: string;
  angle?: string;
  draft_message?: string;
  suggested_route?: HuntRoute;
  // Si el calificador tiene evidencia de tamaño real que el score automático no ve.
  revenue_override?: { min: number; max: number; reason: string };
}

const ORCA_MIN_REVENUE = 2500; // regla del GM: orca = potencial >= S/2,500/mes (punto medio)

function defaultRoute(revMin: number, type: string, phone: string | null | undefined): HuntRoute {
  if (revMin >= GRANDE_REV || /hotel|hosp|cl[ií]nic|resort/i.test(type)) return 'humano';
  return isMobilePhone(phone) ? 'bot' : 'humano';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const theses: ThesisInput[] = Array.isArray(body.theses) ? body.theses : [];
    const leads: LeadInput[] = Array.isArray(body.leads) ? body.leads : [];
    const summary: string | null = body.summary ? String(body.summary) : null;
    const today = limaToday();

    const capacity = await getHuntCapacity();

    const { data: run, error: runError } = await supabase
      .from('hunt_runs')
      .insert({ hunt_date: today, objective: 'orcas', quota: capacity.quota, theses, summary })
      .select('id')
      .single();
    if (runError || !run) {
      if (isMissingHuntTables(runError)) {
        return NextResponse.json(
          { error: 'Falta correr la migración 019 (migrations/019_daily_hunt.sql) en Supabase.' },
          { status: 409 },
        );
      }
      throw runError;
    }

    const index = await loadDedupIndex();
    const searchIdByThesis = new Map<number, string>();
    const savedByThesis = new Map<number, number>();
    const saved: { id: string; business_id: string; name: string; origin: string }[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const lead of leads) {
      const label = lead.name || lead.business_id || '(sin nombre)';
      if (saved.length >= capacity.quota) {
        skipped.push({ name: label, reason: `fuera de la cuota de hoy (${capacity.quota})` });
        continue;
      }

      const thesisIdx = Number.isInteger(lead.thesis) ? (lead.thesis as number) : -1;
      const thesis = theses[thesisIdx];
      const thesisLabel = thesis ? `${thesis.rubro} × ${thesis.zona}` : null;

      let businessId: string;
      let origin: 'nuevo' | 'rescate' = 'nuevo';
      let revMin = 0;
      let phone = lead.phone || null;
      let type = lead.type || thesis?.rubro || '';

      if (lead.business_id) {
        // ---- Rescate: orca que ya estaba en ORBIT sin trabajar ----
        origin = 'rescate';
        const { data: existing } = await supabase
          .from('businesses')
          .select('id, name, phone, business_type, service_analyses ( estimated_revenue_min )')
          .eq('id', lead.business_id)
          .maybeSingle();
        if (!existing) {
          skipped.push({ name: label, reason: 'business_id no existe' });
          continue;
        }
        businessId = existing.id;
        phone = existing.phone;
        type = existing.business_type || type;
        const a: any = Array.isArray(existing.service_analyses) ? existing.service_analyses[0] : existing.service_analyses;
        revMin = a?.estimated_revenue_min ?? 0;
        // Queda en la cola de decisión: el bot espera igual que con los nuevos.
        await supabase.from('businesses').update({ auto_followup_enabled: false }).eq('id', businessId);
      } else {
        // ---- Nuevo: recién cazado ----
        if (!lead.name?.trim()) {
          skipped.push({ name: label, reason: 'sin nombre' });
          continue;
        }
        const dupId = findInIndex(index, {
          place_id: lead.place_id, phone: lead.phone, name: lead.name, address: lead.address,
        });
        if (dupId) {
          skipped.push({ name: label, reason: 'ya existe en ORBIT' });
          continue;
        }

        const potential = calculatePotentialScore({
          name: lead.name,
          businessType: lead.type || thesis?.rubro || null,
          rating: lead.rating ?? null,
          reviewsCount: lead.reviews ?? null,
          address: lead.address ?? null,
        });
        const ov = lead.revenue_override;
        const hasOverride = !!ov && Number(ov.min) > 0 && Number(ov.max) >= Number(ov.min) && !!ov.reason?.trim();
        const rMin = hasOverride ? Number(ov!.min) : potential.revenue.min;
        const rMax = hasOverride ? Number(ov!.max) : potential.revenue.max;
        if ((rMin + rMax) / 2 < ORCA_MIN_REVENUE) {
          skipped.push({ name: label, reason: 'no llega a orca (potencial < S/2,500/mes)' });
          continue;
        }
        revMin = rMin;

        // La búsqueda de la apuesta (rubro × zona): de ahí leen el rubro el Pipeline y el parte.
        let searchId = searchIdByThesis.get(thesisIdx) || null;
        if (!searchId && thesis) {
          const { data: search } = await supabase
            .from('searches')
            .insert({
              business_type: thesis.rubro,
              city: thesis.zona,
              required_services: [],
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .select('id')
            .single();
          if (search) {
            searchId = search.id;
            searchIdByThesis.set(thesisIdx, search.id);
          }
        }

        const emails = (lead.emails || []).filter(Boolean);
        const phones = (lead.phones || []).filter(Boolean);
        const blankDm = { firstName: null, lastName: null, fullName: null, position: null, seniority: null, department: null, linkedin: null };
        const decisionMakers = emails.length
          ? emails.map((email, i) => ({ ...blankDm, email, confidence: 80, phone: phones[i] || null }))
          : phones.length
            ? phones.map((p) => ({ ...blankDm, email: null, confidence: 70, phone: p }))
            : null;

        const { data: business, error: bizError } = await supabase
          .from('businesses')
          .insert({
            search_id: searchId,
            external_id: lead.place_id || null,
            name: lead.name.trim(),
            address: lead.address || null,
            phone: lead.phone || null,
            rating: lead.rating ?? null,
            reviews_count: lead.reviews ?? null,
            description: lead.description || null,
            website: lead.website || null,
            thumbnail_url: lead.thumbnail || null,
            coordinates: lead.coordinates || null,
            decision_makers: decisionMakers,
            business_type: lead.type || null,
            sales_stage: 'nuevo',
            auto_followup_enabled: false,
          })
          .select('id')
          .single();
        if (bizError || !business) {
          console.error('Hunt save: error inserting business:', bizError);
          skipped.push({ name: label, reason: 'error al guardar el negocio' });
          continue;
        }
        businessId = business.id;
        // Para que el siguiente lead de esta misma corrida no duplique a este.
        addToIndex(index, businessId, { place_id: lead.place_id, phone: lead.phone, name: lead.name, address: lead.address });

        await supabase.from('service_analyses').insert({
          business_id: businessId,
          detected_services: [],
          evidence: lead.why || null,
          matches_requirements: true,
          potential_score: potential.score,
          potential_tier: 'orca',
          estimated_revenue_min: rMin,
          estimated_revenue_max: rMax,
          potential_signals: hasOverride
            ? [...potential.signals, `Ajuste del calificador: ${ov!.reason.trim()}`]
            : potential.signals,
        });
      }

      const route: HuntRoute = lead.suggested_route === 'bot' || lead.suggested_route === 'humano'
        ? lead.suggested_route
        : defaultRoute(revMin, type, phone);

      const { data: huntLead, error: huntError } = await supabase
        .from('hunt_leads')
        .insert({
          run_id: run.id,
          business_id: businessId,
          hunt_date: today,
          rank: saved.length + 1,
          thesis: thesisLabel,
          origin,
          why: lead.why || null,
          decision_maker: lead.decision_maker || null,
          angle: lead.angle || null,
          draft_message: lead.draft_message || null,
          // El bot solo llega a celulares.
          suggested_route: route === 'bot' && !isMobilePhone(phone) ? 'humano' : route,
        })
        .select('id')
        .single();
      if (huntError || !huntLead) {
        skipped.push({
          name: label,
          reason: huntError?.code === '23505' ? 'ya fue propuesto en una caza anterior' : 'error al guardar el brief',
        });
        continue;
      }

      saved.push({ id: huntLead.id, business_id: businessId, name: label, origin });
      if (thesisIdx >= 0) savedByThesis.set(thesisIdx, (savedByThesis.get(thesisIdx) || 0) + 1);
    }

    // Cerrar la corrida: cuánto rindió cada apuesta (lo lee el estratega mañana).
    const thesesWithResult = theses.map((t, i) => ({ ...t, saved: savedByThesis.get(i) || 0 }));
    await supabase.from('hunt_runs').update({ theses: thesesWithResult }).eq('id', run.id);
    for (const [idx, searchId] of searchIdByThesis) {
      const n = savedByThesis.get(idx) || 0;
      await supabase.from('searches').update({ total_results: n, matching_results: n }).eq('id', searchId);
    }

    return NextResponse.json({
      ok: true,
      run_id: run.id,
      fecha: today,
      cuota: capacity.quota,
      guardados: saved,
      omitidos: skipped,
    });
  } catch (error) {
    console.error('Hunt save error:', error);
    return NextResponse.json({ error: 'Error al guardar la caza' }, { status: 500 });
  }
}
