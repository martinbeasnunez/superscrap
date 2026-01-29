import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ContactAction, LeadStatus } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface UserStats {
  name: string;
  whatsapp: number;
  email: number;
  call: number;
  prospects: number;
  discarded: number;
  followUps: number;
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

    // Stats de contactos - usando sales_stage como fuente de verdad
    const { data: contactStats } = await supabase
      .from('businesses')
      .select('contact_actions, lead_status, sales_stage, contact_status, contacted_at, contacted_by');

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

      // Si no hay nuevo formato pero hay legacy, migrar
      if (actions.length === 0 && b.contact_status) {
        if (b.contact_status === 'whatsapp') actions = ['whatsapp'];
        else if (b.contact_status === 'called') actions = ['call'];
        else if (b.contact_status === 'contacted') actions = ['whatsapp'];
      }

      // Usar sales_stage como fuente de verdad, con fallback a lead_status
      const salesStage = b.sales_stage as string | null;
      const leadStatus = b.lead_status as string | null;

      // Determinar si es prospecto (en negociación activa) o descartado
      // Prospecto = interesado + cotizado (están en el pipeline activo)
      const isProspect = salesStage === 'interesado' || salesStage === 'cotizado' || (!salesStage && leadStatus === 'prospect');
      // Descartado = sales_stage 'perdido' O lead_status 'discarded' (legacy)
      const isDiscarded = salesStage === 'perdido' || (!salesStage && leadStatus === 'discarded');

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

      // Contar estados usando sales_stage
      if (isProspect) {
        prospectsTotal++;
        if (isToday) prospectsToday++;
      } else if (isDiscarded) {
        discardedTotal++;
        if (isToday) discardedToday++;
      }

      // Stats por usuario (hoy)
      if (isToday && userName) {
        const stats = userStatsToday.get(userName) || {
          name: userName, whatsapp: 0, email: 0, call: 0, prospects: 0, discarded: 0, followUps: 0
        };
        if (actions.includes('whatsapp')) stats.whatsapp++;
        if (actions.includes('email')) stats.email++;
        if (actions.includes('call')) stats.call++;
        if (isProspect) stats.prospects++;
        if (isDiscarded) stats.discarded++;
        userStatsToday.set(userName, stats);
      }
    });

    // Búsquedas de hoy
    const { count: searchesToday } = await supabase
      .from('searches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);

    // Obtener follow-ups de hoy desde contact_history
    // Incluimos is_follow_up si existe la columna
    const { data: todayHistory } = await supabase
      .from('contact_history')
      .select('business_id, user_id, created_at, is_follow_up')
      .gte('created_at', todayISO);

    // Contar follow-ups por usuario hoy usando el flag is_follow_up
    todayHistory?.forEach((h: any) => {
      // Solo contar si is_follow_up es true
      if (h.is_follow_up === true) {
        const userName = h.user_id ? userMap.get(h.user_id) || 'Desconocido' : null;
        if (userName) {
          const stats = userStatsToday.get(userName) || {
            name: userName, whatsapp: 0, email: 0, call: 0, prospects: 0, discarded: 0, followUps: 0
          };
          stats.followUps++;
          userStatsToday.set(userName, stats);
        }
      }
    });

    // Follow-up stats: negocios que necesitan seguimiento (3+ dias sin contacto)
    const daysThreshold = 3;
    const thresholdDate = new Date(now.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

    // Obtener historial de contactos para calcular ultimo contacto
    const businessIds = contactStats?.map((b: any) => b.id) || [];

    // Obtener negocios con sus IDs
    const { data: businessesWithIds } = await supabase
      .from('businesses')
      .select('id, contact_actions, lead_status, contacted_at')
      .not('contact_actions', 'is', null)
      .neq('lead_status', 'discarded')
      .neq('lead_status', 'prospect');

    const validBusinessIds = businessesWithIds?.map((b: any) => b.id) || [];

    const { data: history } = await supabase
      .from('contact_history')
      .select('business_id, created_at')
      .in('business_id', validBusinessIds)
      .order('created_at', { ascending: false });

    // Agrupar ultimo contacto por negocio
    const lastContactByBusiness: Record<string, string> = {};
    history?.forEach((h: any) => {
      if (!lastContactByBusiness[h.business_id]) {
        lastContactByBusiness[h.business_id] = h.created_at;
      }
    });

    // Contar negocios que necesitan follow-up
    let needsFollowUp = 0;
    businessesWithIds?.forEach((b: any) => {
      const lastContact = lastContactByBusiness[b.id] || b.contacted_at;
      if (lastContact) {
        const lastContactDate = new Date(lastContact);
        if (lastContactDate < thresholdDate) {
          needsFollowUp++;
        }
      }
    });

    // Insights: obtener datos de prospectos con su tipo de negocio y distrito
    // Prospectos = interesado + cotizado (pipeline activo)
    const { data: prospectsData } = await supabase
      .from('businesses')
      .select(`
        id,
        address,
        search_id,
        sales_stage,
        lead_status,
        searches (
          business_type,
          city
        )
      `)
      .or('sales_stage.eq.interesado,sales_stage.eq.cotizado,and(sales_stage.is.null,lead_status.eq.prospect)');

    // Analizar qué tipos de negocio convierten mejor
    const typeStats: Record<string, { prospects: number; total: number }> = {};
    const districtStats: Record<string, { prospects: number }> = {};

    // Contar prospectos por tipo
    prospectsData?.forEach((p: any) => {
      const businessType = p.searches?.business_type || 'Desconocido';
      if (!typeStats[businessType]) {
        typeStats[businessType] = { prospects: 0, total: 0 };
      }
      typeStats[businessType].prospects++;

      // Extraer distrito de la direccion
      const address = (p.address || '').toLowerCase();
      const districts = ['miraflores', 'san isidro', 'surco', 'santiago de surco', 'san borja', 'la molina', 'barranco'];
      for (const d of districts) {
        if (address.includes(d)) {
          const districtName = d === 'santiago de surco' ? 'surco' : d;
          if (!districtStats[districtName]) {
            districtStats[districtName] = { prospects: 0 };
          }
          districtStats[districtName].prospects++;
          break;
        }
      }
    });

    // Contar totales por tipo de negocio (contactados)
    const { data: businessesByType } = await supabase
      .from('businesses')
      .select(`
        search_id,
        contact_actions,
        searches (
          business_type
        )
      `)
      .not('contact_actions', 'eq', '[]');

    businessesByType?.forEach((b: any) => {
      const businessType = b.searches?.business_type || 'Desconocido';
      if (!typeStats[businessType]) {
        typeStats[businessType] = { prospects: 0, total: 0 };
      }
      typeStats[businessType].total++;
    });

    // Encontrar el mejor tipo de negocio (con al menos 3 contactados)
    let bestType: { name: string; rate: number; prospects: number } | null = null;
    for (const [type, stats] of Object.entries(typeStats)) {
      if (stats.total >= 3) {
        const rate = (stats.prospects / stats.total) * 100;
        if (!bestType || rate > bestType.rate) {
          bestType = { name: type, rate, prospects: stats.prospects };
        }
      }
    }

    // Top distritos con prospectos
    const topDistricts = Object.entries(districtStats)
      .sort((a, b) => b[1].prospects - a[1].prospects)
      .slice(0, 3)
      .map(([name, stats]) => ({ name, prospects: stats.prospects }));

    return NextResponse.json({
      total: {
        searches: totalSearches || 0,
        businesses: totalBusinesses || 0,
        whatsapp: whatsappTotal,
        email: emailTotal,
        call: callTotal,
        prospects: prospectsTotal,
        discarded: discardedTotal,
        needsFollowUp,
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
      insights: {
        bestType,
        topDistricts,
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
