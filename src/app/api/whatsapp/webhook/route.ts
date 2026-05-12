import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/kapso';
import { classifyReplyIntent, getAutoReplyText, shouldCloseAsLost } from '@/lib/reply-intent';
import { isLikelyBotReply } from '@/lib/reply-classifier';

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

    // Find the business by phone number — normalize both sides to digits-only
    // (DB stores formats like "960 836 761"; Kapso sends "51960836761")
    const incomingDigits = fromPhone.replace(/\D/g, '');
    const incomingLast9 = incomingDigits.slice(-9);

    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, phone, source')
      .not('phone', 'is', null);

    const match = businesses?.find(b => {
      const dbDigits = (b.phone || '').replace(/\D/g, '');
      if (!dbDigits) return false;
      // Match by full digits or by last 9 (Peru mobile is 9 digits, ignore country code)
      return dbDigits === incomingDigits || dbDigits.slice(-9) === incomingLast9;
    });

    if (!match) {
      console.log(`WhatsApp reply from unknown number: ${fromPhone}`);
      return NextResponse.json({ ok: true, matched: false });
    }

    const businessId = match.id;
    const fullNote = contactName ? `${contactName}: ${messageText}` : messageText;

    // Log the incoming message to contact_history
    await supabase.from('contact_history').insert({
      business_id: businessId,
      action_type: 'whatsapp_reply',
      notes: fullNote,
    });

    // ════════════════════════════════════════════════════════════════
    // AUTO-REPLY (Level 1) — only for high-confidence intents.
    // Skips if: bot reply, already auto-replied in last 24h, unclear, or manual lead.
    // ════════════════════════════════════════════════════════════════
    let autoReplied = false;
    let autoReplyIntent: string | null = null;

    // Manual leads are hand-curated whales — Alejandro owns all comms, no automation.
    const isManualLead = match.source === 'manual';

    // Skip if it's the customer's own bot greeting (not a real human reply)
    if (!isManualLead && !isLikelyBotReply(fullNote)) {
      const classification = classifyReplyIntent(fullNote);

      if (classification.confidence === 'high' && classification.intent !== 'unclear') {
        // Dedupe: if we already auto-replied within last 24h, don't fire again
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentAuto } = await supabase
          .from('contact_history')
          .select('id')
          .eq('business_id', businessId)
          .eq('action_type', 'auto_whatsapp_reply')
          .gte('created_at', since)
          .limit(1);

        if (!recentAuto || recentAuto.length === 0) {
          const replyText = getAutoReplyText(classification.intent);
          if (replyText) {
            const sendResult = await sendWhatsAppMessage(match.phone || '', replyText);
            if (sendResult.success) {
              autoReplied = true;
              autoReplyIntent = classification.intent;

              // Log the auto-reply
              await supabase.from('contact_history').insert({
                business_id: businessId,
                action_type: 'auto_whatsapp_reply',
                notes: `[intent: ${classification.intent}] ${replyText}`,
              });

              // Move to "perdido" if customer explicitly closed the door
              if (shouldCloseAsLost(classification.intent)) {
                await supabase
                  .from('businesses')
                  .update({
                    sales_stage: 'perdido',
                    contacted_at: new Date().toISOString(),
                  })
                  .eq('id', businessId);

                await supabase.from('contact_history').insert({
                  business_id: businessId,
                  action_type: 'stage_change',
                  notes: `📋 Auto-cierre: ${classification.intent} → perdido`,
                });
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true, matched: true, businessId, autoReplied, autoReplyIntent });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to avoid retries
  }
}
