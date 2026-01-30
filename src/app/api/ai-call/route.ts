import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// Agent ID y Phone Number ID de ElevenLabs (configurable via env vars)
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || '955wp4k1';
const ELEVENLABS_PHONE_NUMBER_ID = process.env.ELEVENLABS_PHONE_NUMBER_ID || 'phnum_6101kg6k9e1kewdv2vf5rqpv99h6';

// Generar contexto de llamada según el stage del lead
function getCallContext(salesStage: string | null, contactCount: number, lastContactInfo?: string): {
  call_type: string;
  call_objective: string;
  opening_script: string;
  key_points: string;
} {
  const stage = salesStage || 'nuevo';

  switch (stage) {
    case 'contactado':
    case 'seguimiento_1':
    case 'seguimiento_2':
      return {
        call_type: 'SEGUIMIENTO',
        call_objective: 'Retomar conversación anterior y conseguir que acepten recibir cotización',
        opening_script: `Hola, buenos días. Soy Alejandro de GetLavado. Te llamo porque hace unos días conversamos sobre sus servicios de lavandería. ¿Tienes un momento para continuar la conversación?`,
        key_points: `- Recordarle la conversación anterior
- Preguntar si evaluaron la propuesta
- Ofrecer resolver dudas
- Insistir en enviar cotización sin compromiso
- Si dicen que ya tienen proveedor, preguntar si están 100% satisfechos`,
      };

    case 'interesado':
      return {
        call_type: 'CIERRE',
        call_objective: 'Cerrar la venta o conseguir una reunión presencial',
        opening_script: `Hola, buenos días. Soy Alejandro de GetLavado. Te llamo porque mostraste interés en nuestros servicios de lavandería industrial. ¿Recibiste la cotización que te enviamos?`,
        key_points: `- Confirmar que recibieron cotización
- Resolver objeciones de precio (mencionar ahorro de 30-40%)
- Ofrecer prueba gratuita de 1 semana
- Crear urgencia: "Tenemos cupo para nuevos clientes esta semana"
- Cerrar: "¿Cuándo podemos hacer la primera recogida?"`,
      };

    case 'cotizado':
      return {
        call_type: 'CIERRE URGENTE',
        call_objective: 'Cerrar la venta - ya tienen cotización',
        opening_script: `Hola, buenos días. Soy Alejandro de GetLavado. Te llamo para dar seguimiento a la cotización que te enviamos. ¿Tuvieron oportunidad de revisarla?`,
        key_points: `- Preguntar qué les pareció la cotización
- Resolver objeciones específicas
- Ofrecer mejora en precio si es necesario
- Prueba gratuita como último recurso
- Cierre directo: "¿Empezamos este lunes?"`,
      };

    default: // nuevo
      return {
        call_type: 'PRIMER CONTACTO',
        call_objective: 'Calificar el lead y conseguir que acepten recibir una cotización',
        opening_script: `Hola, buenos días. Mi nombre es Alejandro de GetLavado. ¿Me comunico con alguien del área administrativa?`,
        key_points: `- Preguntar si manejan lavandería interna o con proveedor
- Si tienen proveedor: preguntar si están satisfechos
- Detectar pain points (precio, calidad, demoras)
- Ofrecer cotización sin compromiso por WhatsApp
- Obtener nombre del contacto`,
      };
  }
}

export async function POST(request: Request) {
  try {
    const { businessId, phoneNumber, businessName, businessType, salesStage, contactCount, lastAICallSummary } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Número de teléfono requerido' }, { status: 400 });
    }

    // Formatear número para Perú si no tiene código de país
    let formattedNumber = phoneNumber.replace(/\D/g, '');
    if (!formattedNumber.startsWith('51') && formattedNumber.length === 9) {
      formattedNumber = '51' + formattedNumber;
    }
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = '+' + formattedNumber;
    }

    // Obtener contexto de llamada según el stage
    const callContext = getCallContext(salesStage, contactCount || 0, lastAICallSummary);

    // Hacer llamada via ElevenLabs
    const response = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY || '',
      },
      body: JSON.stringify({
        agent_id: ELEVENLABS_AGENT_ID,
        agent_phone_number_id: ELEVENLABS_PHONE_NUMBER_ID,
        to_number: formattedNumber,
        conversation_initiation_client_data: {
          dynamic_variables: {
            business_name: businessName || 'la empresa',
            business_type: businessType || 'negocio',
            // Nuevas variables para el contexto de la llamada
            call_type: callContext.call_type,
            call_objective: callContext.call_objective,
            opening_script: callContext.opening_script,
            key_points: callContext.key_points,
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('ElevenLabs API error:', data);
      return NextResponse.json({
        error: data.detail || 'Error al iniciar llamada',
        details: data
      }, { status: response.status });
    }

    // Guardar registro de llamada en la base de datos
    if (businessId) {
      await supabase.from('ai_calls').insert({
        business_id: businessId,
        phone_number: formattedNumber,
        conversation_id: data.conversation_id,
        call_sid: data.callSid,
        status: 'initiated',
        created_at: new Date().toISOString(),
      });

      // Actualizar último contacto
      await supabase
        .from('businesses')
        .update({
          contacted_at: new Date().toISOString(),
          contact_actions: supabase.rpc('array_append_unique', {
            arr: [],
            elem: 'ai_call'
          })
        })
        .eq('id', businessId);
    }

    return NextResponse.json({
      success: true,
      message: 'Llamada iniciada',
      conversation_id: data.conversation_id,
      call_sid: data.callSid,
    });
  } catch (error) {
    console.error('AI Call error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// GET: Obtener historial de llamadas
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    let query = supabase
      .from('ai_calls')
      .select('*')
      .order('created_at', { ascending: false });

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data: calls, error } = await query.limit(50);

    if (error) {
      console.error('Error fetching AI calls:', error);
      return NextResponse.json({ error: 'Error al obtener llamadas' }, { status: 500 });
    }

    return NextResponse.json({ calls: calls || [] });
  } catch (error) {
    console.error('AI Calls GET error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
