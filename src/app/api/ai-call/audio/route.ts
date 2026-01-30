import { NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// GET: Obtener audio de una conversación de ElevenLabs
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId requerido' }, { status: 400 });
    }

    // Validar formato del conversation_id
    if (!conversationId.match(/^conv_[a-z0-9]+$/)) {
      return NextResponse.json({ error: 'conversationId inválido' }, { status: 400 });
    }

    // Obtener audio de ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY || '',
        },
      }
    );

    if (!response.ok) {
      console.error('ElevenLabs audio error:', response.status);
      return NextResponse.json(
        { error: 'Error al obtener audio' },
        { status: response.status }
      );
    }

    // Devolver el audio como stream
    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=86400', // Cache por 24 horas
      },
    });
  } catch (error) {
    console.error('Audio fetch error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
