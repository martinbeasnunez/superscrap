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
    const { conversationId, businessId, forceUpdate } = await request.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId requerido' }, { status: 400 });
    }

    console.log('=== AI Call Result POST ===');
    console.log('conversationId:', conversationId);
    console.log('businessId:', businessId);
    console.log('forceUpdate:', forceUpdate);

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
    console.log('=== ElevenLabs POST conversation ===');
    console.log('Status:', conversation.status);
    console.log('Transcript array length:', conversation.transcript?.length || 0);
    console.log('Transcript raw:', JSON.stringify(conversation.transcript, null, 2));
    console.log('Analysis:', JSON.stringify(conversation.analysis, null, 2));
    console.log('Metadata:', JSON.stringify(conversation.metadata, null, 2));

    // IMPORTANTE: Verificar que la conversación esté terminada
    const status = conversation.status || 'unknown';
    const isComplete = status === 'done' || status === 'completed' || status === 'ended';

    // Si la conversación no está completa, no guardar aún
    if (!isComplete) {
      console.log('Conversation not complete yet, status:', status);
      return NextResponse.json({
        success: false,
        status,
        message: 'Conversación aún en progreso',
      });
    }

    // Verificar que haya datos útiles
    const hasTranscript = conversation.transcript && conversation.transcript.length > 0;
    const rawSummary = conversation.analysis?.transcript_summary || '';
    const hasSummary = rawSummary.length > 20; // Mínimo 20 chars para ser un resumen real
    const duration = conversation.metadata?.call_duration_secs || 0;

    console.log('=== VERIFICACIÓN DE DATOS ===');
    console.log('Has transcript:', hasTranscript, '- length:', conversation.transcript?.length || 0);
    console.log('Raw summary:', rawSummary);
    console.log('Raw summary length:', rawSummary.length);
    console.log('Has summary (>20 chars):', hasSummary);
    console.log('Duration:', duration);

    // ============================================================
    // VALIDACIÓN CRÍTICA: NO GUARDAR SIN RESUMEN REAL
    // ============================================================
    // Si la llamada duró más de 5 segundos, DEBE tener transcript_summary
    // de ElevenLabs con al menos 20 caracteres. Si no, seguir esperando.
    if (duration > 5 && !hasSummary) {
      console.log('🚫 BLOCKING: Call had duration but NO VALID SUMMARY yet');
      console.log('🚫 Summary length:', rawSummary.length, '(need >20)');
      console.log('🚫 Waiting for ElevenLabs to finish processing...');
      return NextResponse.json({
        success: false,
        status: 'processing',
        message: 'Conversación aún en progreso',
      });
    }

    // SEGUNDA VALIDACIÓN: Si hay transcript con mensajes del cliente, DEBE haber summary
    const clientMsgCount = (conversation.transcript || []).filter(
      (msg: TranscriptMessage) => msg.role === 'user' || msg.role === 'customer' || msg.role === 'human'
    ).length;

    if (clientMsgCount > 0 && !hasSummary) {
      console.log('🚫 BLOCKING: Client spoke but NO VALID SUMMARY yet');
      console.log('🚫 Client messages:', clientMsgCount);
      console.log('🚫 Waiting for ElevenLabs to finish processing...');
      return NextResponse.json({
        success: false,
        status: 'processing',
        message: 'Conversación aún en progreso',
      });
    }

    // Extraer datos - formato correcto de ElevenLabs
    const transcriptArray = conversation.transcript || [];
    const transcript = transcriptToString(transcriptArray);
    console.log('Transcript string:', transcript);
    console.log('Transcript string length:', transcript.length);

    const analysis = conversation.analysis || {};
    // duration ya se extrajo arriba
    const callSuccessful = analysis.call_successful || conversation.call_successful;
    console.log('Call successful:', callSuccessful);

    // Detectar error de cuota de ElevenLabs
    const errorMessage = conversation.metadata?.termination_reason ||
                        conversation.metadata?.error ||
                        analysis.error_message ||
                        '';
    const isQuotaError = errorMessage.toLowerCase().includes('quota') ||
                        errorMessage.toLowerCase().includes('limit') ||
                        errorMessage.toLowerCase().includes('exceed') ||
                        callSuccessful === 'failure';
    console.log('Error message:', errorMessage);
    console.log('Is quota/failure error:', isQuotaError);

    // Contar mensajes del cliente (no del agente)
    // ElevenLabs usa 'user' para el cliente en llamadas telefónicas
    const clientMessages = transcriptArray.filter((msg: TranscriptMessage) =>
      msg.role === 'user' || msg.role === 'customer' || msg.role === 'human'
    );
    const clientMessageCount = clientMessages.length;

    // Contar mensajes del agente
    const agentMessages = transcriptArray.filter((msg: TranscriptMessage) =>
      msg.role === 'agent' || msg.role === 'assistant'
    );

    console.log('=== CALL ANALYSIS ===');
    console.log('Duration:', duration, 'seconds');
    console.log('Total messages:', transcriptArray.length);
    console.log('Agent messages:', agentMessages.length);
    console.log('Client messages:', clientMessageCount);
    console.log('All messages roles:', transcriptArray.map((m: TranscriptMessage) => m.role));
    console.log('Client messages content:', clientMessages.map((m: TranscriptMessage) => m.message));
    console.log('Full transcript:', transcript);

    // Detectar si NO hubo comunicación real:
    // - duration < 5s = no conectó
    // - 0 mensajes del cliente Y 0 mensajes del agente = no conectó
    // - 0 mensajes del cliente = cliente no habló (colgó antes de decir algo)
    const noConnection = duration < 5 || transcriptArray.length === 0;
    const clientNeverSpoke = clientMessageCount === 0 && !noConnection;

    console.log('No connection:', noConnection);
    console.log('Client never spoke:', clientNeverSpoke);

    // Solo marcar como no_answer si realmente no hubo comunicación
    const wasNoAnswer = noConnection || clientNeverSpoke;

    // Determinar outcome
    let outcome: string;
    let summary: string;

    // Caso 1: Error de cuota o fallo técnico
    if (isQuotaError && clientMessageCount > 0) {
      // Hubo conversación pero se cortó por cuota - analizar lo que hay
      outcome = determineOutcomeFromAnalysis(analysis, transcript, callSuccessful);
      // Agregar nota de que se cortó
      summary = (analysis.transcript_summary || analysis.summary || generateSummary(transcript, outcome)) +
                ' ⚠️ (Llamada cortada por límite de créditos)';
      console.log('Call cut due to quota but had conversation, analyzing...');
    }
    // Caso 2: No hubo comunicación
    else if (wasNoAnswer) {
      outcome = 'no_answer';
      summary = clientNeverSpoke
        ? 'El cliente contestó pero colgó sin decir nada.'
        : 'No se pudo establecer comunicación.';
      console.log('Marked as no_answer because:', noConnection ? 'no connection' : 'client never spoke');
    }
    // Caso 3: Hubo conversación real - analizar el contenido
    else {
      outcome = determineOutcomeFromAnalysis(analysis, transcript, callSuccessful);
      summary = analysis.transcript_summary || analysis.summary || generateSummary(transcript, outcome);
    }

    console.log('Final outcome:', outcome);
    console.log('Summary:', summary);

    // Actualizar registro si existe businessId
    if (businessId) {
      // Verificar si ya existe un registro para esta conversación
      // Buscamos en notas que contengan el conversationId
      const { data: existingRecords } = await supabase
        .from('contact_history')
        .select('id, notes')
        .eq('business_id', businessId)
        .like('notes', `%${conversationId}%`)
        .limit(1);

      if (existingRecords && existingRecords.length > 0 && !forceUpdate) {
        console.log('Record already exists for conversation:', conversationId);
        // Ya existe, no duplicar - pero devolver success
        return NextResponse.json({
          success: true,
          outcome,
          summary,
          status,
          duration,
          salesStageUpdated: false,
          alreadyRecorded: true,
        });
      }

      // Si forceUpdate, eliminar el registro existente para crear uno nuevo
      if (existingRecords && existingRecords.length > 0 && forceUpdate) {
        console.log('Force update: deleting existing record:', existingRecords[0].id);
        await supabase
          .from('contact_history')
          .delete()
          .eq('id', existingRecords[0].id);
      }

      // Generar insights en español para el vendedor
      const salesInsights = generateSalesInsights(transcript, outcome, summary);
      console.log('Generated sales insights:', salesInsights);

      // Guardar en contact_history como llamada (con nota de que fue IA)
      // Incluir conversationId para evitar duplicados
      const outcomeLabel =
        outcome === 'wants_quote' ? '💰 ¡QUIERE COTIZACIÓN!' :
        outcome === 'interested' ? '🎯 INTERESADO' :
        outcome === 'not_interested' ? '❌ No interesado' :
        outcome === 'callback' ? '📅 Llamar después' :
        outcome === 'no_answer' ? '📵 No contestó / Colgó' : '📞 Completada';

      const aiCallNote = `🤖 LLAMADA IA (${duration}s) [${conversationId}]\n\nResultado: ${outcomeLabel}\n\n${salesInsights}`;

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

      // Obtener el stage actual del lead para decidir a dónde moverlo
      const { data: currentBusiness } = await supabase
        .from('businesses')
        .select('sales_stage')
        .eq('id', businessId)
        .single();

      const currentStage = currentBusiness?.sales_stage || 'nuevo';

      // Actualizar sales_stage del lead según outcome
      const updateData: Record<string, unknown> = {
        contacted_at: new Date().toISOString(),
      };

      // Lógica de movimiento:
      // - interested / wants_quote → interesado (siempre)
      // - not_interested → perdido (siempre)
      // - callback / no_answer / voicemail / completed → seguimiento_1
      //   (solo si está en nuevo, contactado. Si ya está en seguimiento_2, dejarlo ahí)
      if (outcome === 'interested' || outcome === 'wants_quote') {
        updateData.sales_stage = 'interesado';
      } else if (outcome === 'not_interested') {
        updateData.sales_stage = 'perdido';
      } else if (['callback', 'no_answer', 'voicemail', 'completed'].includes(outcome)) {
        // Solo mover a seguimiento_1 si está en una etapa anterior
        const earlyStages = ['nuevo', 'contactado'];
        if (earlyStages.includes(currentStage)) {
          updateData.sales_stage = 'seguimiento_1';
        }
        // Si ya está en seguimiento_1 o seguimiento_2, no mover
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
      salesStageUpdated: true, // Siempre actualizamos el stage según el outcome
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
  const insights: string[] = [];

  console.log('=== generateSalesInsights ===');
  console.log('Transcript length:', transcript?.length || 0);
  console.log('Outcome:', outcome);
  console.log('English summary:', englishSummary);
  console.log('English summary length:', englishSummary?.length || 0);

  // ============================================================
  // REGLA #1: SIEMPRE incluir el resumen de ElevenLabs si existe
  // Este es el dato más importante - NUNCA omitirlo
  // ============================================================
  if (englishSummary && englishSummary.length > 20) {
    insights.push(`📋 ${englishSummary}`);
    console.log('✅ Added ElevenLabs summary to insights');
  } else {
    console.log('⚠️ NO ElevenLabs summary available (length:', englishSummary?.length || 0, ')');
  }

  // Caso especial: No contestó o colgó
  if (outcome === 'no_answer') {
    if (insights.length === 0) {
      insights.push(`📵 La llamada fue muy corta - probablemente no contestaron o colgaron.`);
    }
    insights.push(`\n⚡ ACCIÓN: Intentar llamar en otro horario o enviar WhatsApp primero`);
    return insights.join('\n');
  }

  // Si no hay transcript pero tenemos summary, ya está bien
  if (!transcript || transcript.trim().length === 0) {
    // Agregar acción recomendada
    if (outcome === 'wants_quote') {
      insights.push(`\n⚡ ACCIÓN: Enviar cotización por WhatsApp AHORA`);
    } else if (outcome === 'interested') {
      insights.push(`\n⚡ ACCIÓN: Hacer seguimiento en 24h`);
    } else if (outcome === 'callback') {
      insights.push(`\n⚡ ACCIÓN: Reprogramar llamada`);
    } else if (outcome === 'not_interested') {
      insights.push(`\n📝 Nota: Guardar para recontactar en 3 meses`);
    }

    // Si tenemos el summary de ElevenLabs, ya tenemos contenido útil
    if (insights.length > 0) {
      return insights.join('\n');
    }

    // NUNCA devolver mensaje genérico - esto indica un error
    console.log('⚠️ WARNING: generateSalesInsights has no insights and no summary!');
    return `⚠️ Procesando resumen de la llamada...`;
  }

  const lower = transcript.toLowerCase();

  // Extraer solo lo que dijo el cliente (líneas que empiezan con "Cliente:")
  const clientLines = transcript
    .split('\n')
    .filter(line => line.startsWith('Cliente:'))
    .map(line => line.replace('Cliente: ', ''))
    .join(' ');

  const clientLinesLower = clientLines.toLowerCase();

  // Detectar nombre del contacto
  // 1. Buscar en lo que dijo el cliente
  const nameMatch = clientLines.match(/(?:mi nombre es|me llamo|soy)\s+([A-ZÁÉÍÓÚa-záéíóú]{2,})/i);
  if (nameMatch && nameMatch[1].length >= 2) {
    const name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
    insights.push(`👤 Contacto: ${name}`);
  } else {
    // 2. Buscar en el summary de ElevenLabs (ej: "contacted a user named Alejandro")
    const englishNameMatch = englishSummary.match(/(?:user named|contacted|spoke with|talking to)\s+([A-Za-zÁÉÍÓÚáéíóú]{2,})/i);
    if (englishNameMatch && !['Alejandro', 'GetLavado', 'a', 'an', 'the', 'user', 'customer'].includes(englishNameMatch[1].toLowerCase())) {
      insights.push(`👤 Contacto: ${englishNameMatch[1]}`);
    } else {
      // 3. Buscar donde el agente confirma el nombre (ej: "Gracias, Alejandro")
      const agentConfirmMatch = transcript.match(/(?:Gracias,|Perfecto,|Entendido,|Anotado,|Mucho gusto,)\s+([A-ZÁÉÍÓÚa-záéíóú]{2,})/i);
      if (agentConfirmMatch && agentConfirmMatch[1].length >= 2) {
        const name = agentConfirmMatch[1].charAt(0).toUpperCase() + agentConfirmMatch[1].slice(1).toLowerCase();
        insights.push(`👤 Contacto: ${name}`);
      }
    }
  }

  // Detectar si tienen proveedor actual y su satisfacción
  if (lower.includes('proveedor') || lower.includes('ya tenemos') || lower.includes('trabajamos con') || lower.includes('internamente') || lower.includes('lavamos')) {
    // Buscar señales de insatisfacción en lo que dijo el cliente
    const dissatisfactionSignals = [
      'no estoy contento', 'no estamos contentos', 'no, no',
      'problemas', 'mal servicio', 'insatisfecho',
      'no, porque', 'no porque', // "No, porque hace manchas"
      'manchas', 'daña', 'rompe', 'pierde', 'demora', 'retrasa',
      'caro', 'costoso', 'muy caro'
    ];

    const isUnhappy = dissatisfactionSignals.some(signal => clientLinesLower.includes(signal));

    if (isUnhappy) {
      insights.push(`🔥 OPORTUNIDAD: Insatisfecho con proveedor actual`);
    } else if (clientLinesLower.includes('contento') || clientLinesLower.includes('bien') || clientLinesLower.includes('conforme')) {
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

  // Agregar fragmentos clave de lo que dijo el cliente - SIEMPRE mostrar algo
  const clientQuotes = transcript
    .split('\n')
    .filter(line => line.startsWith('Cliente:'))
    .map(line => line.replace('Cliente: ', '').trim())
    .filter(line => line.length > 5 && line.length < 200);

  if (clientQuotes.length > 0) {
    // Primero buscar frases relevantes
    const relevantQuotes = clientQuotes
      .filter(q => {
        const ql = q.toLowerCase();
        return ql.includes('cotización') || ql.includes('interesado') ||
               ql.includes('contento') || ql.includes('proveedor') ||
               ql.includes('precio') || ql.includes('problema') ||
               ql.includes('whatsapp') || ql.includes('ocupado') ||
               ql.includes('no me interesa') || ql.includes('mandar') ||
               ql.includes('sí') || ql.includes('no') || ql.includes('gracias');
      })
      .slice(0, 3);

    // Si no hay frases relevantes, mostrar las primeras frases del cliente
    const quotesToShow = relevantQuotes.length > 0 ? relevantQuotes : clientQuotes.slice(0, 3);

    if (quotesToShow.length > 0) {
      insights.push(`\n💬 Lo que dijo el cliente:`);
      quotesToShow.forEach(q => {
        insights.push(`   "${q}"`);
      });
    }
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
  } else {
    // Para outcome 'completed', dar una acción genérica
    insights.push(`\n⚡ ACCIÓN: Evaluar si vale la pena hacer seguimiento`);
  }

  // Asegurar que siempre hay contenido
  if (insights.length === 0) {
    // Esto NO debería pasar nunca si las validaciones funcionan
    console.log('⚠️ WARNING: No insights generated - this should not happen!');
    insights.push(`⚠️ Procesando información de la llamada...`);
  }

  console.log('Final insights count:', insights.length);
  console.log('Final insights:', insights);
  return insights.join('\n');
}

// Generar resumen básico - SOLO se usa como fallback cuando no hay summary de ElevenLabs
function generateSummary(transcript: string, outcome: string): string {
  console.log('⚠️ generateSummary called as fallback - outcome:', outcome);

  const outcomeLabels: Record<string, string> = {
    interested: 'El contacto mostró interés en los servicios de lavandería.',
    wants_quote: 'El contacto solicitó una cotización para servicios de lavandería.',
    not_interested: 'El contacto indicó que no está interesado en el servicio.',
    callback: 'El contacto pidió que lo llamen en otro momento.',
    no_answer: 'No se pudo establecer comunicación con el contacto.',
    completed: 'Llamada realizada exitosamente.',
  };

  return outcomeLabels[outcome] || 'Llamada procesada exitosamente.';
}
