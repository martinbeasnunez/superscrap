import { NextRequest, NextResponse } from 'next/server';
import { draftReplyForBusiness } from '@/lib/b2b-draft';

// Suggest a reply for a customer who responded — Level 2 of the auto-reply system.
// Used when the intent classifier returns 'unclear' but Alejandro wants a draft.
// Always returns a draft Alejandro can edit, never auto-sends.
export async function POST(request: NextRequest) {
  try {
    const { businessId } = await request.json();
    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    // Cerebro B2B: responde primero lo que dijeron, vende el siguiente paso y califica de pasada.
    const out = await draftReplyForBusiness(businessId);
    if (!out) {
      return NextResponse.json({ error: 'No customer reply to respond to' }, { status: 400 });
    }
    if (out.action === 'skip' || !out.reply) {
      return NextResponse.json({ error: 'Parece respuesta automática del negocio: no hace falta contestar' }, { status: 400 });
    }
    const suggestion = out.reply;

    return NextResponse.json({ suggestion, action: out.action, intent: out.intent, needsTemplate: out.needsTemplate, extracted: out.extracted });
  } catch (error) {
    console.error('Suggest-reply error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
