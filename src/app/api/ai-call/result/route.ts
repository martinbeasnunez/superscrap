import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

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

    // Extraer datos relevantes
    const transcript = conversation.transcript || '';
    const analysis = conversation.analysis || {};
    const status = conversation.status || 'unknown';
    const duration = conversation.metadata?.call_duration_secs || 0;

    // Determinar outcome basado en transcript
    const outcome = determineOutcome(transcript, analysis);

    // Generar resumen
    const summary = analysis.summary || generateSummary(transcript, outcome);

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      status,
      duration,
      transcript,
      summary,
      outcome,
      analysis,
    });
  } catch (error) {
    console.error('AI Call result error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
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

    // Extraer datos
    const transcript = conversation.transcript || '';
    const analysis = conversation.analysis || {};
    const status = conversation.status || 'completed';
    const duration = conversation.metadata?.call_duration_secs || 0;
    const outcome = determineOutcome(transcript, analysis);
    const summary = analysis.summary || generateSummary(transcript, outcome);

    // Actualizar registro de llamada si existe businessId
    if (businessId) {
      // Actualizar ai_calls si existe la tabla
      await supabase
        .from('ai_calls')
        .update({
          status,
          duration_seconds: duration,
          transcript,
          summary,
          outcome,
          updated_at: new Date().toISOString(),
        })
        .eq('conversation_id', conversationId);

      // Actualizar el lead según el outcome
      const updateData: Record<string, unknown> = {
        ai_call_summary: summary,
        ai_call_outcome: outcome,
        contacted_at: new Date().toISOString(),
      };

      // Mover a "interesado" si hay interés
      if (outcome === 'interested' || outcome === 'wants_quote') {
        updateData.sales_stage = 'interesado';
      } else if (outcome === 'not_interested') {
        updateData.sales_stage = 'perdido';
      }

      await supabase
        .from('businesses')
        .update(updateData)
        .eq('id', businessId);
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
