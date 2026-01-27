import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { SalesStage } from '@/types';

// Columnas del pipeline comercial con seguimiento
export type KanbanColumnId =
  | 'nuevo'
  | 'contactado'
  | 'seguimiento_1'  // 3-5 días sin respuesta
  | 'seguimiento_2'  // 6+ días sin respuesta
  | 'interesado'
  | 'cotizado'
  | 'cliente'
  | 'perdido';

export interface DecisionMaker {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  position: string | null;
  seniority: string | null;
  department: string | null;
  confidence: number;
  linkedin: string | null;
  phone: string | null;
}

export interface KanbanBusiness {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  rating: number | null;
  reviews_count: number | null;
  description: string | null;
  website: string | null;
  thumbnail_url: string | null;
  contact_actions: string[] | null;
  lead_status: string | null;
  sales_stage: SalesStage | null;
  contacted_at: string | null;
  search_id: string;
  business_type: string | null;
  city: string | null;
  daysSinceContact: number | null;
  contactCount: number;
  decision_makers: DecisionMaker[] | null;
}

export interface KanbanResponse {
  columns: Record<KanbanColumnId, KanbanBusiness[]>;
  counts: Record<KanbanColumnId, number>;
}

// Clasificar negocio en columna basado en sales_stage Y días sin contacto
function classifyBusiness(business: KanbanBusiness): KanbanColumnId {
  const hasContacts = business.contact_actions && business.contact_actions.length > 0;
  const leadStatus = business.lead_status;
  const salesStage = business.sales_stage;
  const daysSince = business.daysSinceContact;

  // Estados finales - siempre respetarlos
  if (salesStage === 'cliente' || leadStatus === 'cliente') return 'cliente';
  if (salesStage === 'perdido' || leadStatus === 'discarded') return 'perdido';

  // Cotizado - respetarlo
  if (salesStage === 'cotizado') return 'cotizado';

  // Interesado/Prospect - pero verificar si necesita seguimiento
  if (salesStage === 'interesado' || leadStatus === 'prospect') {
    // Si es interesado pero hace mucho que no lo contactamos, moverlo a seguimiento
    if (daysSince !== null && daysSince >= 6) return 'seguimiento_2';
    if (daysSince !== null && daysSince >= 3) return 'seguimiento_1';
    return 'interesado';
  }

  // Sin contactar = nuevo
  if (!hasContacts) return 'nuevo';

  // Tiene contactos - clasificar por tiempo sin contacto
  if (daysSince !== null) {
    if (daysSince >= 6) return 'seguimiento_2';
    if (daysSince >= 3) return 'seguimiento_1';
  }

  // Contactado recientemente (0-2 días)
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
        reviews_count,
        description,
        website,
        thumbnail_url,
        decision_makers,
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
      seguimiento_1: [],
      seguimiento_2: [],
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
        reviews_count: b.reviews_count,
        description: b.description,
        website: b.website,
        thumbnail_url: b.thumbnail_url,
        decision_makers: b.decision_makers,
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
    // Contactados: más antiguos primero (pronto pasarán a seguimiento)
    columns.contactado.sort((a, b) => (b.daysSinceContact || 0) - (a.daysSinceContact || 0));
    // Seguimiento 1: más antiguos primero (más urgente)
    columns.seguimiento_1.sort((a, b) => (b.daysSinceContact || 0) - (a.daysSinceContact || 0));
    // Seguimiento 2: más antiguos primero (crítico)
    columns.seguimiento_2.sort((a, b) => (b.daysSinceContact || 0) - (a.daysSinceContact || 0));
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
      seguimiento_1: columns.seguimiento_1.length,
      seguimiento_2: columns.seguimiento_2.length,
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
