import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Tipo para mensajes del transcript de ElevenLabs
interface TranscriptMessage {
  role: string;
  message: string;
  time_in_call_secs?: number;
}

// Convertir array de transcript a string legible
function transcriptToString(transcript: TranscriptMessage[] | string): string {
  if (typeof transcript === 'string') return transcript;
  if (!Array.isArray(transcript)) return '';

  return transcript
    .map((msg) => `${msg.role === 'agent' ? 'Agente' : 'Cliente'}: ${msg.message}`)
    .join('\n');
}

// GET: Consultar resultado de una conversación de ElevenLabs
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId requerido' }, { status: 400 });
    }

    // Consultar ElevenLabs por los detalles de la conversación
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY || '',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('ElevenLabs conversation error:', error);
      return NextResponse.json({ error: 'Error al obtener conversación' }, { status: response.status });
    }

    const conversation = await response.json();
    console.log('ElevenLabs conversation response:', JSON.stringify(conversation, null, 2));

    // Extraer datos relevantes - formato correcto de ElevenLabs
    const transcriptArray = conversation.transcript || [];
    const transcriptString = transcriptToString(transcriptArray);
    const analysis = conversation.analysis || {};
    const status = conversation.status || 'unknown';
    const duration = conversation.metadata?.call_duration_secs || 0;

    // ElevenLabs usa call_successful y transcript_summary
    const callSuccessful = analysis.call_successful || conversation.call_successful;

    // Determinar outcome basado en análisis de ElevenLabs
    const outcome = determineOutcomeFromAnalysis(analysis, transcriptString, callSuccessful);

    // El summary viene en transcript_summary o evaluation_criteria_results
    const summary = analysis.transcript_summary ||
                   analysis.summary ||
                   generateSummary(transcriptString, outcome);

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      status,
      duration,
      transcript: transcriptString,
      summary,
      outcome,
      call_successful: callSuccessful,
      analysis,
    });
  } catch (error) {
    console.error('AI Call result error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Determinar outcome basado en el análisis de ElevenLabs
function determineOutcomeFromAnalysis(
  analysis: Record<string, unknown>,
  transcript: string,
  callSuccessful: string | undefined
): string {
  // Si ElevenLabs dice que fue exitosa, es interesado
  if (callSuccessful === 'success') {
    // Verificar si pidió cotización específicamente
    const lower = transcript.toLowerCase();
    if (lower.includes('cotización') || lower.includes('presupuesto') || lower.includes('whatsapp')) {
      return 'wants_quote';
    }
    return 'interested';
  }

  if (callSuccessful === 'failure') {
    return 'not_interested';
  }

  // Fallback al análisis por transcript
  return determineOutcome(transcript, analysis);
}

// POST: Guardar resultado y actualizar lead
export async function POST(request: Request) {
  try {
    const { conversationId, businessId } = await request.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId requerido' }, { status: 400 });
    }

    // Consultar ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY || '',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Conversación no encontrada o aún en progreso' }, { status: 404 });
    }

    const conversation = await response.json();
    console.log('ElevenLabs POST conversation:', JSON.stringify(conversation, null, 2));

    // Extraer datos - formato correcto de ElevenLabs
    const transcriptArray = conversation.transcript || [];
    const transcript = transcriptToString(transcriptArray);
    const analysis = conversation.analysis || {};
    const status = conversation.status || 'completed';
    const duration = conversation.metadata?.call_duration_secs || 0;
    const callSuccessful = analysis.call_successful || conversation.call_successful;
    const outcome = determineOutcomeFromAnalysis(analysis, transcript, callSuccessful);
    const summary = analysis.transcript_summary ||
                   analysis.summary ||
                   generateSummary(transcript, outcome);

    // Actualizar registro si existe businessId
    if (businessId) {
      // Generar insights en español para el vendedor
      const salesInsights = generateSalesInsights(transcript, outcome, summary);

      // Guardar en contact_history como llamada (con nota de que fue IA)
      const aiCallNote = `🤖 LLAMADA IA (${duration}s)\n\nResultado: ${
        outcome === 'wants_quote' ? '💰 ¡QUIERE COTIZACIÓN!' :
        outcome === 'interested' ? '🎯 INTERESADO' :
        outcome === 'not_interested' ? '❌ No interesado' :
        outcome === 'callback' ? '📅 Llamar después' : '📞 Completada'
      }\n\n${salesInsights}`;

      const { error: insertError } = await supabase
        .from('contact_history')
        .insert({
          business_id: businessId,
          action_type: 'call', // Usamos 'call' porque contact_history tiene check constraint
          notes: aiCallNote,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error inserting contact_history:', insertError);
      }

      // Actualizar sales_stage del lead según outcome
      const updateData: Record<string, unknown> = {
        contacted_at: new Date().toISOString(),
      };

      // Mover a "interesado" si hay interés
      if (outcome === 'interested' || outcome === 'wants_quote') {
        updateData.sales_stage = 'interesado';
      } else if (outcome === 'not_interested') {
        updateData.sales_stage = 'perdido';
      }

      const { error } = await supabase
        .from('businesses')
        .update(updateData)
        .eq('id', businessId);

      if (error) {
        console.error('Error updating business:', error);
      }
    }

    return NextResponse.json({
      success: true,
      outcome,
      summary,
      status,
      duration,
      salesStageUpdated: outcome === 'interested' || outcome === 'wants_quote' || outcome === 'not_interested',
    });
  } catch (error) {
    console.error('AI Call result POST error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Determinar outcome basado en transcript y análisis
function determineOutcome(transcript: string, analysis: Record<string, unknown>): string {
  // Si ElevenLabs ya determinó outcome, usarlo
  if (analysis.outcome) {
    return analysis.outcome as string;
  }

  if (!transcript) return 'no_answer';

  const lower = transcript.toLowerCase();

  // Detectar rechazo
  if (
    lower.includes('no me interesa') ||
    lower.includes('no gracias') ||
    lower.includes('no estamos interesados') ||
    lower.includes('no necesitamos') ||
    lower.includes('ya tenemos proveedor') && lower.includes('contentos')
  ) {
    return 'not_interested';
  }

  // Detectar interés en cotización
  if (
    lower.includes('envíame') ||
    lower.includes('mándame') ||
    lower.includes('cotización') ||
    lower.includes('presupuesto') ||
    lower.includes('cuánto cuesta') ||
    lower.includes('precios')
  ) {
    return 'wants_quote';
  }

  // Detectar interés general
  if (
    lower.includes('sí me interesa') ||
    lower.includes('cuéntame más') ||
    lower.includes('cómo funciona') ||
    lower.includes('qué ofrecen')
  ) {
    return 'interested';
  }

  // Detectar callback
  if (
    lower.includes('llámame') ||
    lower.includes('después') ||
    lower.includes('otro momento') ||
    lower.includes('no puedo ahora') ||
    lower.includes('estoy ocupado')
  ) {
    return 'callback';
  }

  return 'completed';
}

// Generar insights en español para el vendedor
function generateSalesInsights(transcript: string, outcome: string, englishSummary: string): string {
  const lower = transcript.toLowerCase();
  const insights: string[] = [];

  // Extraer solo lo que dijo el cliente (líneas que empiezan con "Cliente:")
  const clientLines = transcript
    .split('\n')
    .filter(line => line.startsWith('Cliente:'))
    .join('\n')
    .toLowerCase();

  // Detectar nombre del contacto (en lo que dijo el cliente)
  const nameMatch = clientLines.match(/(?:mi nombre es|me llamo|soy)\s+([a-záéíóú]+)/i);
  if (nameMatch) {
    // Capitalizar primera letra
    const name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
    insights.push(`👤 Contacto: ${name}`);
  } else {
    // Intentar extraer del resumen en inglés
    const englishNameMatch = englishSummary.match(/contacted\s+([A-Za-z]+)/i);
    if (englishNameMatch && englishNameMatch[1] !== 'Alejandro') {
      insights.push(`👤 Contacto: ${englishNameMatch[1]}`);
    }
  }

  // Detectar si tienen proveedor actual
  if (lower.includes('proveedor') || lower.includes('ya tenemos') || lower.includes('trabajamos con')) {
    if (lower.includes('no estoy contento') || lower.includes('no estamos contentos') ||
        lower.includes('problemas') || lower.includes('mal servicio') || lower.includes('insatisfecho')) {
      insights.push(`🔥 OPORTUNIDAD: Insatisfecho con proveedor actual`);
    } else if (lower.includes('contento') || lower.includes('bien')) {
      insights.push(`⚠️ Tiene proveedor pero mostró apertura`);
    } else {
      insights.push(`📋 Ya tiene proveedor de lavandería`);
    }
  }

  // Detectar precio/costo mencionado
  const priceMatch = transcript.match(/(\d+(?:[.,]\d+)?)\s*(?:soles|sol|s\/\.?|pen)/i);
  if (priceMatch) {
    insights.push(`💵 Precio actual: S/${priceMatch[1]} por kilo`);
  }

  // Detectar pain points específicos
  if (lower.includes('mancha') || lower.includes('manchas')) {
    insights.push(`🎯 Pain point: Problemas con manchas`);
  }
  if (lower.includes('demora') || lower.includes('retraso') || lower.includes('tarde')) {
    insights.push(`🎯 Pain point: Demoras en entrega`);
  }
  if (lower.includes('caro') || lower.includes('costoso') || lower.includes('precio alto')) {
    insights.push(`🎯 Pain point: Precio alto actual`);
  }

  // Acción recomendada según outcome
  if (outcome === 'wants_quote') {
    insights.push(`\n⚡ ACCIÓN: Enviar cotización por WhatsApp AHORA`);
  } else if (outcome === 'interested') {
    insights.push(`\n⚡ ACCIÓN: Hacer seguimiento en 24h`);
  } else if (outcome === 'callback') {
    insights.push(`\n⚡ ACCIÓN: Reprogramar llamada`);
  } else if (outcome === 'not_interested') {
    insights.push(`\n📝 Nota: Guardar para recontactar en 3 meses`);
  }

  // Si no encontramos insights específicos, dar un resumen general
  if (insights.length === 0) {
    return `📝 Llamada completada. Revisar grabación para más detalles.`;
  }

  return insights.join('\n');
}

// Generar resumen básico
function generateSummary(transcript: string, outcome: string): string {
  const outcomeLabels: Record<string, string> = {
    interested: 'El contacto mostró interés en los servicios.',
    wants_quote: 'El contacto solicitó una cotización.',
    not_interested: 'El contacto no mostró interés.',
    callback: 'El contacto pidió que lo llamen en otro momento.',
    no_answer: 'No se pudo establecer comunicación.',
    completed: 'Llamada completada.',
  };

  return outcomeLabels[outcome] || 'Llamada procesada.';
}
