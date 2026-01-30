import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// GET: Ver todos los registros de un business
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'businessId requerido' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contact_history')
      .select('id, notes, created_at, action_type')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ records: data, count: data?.length || 0 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE: Eliminar registros de llamadas IA con resumen genérico
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'businessId requerido' }, { status: 400 });
    }

    // Buscar registros de llamada IA con mensaje genérico (sin insights útiles)
    const { data: allRecords, error: findError } = await supabase
      .from('contact_history')
      .select('id, notes, created_at')
      .eq('business_id', businessId)
      .like('notes', '%🤖 LLAMADA IA%');

    // Filtrar solo los que tienen resumen genérico (no tienen insights como 👤, 🔥, 💵, 💬)
    const badRecords = allRecords?.filter(r => {
      const notes = r.notes || '';
      const hasGoodInsights = notes.includes('👤') || notes.includes('🔥') ||
                              notes.includes('💵') || notes.includes('💬') ||
                              notes.includes('📋');
      const hasGenericMessage = notes.includes('Llamada completada') ||
                                notes.includes('Revisar grabación') ||
                                notes.includes('No se pudo establecer');
      return !hasGoodInsights && hasGenericMessage;
    }) || [];

    if (findError) {
      console.error('Error finding records:', findError);
      return NextResponse.json({ error: 'Error buscando registros' }, { status: 500 });
    }

    console.log('Found bad records:', badRecords?.length || 0);

    if (!badRecords || badRecords.length === 0) {
      return NextResponse.json({ message: 'No hay registros para eliminar', deleted: 0 });
    }

    // Eliminar los registros malos
    const ids = badRecords.map(r => r.id);
    const { error: deleteError } = await supabase
      .from('contact_history')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('Error deleting records:', deleteError);
      return NextResponse.json({ error: 'Error eliminando registros' }, { status: 500 });
    }

    return NextResponse.json({
      message: `Eliminados ${ids.length} registros con resumen genérico`,
      deleted: ids.length,
      ids,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Re-procesar registros malos con los datos actuales de ElevenLabs
export async function POST(request: Request) {
  try {
    const { businessId } = await request.json();

    if (!businessId) {
      return NextResponse.json({ error: 'businessId requerido' }, { status: 400 });
    }

    // Buscar registros de llamada IA con mensaje genérico
    const { data: allRecords, error: findError } = await supabase
      .from('contact_history')
      .select('id, notes, created_at')
      .eq('business_id', businessId)
      .like('notes', '%🤖 LLAMADA IA%');

    if (findError) {
      return NextResponse.json({ error: 'Error buscando registros' }, { status: 500 });
    }

    // Filtrar registros malos (sin insights buenos)
    const badRecords = allRecords?.filter(r => {
      const notes = r.notes || '';
      const hasGoodInsights = notes.includes('👤') || notes.includes('🔥') ||
                              notes.includes('💵') || notes.includes('💬') ||
                              notes.includes('📋');
      const hasGenericMessage = notes.includes('Llamada completada') ||
                                notes.includes('Revisar grabación') ||
                                notes.includes('No se pudo establecer');
      return !hasGoodInsights && hasGenericMessage;
    }) || [];

    if (badRecords.length === 0) {
      return NextResponse.json({ message: 'No hay registros malos para re-procesar', reprocessed: 0 });
    }

    const results = [];

    for (const record of badRecords) {
      // Extraer conversationId del registro
      const conversationIdMatch = record.notes?.match(/\[([^\]]+)\]/);
      const conversationId = conversationIdMatch ? conversationIdMatch[1] : null;

      if (!conversationId) {
        results.push({ id: record.id, status: 'skipped', reason: 'No conversationId found' });
        continue;
      }

      // Consultar ElevenLabs por el resumen actualizado
      try {
        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
          {
            headers: { 'xi-api-key': ELEVENLABS_API_KEY || '' },
          }
        );

        if (!response.ok) {
          results.push({ id: record.id, status: 'error', reason: 'ElevenLabs API error' });
          continue;
        }

        const conversation = await response.json();
        const summary = conversation.analysis?.transcript_summary;

        if (!summary || summary.length < 20) {
          results.push({ id: record.id, status: 'skipped', reason: 'No valid summary in ElevenLabs' });
          continue;
        }

        // Llamar al endpoint de result con forceUpdate
        const resultRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai-call/result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            businessId,
            forceUpdate: true,
          }),
        });

        const resultData = await resultRes.json();
        results.push({
          id: record.id,
          conversationId,
          status: resultData.success ? 'reprocessed' : 'failed',
          newSummary: summary.substring(0, 100) + '...',
        });
      } catch (err) {
        results.push({ id: record.id, status: 'error', reason: String(err) });
      }
    }

    return NextResponse.json({
      message: `Procesados ${results.length} registros`,
      results,
    });
  } catch (error) {
    console.error('Reprocess error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
