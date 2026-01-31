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
    const outcome = analysis?.outcome || determineOutcome(transcript, summary);
    const extractedData = analysis?.data_collection || {};

    // Si es buzón de voz, no hacer nada especial (no mover el lead)
    const isVoicemailCall = isVoicemail(transcript, summary);
    if (isVoicemailCall) {
      console.log('Voicemail detected for conversation:', conversation_id);
    }

    // Determinar outcome final (voicemail tiene prioridad)
    const finalOutcomeForDB = isVoicemailCall ? 'voicemail' : outcome;

    // Actualizar el registro de la llamada
    const { error: updateError } = await supabase
      .from('ai_calls')
      .update({
        status: status || 'completed',
        duration_seconds: call_duration_secs,
        transcript: transcript,
        summary: summary,
        outcome: finalOutcomeForDB,
        extracted_data: extractedData,
        updated_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversation_id);

    if (updateError) {
      console.error('Error updating ai_call:', updateError);
    }

    // Determinar el outcome final - forzar voicemail si fue detectado
    const finalOutcome = isVoicemailCall ? 'voicemail' : outcome;

    // Si hay outcome positivo Y NO es voicemail, actualizar el lead
    // El voicemail NO cuenta como interesado - es pérdida de tiempo
    if ((finalOutcome === 'interested' || finalOutcome === 'wants_quote') && !isVoicemailCall) {
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

// Detectar si es buzón de voz / voicemail
function isVoicemail(transcript: string | null, summary: string | null): boolean {
  const textToCheck = ((transcript || '') + ' ' + (summary || '')).toLowerCase();

  // Patrones comunes de buzón de voz en español e inglés
  const voicemailPatterns = [
    // Español
    'buzón de voz',
    'buzon de voz',
    'casilla de voz',
    'deje su mensaje',
    'deja tu mensaje',
    'después del tono',
    'despues del tono',
    'mensaje de voz',
    'correo de voz',
    'grabar mensaje',
    'mensaje después',
    'mensaje despues',
    'no está disponible',
    'no esta disponible',
    'centro de atención al cliente',
    'centro de atencion al cliente',
    'sistema de mensajes',
    'sistema automatizado',
    'marque el',
    'presione el',
    'oprima el',
    'fuera de servicio',
    'horario de atención',
    'horario de atencion',
    // Inglés (por si el summary viene en inglés)
    'voicemail',
    'leave a message',
    'leave your message',
    'not available',
    'mailbox',
    'automated voice',
    'automated system',
    'messaging system',
    'voice prompts',
    'press 1',
    'press 2',
    'dial',
    'menu options',
    'no initial response',
    'receives no initial response',
    'no response',
    // Otros indicadores
    'entelev',
    'beep',
    'tone',
    'ivr',
    'pbx',
  ];

  return voicemailPatterns.some(pattern => textToCheck.includes(pattern));
}

// Determinar outcome basado en el transcript
function determineOutcome(transcript: string | null, summary: string | null = null): string {
  // Primero verificar si es buzón de voz - esto tiene prioridad
  if (isVoicemail(transcript, summary)) {
    return 'voicemail';
  }

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
