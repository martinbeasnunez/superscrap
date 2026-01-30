import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Webhook que ElevenLabs llama cuando termina la conversación
export async function POST(request: Request) {
  try {
    const data = await request.json();

    console.log('ElevenLabs webhook received:', JSON.stringify(data, null, 2));

    const {
      conversation_id,
      status,
      transcript,
      analysis,
      metadata,
      call_duration_secs,
    } = data;

    if (!conversation_id) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

    // Extraer insights del análisis si existe
    const summary = analysis?.summary || null;
    const outcome = analysis?.outcome || determineOutcome(transcript);
    const extractedData = analysis?.data_collection || {};

    // Actualizar el registro de la llamada
    const { error: updateError } = await supabase
      .from('ai_calls')
      .update({
        status: status || 'completed',
        duration_seconds: call_duration_secs,
        transcript: transcript,
        summary: summary,
        outcome: outcome,
        extracted_data: extractedData,
        updated_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversation_id);

    if (updateError) {
      console.error('Error updating ai_call:', updateError);
    }

    // Si hay outcome positivo, actualizar el lead
    if (outcome === 'interested' || outcome === 'wants_quote') {
      // Buscar el business_id de esta llamada
      const { data: callData } = await supabase
        .from('ai_calls')
        .select('business_id')
        .eq('conversation_id', conversation_id)
        .single();

      if (callData?.business_id) {
        await supabase
          .from('businesses')
          .update({
            sales_stage: 'interesado',
            ai_call_summary: summary,
            ai_call_outcome: outcome,
          })
          .eq('id', callData.business_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Determinar outcome basado en el transcript
function determineOutcome(transcript: string | null): string {
  if (!transcript) return 'no_answer';

  const lower = transcript.toLowerCase();

  if (lower.includes('no me interesa') || lower.includes('no gracias') || lower.includes('no estamos interesados')) {
    return 'not_interested';
  }
  if (lower.includes('envíame') || lower.includes('mándame') || lower.includes('cotización') || lower.includes('presupuesto')) {
    return 'wants_quote';
  }
  if (lower.includes('sí') || lower.includes('interesa') || lower.includes('cuéntame más')) {
    return 'interested';
  }
  if (lower.includes('llámame') || lower.includes('después') || lower.includes('otro momento')) {
    return 'callback';
  }

  return 'completed';
}

// GET para verificar que el webhook está activo
export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'ElevenLabs webhook endpoint ready'
  });
}
