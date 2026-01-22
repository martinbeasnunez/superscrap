import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysThreshold = parseInt(searchParams.get('days') || '3');

    // Obtener todos los negocios que han sido contactados
    const { data: businesses, error: bizError } = await supabase
      .from('businesses')
      .select(`
        id,
        name,
        address,
        phone,
        lead_status,
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
      .not('contact_actions', 'is', null)
      .neq('lead_status', 'discarded')
      .neq('lead_status', 'prospect')
      .order('contacted_at', { ascending: true });

    if (bizError) {
      console.error('Error fetching businesses:', bizError);
      return NextResponse.json({ error: 'Error al obtener negocios' }, { status: 500 });
    }

    // Obtener historial de contactos para calcular último contacto
    const businessIds = businesses?.map(b => b.id) || [];

    const { data: history, error: histError } = await supabase
      .from('contact_history')
      .select('business_id, action_type, created_at, user_id, users(name)')
      .in('business_id', businessIds)
      .order('created_at', { ascending: false });

    if (histError) {
      console.error('Error fetching history:', histError);
    }

    // Agrupar historial por negocio
    const historyByBusiness: Record<string, {
      lastContact: string;
      contactCount: number;
      lastAction: string;
      lastContactedBy: string | null;
      contacts: Array<{ date: string; action: string; userName: string | null }>;
    }> = {};

    history?.forEach((h: any) => {
      if (!historyByBusiness[h.business_id]) {
        historyByBusiness[h.business_id] = {
          lastContact: h.created_at,
          contactCount: 0,
          lastAction: h.action_type,
          lastContactedBy: h.users?.name || null,
          contacts: [],
        };
      }
      historyByBusiness[h.business_id].contactCount++;
      historyByBusiness[h.business_id].contacts.push({
        date: h.created_at,
        action: h.action_type,
        userName: h.users?.name || null,
      });
    });

    // Calcular días desde último contacto y filtrar
    const now = new Date();
    const followUps = businesses?.map((b: any) => {
      const historyInfo = historyByBusiness[b.id];
      const lastContactDate = historyInfo?.lastContact || b.contacted_at;
      const daysSinceContact = lastContactDate
        ? Math.floor((now.getTime() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...b,
        businessType: b.searches?.business_type || 'Negocio',
        city: b.searches?.city || '',
        contactedByName: b.users?.name || null,
        lastContactDate,
        daysSinceContact,
        contactCount: historyInfo?.contactCount || 1,
        lastAction: historyInfo?.lastAction || b.contact_actions?.[0] || 'whatsapp',
        contactHistory: historyInfo?.contacts || [],
      };
    }).filter((b: any) => {
      // Filtrar por días sin contacto
      if (b.daysSinceContact === null) return false;
      return b.daysSinceContact >= daysThreshold;
    }).sort((a: any, b: any) => {
      // Ordenar por días sin contacto (más urgentes primero)
      return (b.daysSinceContact || 0) - (a.daysSinceContact || 0);
    });

    // También obtener los contactados hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const contactedToday = businesses?.map((b: any) => {
      const historyInfo = historyByBusiness[b.id];
      const lastContactDate = historyInfo?.lastContact || b.contacted_at;

      return {
        ...b,
        businessType: b.searches?.business_type || 'Negocio',
        city: b.searches?.city || '',
        contactedByName: b.users?.name || null,
        lastContactDate,
        contactCount: historyInfo?.contactCount || 1,
        lastAction: historyInfo?.lastAction || b.contact_actions?.[0] || 'whatsapp',
        contactHistory: historyInfo?.contacts || [],
      };
    }).filter((b: any) => {
      if (!b.lastContactDate) return false;
      const contactDate = new Date(b.lastContactDate);
      return contactDate >= today;
    }).sort((a: any, b: any) => {
      // Más recientes primero
      return new Date(b.lastContactDate!).getTime() - new Date(a.lastContactDate!).getTime();
    });

    return NextResponse.json({
      needsFollowUp: followUps || [],
      contactedToday: contactedToday || [],
      stats: {
        total: businesses?.length || 0,
        needsFollowUp: followUps?.length || 0,
        contactedToday: contactedToday?.length || 0,
      }
    });
  } catch (error) {
    console.error('Follow-ups error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
