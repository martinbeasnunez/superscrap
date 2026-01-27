import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { SalesStage } from '@/types';

// Columnas del pipeline comercial
export type KanbanColumnId = 'nuevo' | 'contactado' | 'interesado' | 'cotizado' | 'cliente' | 'perdido';

export interface KanbanBusiness {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  rating: number | null;
  website: string | null;
  contact_actions: string[] | null;
  lead_status: string | null;
  sales_stage: SalesStage | null;
  contacted_at: string | null;
  search_id: string;
  business_type: string | null;
  city: string | null;
  daysSinceContact: number | null;
  contactCount: number;
}

export interface KanbanResponse {
  columns: Record<KanbanColumnId, KanbanBusiness[]>;
  counts: Record<KanbanColumnId, number>;
}

// Clasificar negocio en columna basado en sales_stage o inferido de datos existentes
function classifyBusiness(business: KanbanBusiness): KanbanColumnId {
  // Si tiene sales_stage definido, usarlo
  if (business.sales_stage) {
    return business.sales_stage as KanbanColumnId;
  }

  // Inferir de datos existentes para migración suave
  const hasContacts = business.contact_actions && business.contact_actions.length > 0;
  const leadStatus = business.lead_status;

  // Perdido = discarded
  if (leadStatus === 'discarded') {
    return 'perdido';
  }

  // Interesado = prospect
  if (leadStatus === 'prospect') {
    return 'interesado';
  }

  // Sin contactar = nuevo
  if (!hasContacts) {
    return 'nuevo';
  }

  // Con contactos pero sin estado = contactado
  return 'contactado';
}

export async function GET() {
  try {
    // Obtener todos los businesses con sus searches y contact history
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select(`
        id,
        name,
        address,
        phone,
        rating,
        website,
        contact_actions,
        lead_status,
        sales_stage,
        contacted_at,
        search_id,
        searches (
          business_type,
          city
        )
      `)
      .order('contacted_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching businesses for kanban:', error);
      return NextResponse.json({ error: 'Error al obtener negocios' }, { status: 500 });
    }

    // Obtener conteo de contactos por negocio
    const businessIds = businesses?.map(b => b.id) || [];
    const { data: contactCounts } = await supabase
      .from('contact_history')
      .select('business_id')
      .in('business_id', businessIds);

    const contactCountMap: Record<string, number> = {};
    contactCounts?.forEach(c => {
      contactCountMap[c.business_id] = (contactCountMap[c.business_id] || 0) + 1;
    });

    // Calcular días desde último contacto y clasificar
    const now = new Date();
    const columns: Record<KanbanColumnId, KanbanBusiness[]> = {
      nuevo: [],
      contactado: [],
      interesado: [],
      cotizado: [],
      cliente: [],
      perdido: [],
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
        website: b.website,
        contact_actions: b.contact_actions,
        lead_status: b.lead_status,
        sales_stage: b.sales_stage,
        contacted_at: b.contacted_at,
        search_id: b.search_id,
        business_type: b.searches?.business_type || null,
        city: b.searches?.city || null,
        daysSinceContact,
        contactCount: contactCountMap[b.id] || 0,
      };

      const columnId = classifyBusiness(kanbanBusiness);
      columns[columnId].push(kanbanBusiness);
    });

    // Ordenar cada columna
    // Nuevos: por nombre
    columns.nuevo.sort((a, b) => a.name.localeCompare(b.name));
    // Contactados: más antiguos primero (necesitan follow up)
    columns.contactado.sort((a, b) => (b.daysSinceContact || 0) - (a.daysSinceContact || 0));
    // Interesados: más recientes primero
    columns.interesado.sort((a, b) => (a.daysSinceContact || 0) - (b.daysSinceContact || 0));
    // Cotizados: más recientes primero
    columns.cotizado.sort((a, b) => (a.daysSinceContact || 0) - (b.daysSinceContact || 0));
    // Clientes: por nombre
    columns.cliente.sort((a, b) => a.name.localeCompare(b.name));
    // Perdidos: por nombre
    columns.perdido.sort((a, b) => a.name.localeCompare(b.name));

    const counts: Record<KanbanColumnId, number> = {
      nuevo: columns.nuevo.length,
      contactado: columns.contactado.length,
      interesado: columns.interesado.length,
      cotizado: columns.cotizado.length,
      cliente: columns.cliente.length,
      perdido: columns.perdido.length,
    };

    return NextResponse.json({ columns, counts });
  } catch (error) {
    console.error('Kanban error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
