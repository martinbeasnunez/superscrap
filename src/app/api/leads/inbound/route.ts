import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { randomUUID } from 'crypto';

interface InboundLeadRequest {
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
  rooms?: string;
  frequency?: string;
  currentProvider?: string;
  comments?: string;
  source: string;
  businessType: string;
}

export async function POST(request: Request) {
  try {
    const data: InboundLeadRequest = await request.json();

    // Validar campos requeridos
    if (!data.businessName || !data.contactName || !data.phone) {
      return NextResponse.json(
        { error: 'Nombre del negocio, nombre de contacto y teléfono son requeridos' },
        { status: 400 }
      );
    }

    // Formatear teléfono para Perú
    let formattedPhone = data.phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('51') && formattedPhone.length === 9) {
      formattedPhone = '51' + formattedPhone;
    }

    // Crear descripción con los detalles del formulario
    const descriptionParts = [];
    if (data.rooms) descriptionParts.push(`Habitaciones: ${data.rooms}`);
    if (data.frequency) descriptionParts.push(`Frecuencia: ${data.frequency}`);
    if (data.currentProvider) descriptionParts.push(`Proveedor actual: ${data.currentProvider === 'si' ? 'Sí tiene' : 'No tiene'}`);
    if (data.comments) descriptionParts.push(`Comentarios: ${data.comments}`);

    const description = descriptionParts.length > 0
      ? `🔥 LEAD INBOUND (${data.source})\n${descriptionParts.join('\n')}`
      : `🔥 LEAD INBOUND (${data.source})`;

    // Primero, crear o encontrar un search para leads inbound
    let searchId: string;

    // Buscar si ya existe un search para inbound leads
    const { data: existingSearch } = await supabase
      .from('searches')
      .select('id')
      .eq('business_type', 'inbound_lead')
      .single();

    if (existingSearch) {
      searchId = existingSearch.id;
    } else {
      // Crear un nuevo search para inbound leads
      const { data: newSearch, error: searchError } = await supabase
        .from('searches')
        .insert({
          id: randomUUID(),
          business_type: 'inbound_lead',
          city: 'Lima',
          status: 'completed',
          total_found: 0,
          results_count: 0,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (searchError) {
        console.error('Error creating inbound search:', searchError);
        return NextResponse.json({ error: 'Error al crear búsqueda' }, { status: 500 });
      }
      searchId = newSearch.id;
    }

    // Crear el business (lead)
    const businessId = randomUUID();
    const { error: businessError } = await supabase
      .from('businesses')
      .insert({
        id: businessId,
        name: data.businessName,
        phone: formattedPhone,
        description,
        search_id: searchId,
        // Decision makers con el contacto
        decision_makers: data.email || data.contactName ? [{
          email: data.email || null,
          firstName: data.contactName.split(' ')[0] || null,
          lastName: data.contactName.split(' ').slice(1).join(' ') || null,
          fullName: data.contactName,
          position: 'Contacto Inbound',
          seniority: null,
          department: null,
          confidence: 100,
          linkedin: null,
          phone: formattedPhone,
        }] : null,
        // Marcar como lead caliente inbound
        lead_status: 'inbound',
        sales_stage: 'interesado', // Van directo a interesado porque ellos nos buscaron
        contacted_at: new Date().toISOString(),
        contact_actions: ['inbound_form'],
        created_at: new Date().toISOString(),
      });

    if (businessError) {
      console.error('Error creating inbound lead:', businessError);
      return NextResponse.json({ error: 'Error al crear lead' }, { status: 500 });
    }

    // Registrar en contact_history
    await supabase.from('contact_history').insert({
      id: randomUUID(),
      business_id: businessId,
      contact_type: 'inbound_form',
      notes: `🔥 LEAD INBOUND - ${data.source}\n\n` +
        `👤 Contacto: ${data.contactName}\n` +
        `📞 Teléfono: ${formattedPhone}\n` +
        (data.email ? `📧 Email: ${data.email}\n` : '') +
        (data.rooms ? `🛏️ Habitaciones: ${data.rooms}\n` : '') +
        (data.frequency ? `📅 Frecuencia: ${data.frequency}\n` : '') +
        (data.currentProvider ? `🏢 Proveedor actual: ${data.currentProvider === 'si' ? 'Sí tiene' : 'No tiene'}\n` : '') +
        (data.comments ? `💬 Comentarios: ${data.comments}\n` : ''),
      created_at: new Date().toISOString(),
    });

    // Actualizar el conteo de la búsqueda
    await supabase.rpc('increment_search_count', { search_id: searchId });

    return NextResponse.json({
      success: true,
      message: 'Lead creado exitosamente',
      leadId: businessId,
    });

  } catch (error) {
    console.error('Inbound lead error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// GET: Obtener estadísticas de leads inbound
export async function GET() {
  try {
    const { data: leads, error } = await supabase
      .from('businesses')
      .select('id, name, phone, sales_stage, created_at')
      .eq('lead_status', 'inbound')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching inbound leads:', error);
      return NextResponse.json({ error: 'Error al obtener leads' }, { status: 500 });
    }

    return NextResponse.json({ leads: leads || [] });
  } catch (error) {
    console.error('Inbound leads GET error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
