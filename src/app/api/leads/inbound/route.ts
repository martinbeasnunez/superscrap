import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
    const { data: existingSearch, error: findError } = await supabase
      .from('searches')
      .select('id')
      .eq('business_type', 'inbound_lead')
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error('Error finding inbound search:', findError);
    }

    if (existingSearch) {
      searchId = existingSearch.id;
    } else {
      // Crear un nuevo search para inbound leads (sin pasar id, Supabase lo genera)
      const { data: newSearch, error: searchError } = await supabase
        .from('searches')
        .insert({
          business_type: 'inbound_lead',
          city: 'Lima',
          status: 'completed',
        })
        .select('id')
        .single();

      if (searchError) {
        console.error('Error creating inbound search:', searchError);
        return NextResponse.json({
          error: 'Error al crear búsqueda',
          details: searchError.message
        }, { status: 500 });
      }
      searchId = newSearch.id;
    }

    // Crear el business (lead) - sin pasar id, Supabase lo genera
    const { data: newBusiness, error: businessError } = await supabase
      .from('businesses')
      .insert({
        name: data.businessName,
        phone: formattedPhone,
        description,
        search_id: searchId,
        decision_makers: data.email || data.contactName ? [{
          email: data.email || null,
          firstName: data.contactName.split(' ')[0] || null,
          lastName: data.contactName.split(' ').slice(1).join(' ') || null,
          fullName: data.contactName,
          position: 'Contacto Inbound',
          phone: formattedPhone,
        }] : null,
        lead_status: 'inbound',
        sales_stage: 'interesado',
        contacted_at: new Date().toISOString(),
        contact_actions: ['inbound_form'],
      })
      .select('id')
      .single();

    if (businessError) {
      console.error('Error creating inbound lead:', businessError);
      return NextResponse.json({
        error: 'Error al crear lead',
        details: businessError.message
      }, { status: 500 });
    }

    const businessId = newBusiness.id;

    // Registrar en contact_history (sin pasar id)
    const { error: historyError } = await supabase.from('contact_history').insert({
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
    });

    if (historyError) {
      console.error('Error creating contact history:', historyError);
      // No fallamos por esto, el lead ya se creó
    }

    return NextResponse.json({
      success: true,
      message: 'Lead creado exitosamente',
      leadId: businessId,
    });

  } catch (error) {
    console.error('Inbound lead error:', error);
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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
