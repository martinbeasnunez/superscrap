import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface UserStats {
  name: string;
  whatsapp: number;
  called: number;
  contacted: number;
}

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

    // Stats de contactos con usuario
    const { data: contactStats } = await supabase
      .from('businesses')
      .select('contact_status, contacted_at, contacted_by');

    // Obtener usuarios para mapear IDs a nombres
    const { data: users } = await supabase
      .from('users')
      .select('id, name');

    const userMap = new Map<string, string>();
    users?.forEach((u) => userMap.set(u.id, u.name));

    let whatsappTotal = 0;
    let calledTotal = 0;
    let contactedTotal = 0;
    let whatsappToday = 0;
    let calledToday = 0;
    let contactedToday = 0;

    // Stats por usuario (solo hoy)
    const userStatsToday = new Map<string, UserStats>();

    contactStats?.forEach((b) => {
      const isToday = b.contacted_at && b.contacted_at >= todayISO;
      const userId = b.contacted_by;
      const userName = userId ? userMap.get(userId) || 'Desconocido' : null;

      if (b.contact_status === 'whatsapp') {
        whatsappTotal++;
        if (isToday) {
          whatsappToday++;
          if (userName) {
            const stats = userStatsToday.get(userName) || { name: userName, whatsapp: 0, called: 0, contacted: 0 };
            stats.whatsapp++;
            userStatsToday.set(userName, stats);
          }
        }
      } else if (b.contact_status === 'called') {
        calledTotal++;
        if (isToday) {
          calledToday++;
          if (userName) {
            const stats = userStatsToday.get(userName) || { name: userName, whatsapp: 0, called: 0, contacted: 0 };
            stats.called++;
            userStatsToday.set(userName, stats);
          }
        }
      } else if (b.contact_status === 'contacted') {
        contactedTotal++;
        if (isToday) {
          contactedToday++;
          if (userName) {
            const stats = userStatsToday.get(userName) || { name: userName, whatsapp: 0, called: 0, contacted: 0 };
            stats.contacted++;
            userStatsToday.set(userName, stats);
          }
        }
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
        byUser: Array.from(userStatsToday.values()),
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
