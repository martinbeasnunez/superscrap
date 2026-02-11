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
      ? `LEAD INBOUND (${data.source}) - ${descriptionParts.join(' | ')}`
      : `LEAD INBOUND (${data.source})`;

    // PASO 1: Buscar o crear search para inbound leads
    let searchId: string;

    const { data: existingSearch } = await supabase
      .from('searches')
      .select('id')
      .eq('business_type', 'inbound_lead')
      .limit(1);

    if (existingSearch && existingSearch.length > 0) {
      searchId = existingSearch[0].id;
    } else {
      // Crear search - incluyendo required_services que es NOT NULL
      const { data: newSearch, error: searchError } = await supabase
        .from('searches')
        .insert({
          business_type: 'inbound_lead',
          city: 'Lima',
          status: 'completed',
          required_services: [],
        })
        .select('id')
        .single();

      if (searchError) {
        return NextResponse.json({
          error: 'Error creando search',
          step: 'create_search',
          details: searchError.message,
          code: searchError.code,
        }, { status: 500 });
      }
      searchId = newSearch.id;
    }

    // PASO 2: Crear el business - campos mínimos primero
    const { data: newBusiness, error: businessError } = await supabase
      .from('businesses')
      .insert({
        name: data.businessName,
        phone: formattedPhone,
        description: description,
        search_id: searchId,
        lead_status: 'inbound',
        sales_stage: 'interesado',
      })
      .select('id')
      .single();

    if (businessError) {
      return NextResponse.json({
        error: 'Error creando lead',
        step: 'create_business',
        details: businessError.message,
        code: businessError.code,
        hint: businessError.hint,
      }, { status: 500 });
    }

    const businessId = newBusiness.id;

    // PASO 3: Actualizar con campos adicionales (opcional, no falla si hay error)
    await supabase
      .from('businesses')
      .update({
        contacted_at: new Date().toISOString(),
        contact_actions: ['inbound_form'],
        decision_makers: [{
          email: data.email || null,
          fullName: data.contactName,
          position: 'Contacto Inbound',
          phone: formattedPhone,
        }],
      })
      .eq('id', businessId);

    // PASO 4: Crear historial de contacto (opcional)
    await supabase.from('contact_history').insert({
      business_id: businessId,
      contact_type: 'inbound_form',
      notes: `LEAD INBOUND - ${data.source} | Contacto: ${data.contactName} | Tel: ${formattedPhone}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Lead creado exitosamente',
      leadId: businessId,
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Error interno',
      step: 'catch',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// GET: Obtener leads inbound
export async function GET() {
  try {
    const { data: leads, error } = await supabase
      .from('businesses')
      .select('id, name, phone, sales_stage, created_at')
      .eq('lead_status', 'inbound')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: 'Error al obtener leads', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ leads: leads || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
