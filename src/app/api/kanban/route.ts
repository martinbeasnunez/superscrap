import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export type KanbanColumnId = 'sin_contactar' | 'contactados' | 'interesados' | 'follow_up' | 'descartados';

export interface KanbanBusiness {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  rating: number | null;
  contact_actions: string[] | null;
  lead_status: string | null;
  contacted_at: string | null;
  search_id: string;
  business_type: string | null;
  daysSinceContact: number | null;
}

export interface KanbanResponse {
  columns: Record<KanbanColumnId, KanbanBusiness[]>;
  counts: Record<KanbanColumnId, number>;
}

function classifyBusiness(business: KanbanBusiness): KanbanColumnId {
  const hasContacts = business.contact_actions && business.contact_actions.length > 0;
  const leadStatus = business.lead_status;
  const daysSinceContact = business.daysSinceContact;

  // Sin Contactar: no tiene contact_actions
  if (!hasContacts) {
    return 'sin_contactar';
  }

  // Descartados: lead_status = 'discarded'
  if (leadStatus === 'discarded') {
    return 'descartados';
  }

  // Interesados: lead_status = 'prospect'
  if (leadStatus === 'prospect') {
    return 'interesados';
  }

  // Follow-up: contactado hace 3+ días, sin estado definido
  if (daysSinceContact !== null && daysSinceContact >= 3) {
    return 'follow_up';
  }

  // Contactados: resto (tiene contactos pero recientes)
  return 'contactados';
}

export async function GET() {
  try {
    // Obtener todos los businesses con sus searches para el business_type
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select(`
        id,
        name,
        address,
        phone,
        rating,
        contact_actions,
        lead_status,
        contacted_at,
        search_id,
        searches (
          business_type
        )
      `)
      .order('contacted_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching businesses for kanban:', error);
      return NextResponse.json({ error: 'Error al obtener negocios' }, { status: 500 });
    }

    // Calcular días desde último contacto y clasificar
    const now = new Date();
    const columns: Record<KanbanColumnId, KanbanBusiness[]> = {
      sin_contactar: [],
      contactados: [],
      interesados: [],
      follow_up: [],
      descartados: [],
    };

    businesses?.forEach((b: any) => {
      let daysSinceContact: number | null = null;
      if (b.contacted_at) {
        const contactDate = new Date(b.contacted_at);
        daysSinceContact = Math.floor((now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      const kanbanBusiness: KanbanBusiness = {
        id: b.id,
        name: b.name,
        address: b.address,
        phone: b.phone,
        rating: b.rating,
        contact_actions: b.contact_actions,
        lead_status: b.lead_status,
        contacted_at: b.contacted_at,
        search_id: b.search_id,
        business_type: b.searches?.business_type || null,
        daysSinceContact,
      };

      const columnId = classifyBusiness(kanbanBusiness);
      columns[columnId].push(kanbanBusiness);
    });

    // Ordenar cada columna: más reciente primero para contactados, por nombre para sin_contactar
    columns.sin_contactar.sort((a, b) => a.name.localeCompare(b.name));
    columns.contactados.sort((a, b) => (b.daysSinceContact || 0) - (a.daysSinceContact || 0));
    columns.interesados.sort((a, b) => (a.daysSinceContact || 0) - (b.daysSinceContact || 0));
    columns.follow_up.sort((a, b) => (b.daysSinceContact || 0) - (a.daysSinceContact || 0));
    columns.descartados.sort((a, b) => a.name.localeCompare(b.name));

    const counts: Record<KanbanColumnId, number> = {
      sin_contactar: columns.sin_contactar.length,
      contactados: columns.contactados.length,
      interesados: columns.interesados.length,
      follow_up: columns.follow_up.length,
      descartados: columns.descartados.length,
    };

    return NextResponse.json({ columns, counts });
  } catch (error) {
    console.error('Kanban error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
