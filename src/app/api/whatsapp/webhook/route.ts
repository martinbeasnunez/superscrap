import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/kapso';
import { classifyReplyIntent, getAutoReplyText, shouldCloseAsLost } from '@/lib/reply-intent';
import { isLikelyBotReply } from '@/lib/reply-classifier';
import { notifyReplyOnSlack } from '@/lib/slack';
import { fetchAll } from '@/lib/hunt';
import { brainMode, draftReplyForBusiness } from '@/lib/b2b-draft';

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

    // Paginado: Supabase corta en 1000 filas y ya hay más negocios que eso; sin paginar,
    // las respuestas de los leads más nuevos no encontraban su negocio y se perdían.
    const businesses = await fetchAll<{ id: string; phone: string | null; source: string | null; name: string; contacted_by: string | null }>(
      (from, to) =>
        supabase
          .from('businesses')
          .select('id, phone, source, name, contacted_by')
          .not('phone', 'is', null)
          .range(from, to));

    const match = businesses.find(b => {
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

    // Aviso a Slack: solo cuando responde una persona (no el contestador automático del negocio).
    if (!isLikelyBotReply(fullNote)) {
      const [{ data: analysis }, { data: huntLead }, { data: owner }] = await Promise.all([
        supabase
          .from('service_analyses')
          .select('potential_tier, estimated_revenue_min, estimated_revenue_max')
          .eq('business_id', businessId)
          .limit(1)
          .maybeSingle(),
        supabase.from('hunt_leads').select('id').eq('business_id', businessId).limit(1).maybeSingle(),
        match.contacted_by
          ? supabase.from('users').select('name').eq('id', match.contacted_by).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      // Borrador del cerebro B2B (solo redacta; un humano lo aprueba y envía). Nunca rompe el aviso.
      let draft: string | null = null;
      let draftAction: string | null = null;
      let qualified = false;
      if (brainMode() === 'draft') {
        try {
          const out = await draftReplyForBusiness(businessId);
          if (out && out.action !== 'skip' && out.reply) {
            draft = out.reply;
            draftAction = out.action;
          }
          // Lead calificado: señal de compra clara → la card pasa a "interesado" (solo desde etapas
          // tempranas, nunca hacia atrás) y se apaga el bot. El cerebro NO envía nada.
          const BUY_INTENTS = ['pide_propuesta', 'interesado', 'pide_precio'];
          if (out && out.action === 'handoff' && BUY_INTENTS.includes(out.intent)) {
            const { data: cur } = await supabase
              .from('businesses')
              .select('sales_stage')
              .eq('id', businessId)
              .maybeSingle();
            const early = ['nuevo', 'contactado', 'seguimiento_1', 'seguimiento_2', 'seguimiento_3'];
            const stage = cur?.sales_stage || 'nuevo';
            const datos = Object.entries(out.extracted).map(([k, v]) => `${k}: ${v}`).join(' · ');
            if (early.includes(stage)) {
              await supabase.from('businesses').update({ sales_stage: 'interesado', auto_followup_enabled: false }).eq('id', businessId);
              await supabase.from('contact_history').insert({
                business_id: businessId,
                action_type: 'stage_change',
                notes: `📋 ${stage} → interesado (cerebro B2B): señal de compra (${out.intent}). Bot apagado, atiende un humano.${datos ? ` Datos: ${datos}` : ''}`,
              });
              qualified = true;
            } else if (datos) {
              await supabase.from('contact_history').insert({
                business_id: businessId,
                action_type: 'note',
                notes: `[cerebro B2B] datos del cliente: ${datos}`,
              });
            }
          }
        } catch (e) {
          console.error('B2B brain draft error:', e);
        }
      }
      await notifyReplyOnSlack({
        businessId,
        conversationId: conversation.id ?? null,
        businessName: match.name,
        phone: match.phone,
        contactName: contactName || null,
        message: messageText,
        tier: analysis?.potential_tier ?? null,
        revenueMin: analysis?.estimated_revenue_min ?? null,
        revenueMax: analysis?.estimated_revenue_max ?? null,
        ownerName: owner?.name ?? null,
        fromHunt: !!huntLead,
        autoReplyIntent,
        draft,
        draftAction,
        qualified,
      });
    }

    return NextResponse.json({ ok: true, matched: true, businessId, autoReplied, autoReplyIntent });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to avoid retries
  }
}
