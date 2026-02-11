import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// Agent ID y Phone Number ID de ElevenLabs (configurable via env vars)
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || '955wp4k1';
const ELEVENLABS_PHONE_NUMBER_ID = process.env.ELEVENLABS_PHONE_NUMBER_ID || 'phnum_6101kg6k9e1kewdv2vf5rqpv99h6';

// Generar contexto de llamada según el stage del lead y número de contactos
function getCallContext(salesStage: string | null, contactCount: number, lastContactInfo?: string): {
  call_type: string;
  call_objective: string;
  opening_script: string;
  key_points: string;
} {
  const stage = salesStage || 'nuevo';
  const contacts = contactCount || 0;

  console.log('[getCallContext] Input - salesStage:', salesStage, '| contactCount:', contacts, '| resolved stage:', stage);

  // SEGUIMIENTO 3 / ÚLTIMO INTENTO - Tiene prioridad sobre el conteo de contactos
  // Este es el pitch más importante - debe ser directo pero amigable
  if (stage === 'seguimiento_3') {
    console.log('[getCallContext] Using ÚLTIMO INTENTO pitch for seguimiento_3');
    return {
      call_type: 'ÚLTIMO INTENTO',
      call_objective: 'Cerrar el tema: obtener un sí o no definitivo. No presionar, ser amigable.',
      opening_script: `Hola! Soy Alejandro de GetLavado. Te he escrito varias veces sobre lavandería industrial. Sé que están super ocupados, así que seré muy breve: ¿les interesa que les envíe una cotización? O prefieren que los contacte en otro momento? Un sí o un no me ayuda mucho.`,
      key_points: `- CRÍTICO: Este es el ÚLTIMO INTENTO, ser muy breve
- Aceptar CUALQUIER respuesta inmediatamente sin insistir
- Si dicen "no" o "no me interesa": agradecer y despedirse cordialmente, NO insistir
- Si dicen "quizás" o "después": preguntar cuándo sería mejor momento y despedirse
- Si dicen "sí": preguntar qué tipo de textiles manejan y ofrecer enviar cotización por WhatsApp
- Tono amable y ligero, NUNCA frustrado o insistente
- NO hacer pitch largo, ir directo al grano`,
    };
  }

  // Si tiene 5+ contactos, usar pitch de último intento sin importar el stage
  if (contacts >= 5 && !['interesado', 'cotizado', 'cliente'].includes(stage)) {
    console.log('[getCallContext] Using ÚLTIMO CONTACTO pitch (5+ contacts)');
    return {
      call_type: 'ÚLTIMO CONTACTO (MÚLTIPLES INTENTOS)',
      call_objective: 'Obtener respuesta definitiva después de varios intentos. No presionar.',
      opening_script: `Hola! Soy Alejandro de GetLavado. Te he contactado varias veces sobre lavandería industrial. Sé que estás muy ocupado, así que seré muy breve: ¿les interesa o prefieren que no los contacte más?`,
      key_points: `- Ser MUY breve, ya lo han contactado muchas veces
- Aceptar cualquier respuesta inmediatamente
- Si dicen "no": agradecer y despedirse sin insistir
- Si dicen "quizás": preguntar cuándo llamar, no insistir ahora
- Este es definitivamente el último intento
- Mantener tono amable, no frustrado`,
    };
  }

  // Si tiene 3-4 contactos, ser más directo
  if (contacts >= 3 && !['interesado', 'cotizado', 'cliente'].includes(stage)) {
    console.log('[getCallContext] Using SEGUIMIENTO DIRECTO pitch (3-4 contacts)');
    return {
      call_type: 'SEGUIMIENTO DIRECTO',
      call_objective: 'Conseguir respuesta clara después de varios contactos.',
      opening_script: `Hola! Soy Alejandro de GetLavado. Te he escrito un par de veces sobre lavandería industrial. Solo quería confirmar: ¿les interesa recibir una cotización o ya tienen proveedor?`,
      key_points: `- Ir directo al punto, ya hubo contactos previos
- Preguntar si tienen proveedor actual
- Si dicen que sí tienen: preguntar si están satisfechos
- Ofrecer cotización comparativa
- No extender mucho la llamada`,
    };
  }

  console.log('[getCallContext] Using switch case for stage:', stage);

  switch (stage) {

    case 'seguimiento_2':
      // Urgente pero no desesperado
      return {
        call_type: 'SEGUIMIENTO URGENTE',
        call_objective: 'Conseguir respuesta antes de que el lead se enfríe completamente',
        opening_script: `Hola, buenos días. Soy Alejandro de GetLavado. Te había escrito hace unos días sobre lavandería industrial. Solo quería saber si tuvieron chance de revisar la propuesta.`,
        key_points: `- Preguntar directamente si les interesa o no
- Si ya tienen proveedor: preguntar si están satisfechos
- Ofrecer cotización comparativa sin compromiso
- No ser insistente, pero sí claro
- Si no hay interés, agradecer y cerrar amablemente`,
      };

    case 'contactado':
    case 'seguimiento_1':
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

    console.log('=== AI CALL REQUEST ===');
    console.log('businessId:', businessId);
    console.log('businessName:', businessName);
    console.log('salesStage:', salesStage);
    console.log('contactCount:', contactCount);
    console.log('========================');

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

    console.log('=== CALL CONTEXT SELECTED ===');
    console.log('call_type:', callContext.call_type);
    console.log('opening_script:', callContext.opening_script.substring(0, 100) + '...');
    console.log('=============================');

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
            // Contexto de la llamada según el stage
            call_type: callContext.call_type,
            call_objective: callContext.call_objective,
            opening_script: callContext.opening_script,
            key_points: callContext.key_points,
            // Instrucciones especiales
            silence_instruction: 'Si el cliente guarda silencio por más de 30 segundos, despídete amablemente.',
            voicemail_instruction: 'CRÍTICO - BUZÓN DE VOZ: Si detectas CUALQUIERA de estos indicadores, CUELGA INMEDIATAMENTE: 1) Escuchas "deje su mensaje", "después del tono", "no está disponible", "voicemail", "buzón de voz", "centro de atención", "presione 1", "marque el" 2) Escuchas solo tonos o música de espera por más de 10 segundos 3) Escuchas una voz grabada/automatizada 4) No hay respuesta humana real. NO dejes mensaje, NO intentes hablar con el sistema, simplemente CUELGA.',
            language_instruction: 'IMPORTANTE: Toda la conversación y el análisis debe ser en ESPAÑOL. El summary y las conclusiones deben estar en español.',
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
