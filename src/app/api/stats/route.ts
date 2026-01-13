import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Fecha de hoy (inicio del día)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Total búsquedas
    const { count: totalSearches } = await supabase
      .from('searches')
      .select('*', { count: 'exact', head: true });

    // Total negocios
    const { count: totalBusinesses } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true });

    // Stats de contactos
    const { data: contactStats } = await supabase
      .from('businesses')
      .select('contact_status, contacted_at');

    let whatsappTotal = 0;
    let calledTotal = 0;
    let contactedTotal = 0;
    let whatsappToday = 0;
    let calledToday = 0;
    let contactedToday = 0;

    contactStats?.forEach((b) => {
      if (b.contact_status === 'whatsapp') {
        whatsappTotal++;
        if (b.contacted_at && b.contacted_at >= todayISO) whatsappToday++;
      } else if (b.contact_status === 'called') {
        calledTotal++;
        if (b.contacted_at && b.contacted_at >= todayISO) calledToday++;
      } else if (b.contact_status === 'contacted') {
        contactedTotal++;
        if (b.contacted_at && b.contacted_at >= todayISO) contactedToday++;
      }
    });

    // Búsquedas de hoy
    const { count: searchesToday } = await supabase
      .from('searches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);

    return NextResponse.json({
      total: {
        searches: totalSearches || 0,
        businesses: totalBusinesses || 0,
        whatsapp: whatsappTotal,
        called: calledTotal,
        contacted: contactedTotal,
      },
      today: {
        searches: searchesToday || 0,
        whatsapp: whatsappToday,
        called: calledToday,
        contacted: contactedToday,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
