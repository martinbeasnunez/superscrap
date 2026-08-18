import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { findExistingBusiness } from '@/lib/dedup';

type LeadChannel =
  | 'comercial' | 'google_seo' | 'google_sem' | 'laundryheap'
  | 'getlavado_b2c' | 'getlavado_b2b' | 'referido'
  | 'linkedin' | 'eventos' | 'otro';
const VALID_CHANNELS: LeadChannel[] = [
  'comercial', 'google_seo', 'google_sem', 'laundryheap',
  'getlavado_b2c', 'getlavado_b2b', 'referido',
  'linkedin', 'eventos', 'otro',
];

interface ManualLeadRequest {
  name: string;
  phone: string;
  channel: LeadChannel;
  address?: string;
  notes?: string;
  tier?: 'orca' | 'delfin' | 'unknown';
  estimated_revenue_min?: number;
  estimated_revenue_max?: number;
}

export async function POST(request: Request) {
  try {
    const data: ManualLeadRequest = await request.json();

    if (!data.name?.trim() || !data.phone?.trim()) {
      return NextResponse.json(
        { error: 'Nombre y teléfono son requeridos' },
        { status: 400 }
      );
    }

    if (!data.channel || !VALID_CHANNELS.includes(data.channel)) {
      return NextResponse.json(
        { error: 'Canal de origen es requerido' },
        { status: 400 }
      );
    }

    // Normalize phone to Peru format (51 + 9 digits) if it looks like a local number
    let phone = data.phone.replace(/\D/g, '');
    if (!phone.startsWith('51') && phone.length === 9) {
      phone = '51' + phone;
    }

    // Anti-duplicado: si ya existe ese lead (por teléfono o nombre+dirección),
    // no crear otra tarjeta — devolver el existente. Evita repetidos en el pipeline.
    const dedup = await findExistingBusiness(null, phone, data.name.trim(), data.address?.trim());
    if (dedup.isDuplicate && dedup.existingId) {
      return NextResponse.json({
        ok: true,
        id: dedup.existingId,
        duplicate: true,
        message: 'Este lead ya existía en el pipeline — no se creó una tarjeta nueva.',
      });
    }

    const { data: business, error } = await supabase
      .from('businesses')
      .insert({
        name: data.name.trim(),
        phone,
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
        source: 'manual',
        sales_stage: 'nuevo',
        auto_followup_enabled: false,
        lead_channel: data.channel,
      })
      .select('id')
      .single();

    if (error || !business) {
      console.error('Error creating manual lead:', error);
      return NextResponse.json(
        { error: 'Error al crear el lead' },
        { status: 500 }
      );
    }

    // Optional: persist tier + revenue in service_analyses so the Kanban card
    // shows the Orca/Delfin badge consistently with auto leads.
    const tier = data.tier || 'orca';
    if (tier !== 'unknown' || data.estimated_revenue_min || data.estimated_revenue_max) {
      await supabase.from('service_analyses').insert({
        business_id: business.id,
        potential_tier: tier,
        estimated_revenue_min: data.estimated_revenue_min ?? null,
        estimated_revenue_max: data.estimated_revenue_max ?? null,
      });
    }

    return NextResponse.json({ ok: true, id: business.id });
  } catch (error) {
    console.error('Manual lead error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
