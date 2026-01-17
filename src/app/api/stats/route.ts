import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ContactAction, LeadStatus } from '@/types';

interface UserStats {
  name: string;
  whatsapp: number;
  email: number;
  call: number;
  prospects: number;
  discarded: number;
}

export async function GET() {
  try {
    // Fecha de hoy (inicio del día) en hora de Peru (UTC-5)
    const now = new Date();
    const peruOffset = -5 * 60;
    const peruTime = new Date(now.getTime() + (peruOffset - now.getTimezoneOffset()) * 60000);
    const todayPeru = new Date(peruTime);
    todayPeru.setHours(0, 0, 0, 0);
    const todayUTC = new Date(todayPeru.getTime() - peruOffset * 60000);
    const todayISO = todayUTC.toISOString();

    // Total búsquedas
    const { count: totalSearches } = await supabase
      .from('searches')
      .select('*', { count: 'exact', head: true });

    // Total negocios
    const { count: totalBusinesses } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true });

    // Stats de contactos - nuevo sistema + legacy
    const { data: contactStats } = await supabase
      .from('businesses')
      .select('contact_actions, lead_status, contact_status, contacted_at, contacted_by');

    // Obtener usuarios para mapear IDs a nombres
    const { data: users } = await supabase
      .from('users')
      .select('id, name');

    const userMap = new Map<string, string>();
    users?.forEach((u) => userMap.set(u.id, u.name));

    // Contadores totales
    let whatsappTotal = 0, emailTotal = 0, callTotal = 0;
    let prospectsTotal = 0, discardedTotal = 0;

    // Contadores de hoy
    let whatsappToday = 0, emailToday = 0, callToday = 0;
    let prospectsToday = 0, discardedToday = 0;

    // Stats por usuario (solo hoy)
    const userStatsToday = new Map<string, UserStats>();

    contactStats?.forEach((b) => {
      const isToday = b.contacted_at && b.contacted_at >= todayISO;
      const userId = b.contacted_by;
      const userName = userId ? userMap.get(userId) || 'Desconocido' : null;

      // Migrar datos legacy a nuevo formato
      let actions: ContactAction[] = b.contact_actions || [];
      const rawStatus = b.lead_status as string || 'no_contact';

      // Migrar estados legacy a nuevos valores
      let status: LeadStatus = 'no_contact';
      if (rawStatus === 'prospect') status = 'prospect';
      else if (rawStatus === 'discarded') status = 'discarded';
      else if (rawStatus === 'lead') status = 'prospect'; // legacy
      // 'contacted' y 'no_contact' -> 'no_contact'

      // Si no hay nuevo formato pero hay legacy, migrar
      if (actions.length === 0 && b.contact_status) {
        if (b.contact_status === 'whatsapp') actions = ['whatsapp'];
        else if (b.contact_status === 'called') actions = ['call'];
        else if (b.contact_status === 'contacted') actions = ['whatsapp'];
      }

      // Contar acciones
      if (actions.includes('whatsapp')) {
        whatsappTotal++;
        if (isToday) whatsappToday++;
      }
      if (actions.includes('email')) {
        emailTotal++;
        if (isToday) emailToday++;
      }
      if (actions.includes('call')) {
        callTotal++;
        if (isToday) callToday++;
      }

      // Contar estados
      if (status === 'prospect') {
        prospectsTotal++;
        if (isToday) prospectsToday++;
      } else if (status === 'discarded') {
        discardedTotal++;
        if (isToday) discardedToday++;
      }

      // Stats por usuario (hoy)
      if (isToday && userName) {
        const stats = userStatsToday.get(userName) || {
          name: userName, whatsapp: 0, email: 0, call: 0, prospects: 0, discarded: 0
        };
        if (actions.includes('whatsapp')) stats.whatsapp++;
        if (actions.includes('email')) stats.email++;
        if (actions.includes('call')) stats.call++;
        if (status === 'prospect') stats.prospects++;
        if (status === 'discarded') stats.discarded++;
        userStatsToday.set(userName, stats);
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
        email: emailTotal,
        call: callTotal,
        prospects: prospectsTotal,
        discarded: discardedTotal,
      },
      today: {
        searches: searchesToday || 0,
        whatsapp: whatsappToday,
        email: emailToday,
        call: callToday,
        prospects: prospectsToday,
        discarded: discardedToday,
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
