import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET() {
  try {
    const { data: prospects, error } = await supabase
      .from('businesses')
      .select(`
        id,
        name,
        address,
        phone,
        contact_actions,
        contacted_at,
        contacted_by,
        search_id,
        searches (
          business_type,
          city
        ),
        users:contacted_by (
          name
        )
      `)
      .eq('lead_status', 'prospect')
      .order('contacted_at', { ascending: false });

    if (error) {
      console.error('Error fetching prospects:', error);
      return NextResponse.json({ error: 'Error al obtener prospectos' }, { status: 500 });
    }

    const formattedProspects = prospects?.map((p: any) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      phone: p.phone,
      contact_actions: p.contact_actions || [],
      contacted_by_name: p.users?.name || null,
      contacted_at: p.contacted_at,
      search_type: p.searches?.business_type || 'Negocio',
      search_city: p.searches?.city || '',
    })) || [];

    return NextResponse.json({ prospects: formattedProspects });
  } catch (error) {
    console.error('Prospects error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
