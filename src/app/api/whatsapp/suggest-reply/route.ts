import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Suggest a reply for a customer who responded — Level 2 of the auto-reply system.
// Used when the intent classifier returns 'unclear' but Alejandro wants a draft.
// Always returns a draft Alejandro can edit, never auto-sends.
export async function POST(request: NextRequest) {
  try {
    const { businessId } = await request.json();
    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    // Load business + recent contact history
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select(`
        id, name, business_type, sales_stage, address,
        searches (business_type, city)
      `)
      .eq('id', businessId)
      .single();

    if (bizErr || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { data: history } = await supabase
      .from('contact_history')
      .select('action_type, notes, created_at')
      .eq('business_id', businessId)
      .in('action_type', ['whatsapp', 'auto_whatsapp', 'whatsapp_reply', 'auto_whatsapp_reply'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (!history || history.length === 0) {
      return NextResponse.json({ error: 'No conversation history' }, { status: 400 });
    }

    // Last entry should be the customer's reply (most recent first → reverse for chrono)
    const chronological = [...history].reverse();
    const lastInbound = [...history].find(h => h.action_type === 'whatsapp_reply');
    if (!lastInbound) {
      return NextResponse.json({ error: 'No customer reply to respond to' }, { status: 400 });
    }

    const businessType = (business as any).searches?.business_type || business.business_type || 'negocio';
    const city = (business as any).searches?.city || '';

    // Build conversation transcript for the model
    const transcript = chronological.map(h => {
      const role =
        h.action_type === 'whatsapp_reply' ? 'CLIENTE' :
        h.action_type === 'auto_whatsapp_reply' ? 'NOSOTROS (auto)' :
        'NOSOTROS';
      return `[${role}] ${(h.notes || '').slice(0, 400)}`;
    }).join('\n\n');

    const prompt = `Eres Alejandro, vendedor de GetLavado (lavandería B2B en Lima).

NEGOCIO: ${business.name}
TIPO: ${businessType}${city ? ` · ${city}` : ''}
ETAPA: ${business.sales_stage || 'nuevo'}

CONVERSACIÓN HASTA AHORA:
${transcript}

Tu tarea: redactar UN borrador de respuesta al último mensaje del CLIENTE.

REGLAS:
- Tono: WhatsApp natural, conciso, peruano. Hablale de "ustedes" o "tú".
- Máximo 3 líneas. Si necesitas pregunta, una sola.
- NO uses jerga: "tercerizar", "protocolos", "trazabilidad", "diferencial".
- NO uses emojis salvo 1 al final si encaja.
- Si el cliente preguntó algo concreto, respóndelo.
- Si el cliente está confundido, re-explica simple qué hacemos.
- Si pidió precio, pregunta volumen (kg, cantidad por semana).
- Si parece interesado, agenda los siguientes pasos.
- NO inventes precios ni datos específicos del cliente.
- NO firmes ("Saludos, Alejandro") — el WhatsApp ya identifica al remitente.

Responde SOLO con el texto del mensaje, sin comillas ni explicación.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un vendedor B2B peruano. Conciso, directo, natural. Sin jerga corporativa.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 250,
    });

    const suggestion = completion.choices[0]?.message?.content?.trim() || '';
    if (!suggestion) {
      return NextResponse.json({ error: 'Empty suggestion from model' }, { status: 500 });
    }

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('Suggest-reply error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
