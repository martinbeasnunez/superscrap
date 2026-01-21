import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Obtener búsquedas con el nombre del usuario que las creó
    const { data: searches, error } = await supabase
      .from('searches')
      .select(`
        *,
        users (
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching searches:', error);
      return NextResponse.json(
        { error: 'Error al obtener búsquedas' },
        { status: 500 }
      );
    }

    // Obtener conteos de contacto por búsqueda
    const searchIds = searches?.map(s => s.id) || [];

    const { data: businesses } = await supabase
      .from('businesses')
      .select('search_id, contact_actions, lead_status')
      .in('search_id', searchIds);

    // Calcular stats por búsqueda
    const contactStatsBySearch: Record<string, {
      whatsapp: number;
      email: number;
      call: number;
      contacted: number;
      prospects: number;
      discarded: number;
    }> = {};

    businesses?.forEach(b => {
      if (!contactStatsBySearch[b.search_id]) {
        contactStatsBySearch[b.search_id] = {
          whatsapp: 0,
          email: 0,
          call: 0,
          contacted: 0,
          prospects: 0,
          discarded: 0
        };
      }
      const stats = contactStatsBySearch[b.search_id];
      const actions = b.contact_actions || [];

      if (actions.includes('whatsapp')) stats.whatsapp++;
      if (actions.includes('email')) stats.email++;
      if (actions.includes('call')) stats.call++;
      if (actions.length > 0) stats.contacted++;
      if (b.lead_status === 'prospect') stats.prospects++;
      if (b.lead_status === 'discarded') stats.discarded++;
    });

    // Formatear para incluir created_by y stats de contacto
    const formattedSearches = searches?.map(search => ({
      ...search,
      created_by: search.users?.name || 'Usuario desconocido',
      created_by_email: search.users?.email || null,
      contact_stats: contactStatsBySearch[search.id] || {
        whatsapp: 0,
        email: 0,
        call: 0,
        contacted: 0,
        prospects: 0,
        discarded: 0
      },
    }));

    return NextResponse.json({ searches: formattedSearches });
  } catch (error) {
    console.error('Searches error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
