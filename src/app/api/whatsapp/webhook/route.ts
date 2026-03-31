import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Kapso webhook for incoming WhatsApp messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = request.headers.get('x-webhook-event');

    // Only process incoming messages
    if (event !== 'whatsapp.message.received') {
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    const conversation = body.conversation;

    if (!message || !conversation) {
      return NextResponse.json({ ok: true });
    }

    const fromPhone = conversation.phone_number; // e.g. "+51965450086"
    const messageText = message.kapso?.content || message.text?.body || '';
    const contactName = conversation.kapso?.contact_name || '';

    if (!fromPhone || !messageText) {
      return NextResponse.json({ ok: true });
    }

    // Find the business by phone number
    const cleanPhone = fromPhone.replace(/\D/g, '');
    const phoneVariants = [
      cleanPhone,
      cleanPhone.startsWith('51') ? cleanPhone.slice(2) : cleanPhone,
      `+${cleanPhone}`,
      `+51 ${cleanPhone.startsWith('51') ? cleanPhone.slice(2) : cleanPhone}`,
    ];

    let businessId: string | null = null;

    for (const variant of phoneVariants) {
      const { data } = await supabase
        .from('businesses')
        .select('id')
        .ilike('phone', `%${variant.slice(-9)}%`) // Match last 9 digits
        .limit(1)
        .single();

      if (data) {
        businessId = data.id;
        break;
      }
    }

    if (!businessId) {
      console.log(`WhatsApp reply from unknown number: ${fromPhone}`);
      return NextResponse.json({ ok: true, matched: false });
    }

    // Log the incoming message to contact_history
    await supabase.from('contact_history').insert({
      business_id: businessId,
      action_type: 'whatsapp_reply',
      notes: contactName
        ? `${contactName}: ${messageText}`
        : messageText,
    });

    return NextResponse.json({ ok: true, matched: true, businessId });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to avoid retries
  }
}
