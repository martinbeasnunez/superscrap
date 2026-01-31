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
      call_duration_secs,
    } = data;

    if (!conversation_id) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

    // Extraer insights del análisis si existe
    const extractedData = analysis?.data_collection || {};
    const rawSummary = extractedData?.summary_es || analysis?.summary || null;
    const outcomeFromEL = extractedData?.call_outcome || analysis?.outcome;
    const contactName = extractedData?.contact_name || null;

    // ANTI-ALUCINACIÓN: Analizar el transcript real para validar
    const validation = validateTranscript(transcript, call_duration_secs);

    // Determinar outcome REAL basado en validación estricta
    const realOutcome = determineRealOutcome(transcript, outcomeFromEL, validation);

    // Generar summary REAL (sin inventos)
    const realSummary = generateRealSummary(transcript, validation, rawSummary);

    console.log('Validation result:', validation);
    console.log('Real outcome:', realOutcome);

    // Actualizar el registro de la llamada
    const { error: updateError } = await supabase
      .from('ai_calls')
      .update({
        status: status || 'completed',
        duration_seconds: call_duration_secs,
        transcript: transcript,
        summary: realSummary,
        outcome: realOutcome,
        extracted_data: {
          ...extractedData,
          validation: validation,
          original_outcome: outcomeFromEL,
          original_summary: rawSummary,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversation_id);

    if (updateError) {
      console.error('Error updating ai_call:', updateError);
    }

    // SOLO mover a interesado si hay evidencia REAL de interés
    if (realOutcome === 'interested' || realOutcome === 'wants_quote') {
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
            ai_call_summary: realSummary,
            ai_call_outcome: realOutcome,
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

// Validación estricta del transcript
interface TranscriptValidation {
  hasRealConversation: boolean;
  isVoicemail: boolean;
  isShortCall: boolean;
  isHangup: boolean;
  customerWordCount: number;
  customerSaidInterest: boolean;
  customerSaidNo: boolean;
  customerAskedQuote: boolean;
  customerAskedCallback: boolean;
  reason: string;
}

function validateTranscript(transcript: string | null, durationSecs: number | null): TranscriptValidation {
  const result: TranscriptValidation = {
    hasRealConversation: false,
    isVoicemail: false,
    isShortCall: false,
    isHangup: false,
    customerWordCount: 0,
    customerSaidInterest: false,
    customerSaidNo: false,
    customerAskedQuote: false,
    customerAskedCallback: false,
    reason: '',
  };

  // Sin transcript = no contestó
  if (!transcript || transcript.trim() === '') {
    result.reason = 'Sin transcript';
    return result;
  }

  const lower = transcript.toLowerCase();

  // Detectar voicemail
  if (isVoicemail(transcript, null)) {
    result.isVoicemail = true;
    result.reason = 'Buzón de voz detectado';
    return result;
  }

  // Llamada muy corta (menos de 15 segundos) = probablemente cortaron
  if (durationSecs && durationSecs < 15) {
    result.isShortCall = true;
    result.reason = 'Llamada muy corta (<15s)';
  }

  // Extraer lo que dijo el cliente (buscar patrones de respuesta)
  // Los transcripts suelen tener formato "Agent: ... User: ..."
  const customerResponses = extractCustomerResponses(transcript);
  result.customerWordCount = customerResponses.split(/\s+/).filter(w => w.length > 0).length;

  // Si el cliente dijo muy poco (menos de 5 palabras útiles) = no hubo conversación real
  if (result.customerWordCount < 5) {
    result.isHangup = true;
    result.reason = `Cliente dijo muy poco (${result.customerWordCount} palabras)`;
  }

  // Buscar señales REALES de interés en lo que dijo el CLIENTE
  const customerLower = customerResponses.toLowerCase();

  // Palabras que indican interés REAL
  const interestSignals = [
    'sí me interesa', 'si me interesa',
    'cuéntame más', 'cuentame mas',
    'qué servicios', 'que servicios',
    'cómo funciona', 'como funciona',
    'cuánto cuesta', 'cuanto cuesta',
    'envíame información', 'enviame informacion',
    'mándame', 'mandame',
    'dame tu whatsapp', 'pásame', 'pasame',
    'estamos buscando', 'necesitamos',
    'qué ofrecen', 'que ofrecen',
  ];

  // Palabras que indican rechazo
  const rejectionSignals = [
    'no me interesa', 'no gracias', 'no necesitamos',
    'ya tenemos', 'estamos bien',
    'no estamos interesados', 'no es para nosotros',
    'no llamar', 'no vuelvas a llamar',
  ];

  // Palabras que indican cotización
  const quoteSignals = [
    'cotización', 'cotizacion', 'presupuesto',
    'precio', 'cuánto cobran', 'cuanto cobran',
    'envíame la información', 'enviame la informacion',
    'mándame por whatsapp', 'mandame por whatsapp',
  ];

  // Palabras que indican callback
  const callbackSignals = [
    'llámame después', 'llamame despues',
    'otro momento', 'más tarde', 'mas tarde',
    'estoy ocupado', 'estoy en reunión', 'estoy en reunion',
    'ahora no puedo',
  ];

  result.customerSaidInterest = interestSignals.some(s => customerLower.includes(s));
  result.customerSaidNo = rejectionSignals.some(s => customerLower.includes(s));
  result.customerAskedQuote = quoteSignals.some(s => customerLower.includes(s));
  result.customerAskedCallback = callbackSignals.some(s => customerLower.includes(s));

  // Determinar si hubo conversación real
  result.hasRealConversation = result.customerWordCount >= 10 && !result.isShortCall && !result.isHangup;

  if (!result.reason) {
    result.reason = result.hasRealConversation ? 'Conversación válida' : 'Conversación insuficiente';
  }

  return result;
}

// Extraer solo las respuestas del cliente del transcript
function extractCustomerResponses(transcript: string): string {
  // Intentar varios formatos de transcript
  const lines = transcript.split('\n');
  const customerLines: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    // Buscar líneas que son del usuario/cliente
    if (lower.startsWith('user:') || lower.startsWith('cliente:') || lower.startsWith('customer:')) {
      customerLines.push(line.replace(/^(user|cliente|customer):\s*/i, ''));
    }
  }

  // Si no hay formato estructurado, intentar detectar de otra forma
  if (customerLines.length === 0) {
    // Asumir que las respuestas cortas después de "?" son del cliente
    return transcript;
  }

  return customerLines.join(' ');
}

// Determinar el outcome REAL basado en evidencia
function determineRealOutcome(
  transcript: string | null,
  aiOutcome: string | null,
  validation: TranscriptValidation
): string {
  // Voicemail tiene prioridad absoluta
  if (validation.isVoicemail) {
    return 'voicemail';
  }

  // Sin transcript = no answer
  if (!transcript || transcript.trim() === '') {
    return 'no_answer';
  }

  // Llamada muy corta sin conversación real = el cliente cortó
  if (validation.isShortCall && !validation.hasRealConversation) {
    return 'no_answer';
  }

  // Cliente dijo muy poco = probablemente cortó o no le interesó
  if (validation.isHangup && !validation.customerSaidInterest) {
    return 'not_interested';
  }

  // Evidencia REAL de rechazo
  if (validation.customerSaidNo) {
    return 'not_interested';
  }

  // Evidencia REAL de querer cotización
  if (validation.customerAskedQuote) {
    return 'wants_quote';
  }

  // Evidencia REAL de interés
  if (validation.customerSaidInterest && validation.hasRealConversation) {
    return 'interested';
  }

  // Quiere que lo llamen después
  if (validation.customerAskedCallback) {
    return 'callback';
  }

  // Si la IA dice interested pero NO hay evidencia real, degradar a 'completed'
  if (aiOutcome === 'interested' || aiOutcome === 'wants_quote') {
    if (!validation.hasRealConversation || validation.customerWordCount < 15) {
      console.log('ANTI-ALUCINACIÓN: IA dijo interested pero no hay evidencia real');
      return 'completed';
    }
  }

  // Confiar en la IA solo si hubo conversación real
  if (validation.hasRealConversation && aiOutcome) {
    return aiOutcome;
  }

  return 'completed';
}

// Generar summary REAL sin inventos
function generateRealSummary(
  transcript: string | null,
  validation: TranscriptValidation,
  aiSummary: string | null
): string {
  // Voicemail
  if (validation.isVoicemail) {
    return 'Buzón de voz - no se pudo contactar con una persona.';
  }

  // No answer
  if (!transcript || transcript.trim() === '') {
    return 'No se pudo establecer contacto.';
  }

  // Llamada muy corta
  if (validation.isShortCall && !validation.hasRealConversation) {
    return 'Llamada muy corta. El cliente cortó antes de poder conversar.';
  }

  // Cliente cortó rápido
  if (validation.isHangup) {
    return `Conversación breve (${validation.customerWordCount} palabras). El cliente no mostró interés.`;
  }

  // Rechazo
  if (validation.customerSaidNo) {
    return 'El cliente indicó que no está interesado.';
  }

  // Si la conversación fue real y el summary de IA parece razonable, usarlo
  // pero solo si no parece alucinación
  if (validation.hasRealConversation && aiSummary) {
    // Detectar posibles alucinaciones en el summary
    const suspiciousPatterns = [
      'pain point',
      'ya tiene proveedor', // solo si el cliente NO lo dijo explícitamente
      'demoras en entrega', // solo si el cliente NO lo dijo
      'problemas con',
    ];

    const hasSuspiciousContent = suspiciousPatterns.some(p =>
      aiSummary.toLowerCase().includes(p) &&
      !transcript?.toLowerCase().includes(p)
    );

    if (!hasSuspiciousContent) {
      return aiSummary;
    } else {
      console.log('ANTI-ALUCINACIÓN: Summary sospechoso detectado, generando alternativo');
    }
  }

  // Generar summary genérico basado en outcome
  if (validation.customerAskedQuote) {
    return 'El cliente solicitó información sobre precios/cotización.';
  }

  if (validation.customerSaidInterest) {
    return 'El cliente mostró interés en conocer más sobre los servicios.';
  }

  if (validation.customerAskedCallback) {
    return 'El cliente pidió que lo contacten en otro momento.';
  }

  return 'Llamada completada. Se presentó el servicio al cliente.';
}

// Detectar si es buzón de voz / voicemail
function isVoicemail(transcript: string | null, summary: string | null): boolean {
  const textToCheck = ((transcript || '') + ' ' + (summary || '')).toLowerCase();

  const voicemailPatterns = [
    'buzón de voz', 'buzon de voz', 'casilla de voz',
    'deje su mensaje', 'deja tu mensaje',
    'después del tono', 'despues del tono',
    'mensaje de voz', 'correo de voz',
    'grabar mensaje', 'mensaje después', 'mensaje despues',
    'no está disponible', 'no esta disponible',
    'centro de atención al cliente', 'centro de atencion al cliente',
    'sistema de mensajes', 'sistema automatizado',
    'marque el', 'presione el', 'oprima el',
    'fuera de servicio', 'horario de atención', 'horario de atencion',
    'voicemail', 'leave a message', 'leave your message',
    'not available', 'mailbox', 'automated voice', 'automated system',
    'messaging system', 'voice prompts',
    'press 1', 'press 2', 'dial', 'menu options',
    'no initial response', 'receives no initial response', 'no response',
    'entelev', 'beep', 'tone', 'ivr', 'pbx',
  ];

  return voicemailPatterns.some(pattern => textToCheck.includes(pattern));
}

// GET para verificar que el webhook está activo
export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'ElevenLabs webhook endpoint ready (with anti-hallucination)'
  });
}
