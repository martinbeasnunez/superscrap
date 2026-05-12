import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface ManualLeadRequest {
  name: string;
  phone: string;
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

    // Normalize phone to Peru format (51 + 9 digits) if it looks like a local number
    let phone = data.phone.replace(/\D/g, '');
    if (!phone.startsWith('51') && phone.length === 9) {
      phone = '51' + phone;
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
