import { NextRequest, NextResponse, after } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/kapso';
import { classifyReplyIntent, getAutoReplyText, shouldCloseAsLost } from '@/lib/reply-intent';
import { isLikelyBotReply } from '@/lib/reply-classifier';
import { notifyReplyOnSlack } from '@/lib/slack';
import { fetchAll } from '@/lib/hunt';
import { AUTO_INTENTS, brainMode, canAutoReply, draftReplyForBusiness } from '@/lib/b2b-draft';


// Espera para juntar la ráfaga de mensajes antes de avisar/responder.
const BURST_WAIT_MS = 35_000;
const BURST_WINDOW_MS = 3 * 60_000;
export const maxDuration = 60;

// Saludos, agradecimientos y emojis sueltos no merecen aviso en Slack ni respuesta del cerebro.
function isTrivialMessage(text: string): boolean {
  const t = text
    .replace(/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]{1,40}:\s*/, '') // prefijo "Nombre: "
    .toLowerCase()
    .replace(/[^a-záéíóúñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return true; // solo emojis/símbolos
  if (/^reacted with/i.test(text.trim())) return true; // reacción (👍) a un mensaje
  return /^(hola|buen(o|a)?s? (d[ií]as?|tardes?|noches?)|gracias( a (usted|ustedes))?|muchas gracias|ok|oki|okey|listo|perfecto|de nada|igualmente|saludos)( [a-záéíóúñ]+)?$/.test(t);
}

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
    const businesses = await fetchAll<{ id: string; phone: string | null; source: string | null; name: string; contacted_by: string | null; auto_followup_enabled: boolean | null }>(
      (from, to) =>
        supabase
          .from('businesses')
          .select('id, phone, source, name, contacted_by, auto_followup_enabled')
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
    const { data: inserted } = await supabase.from('contact_history').insert({
      business_id: businessId,
      action_type: 'whatsapp_reply',
      notes: fullNote,
    }).select('id').single();
    const myReplyId: string | null = inserted?.id ?? null;

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

      // Con el cerebro en 'auto', las dudas y los "cuánto cuesta" los contesta el cerebro (con contexto);
      // el Nivel 1 queda solo para cerrar rechazos claros.
      const level1Intents = brainMode() === 'auto' ? ['no_interest', 'wrong_number'] : null;
      if (classification.confidence === 'high' && classification.intent !== 'unclear' && (!level1Intents || level1Intents.includes(classification.intent))) {
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
    // Aviso a Slack + cerebro, UNA vez por ráfaga: la gente escribe 3–4 mensajes seguidos ("Buen día",
    // "gracias", el correo…). Respondemos 200 ya y, en segundo plano, esperamos a que termine de escribir;
    // solo el invocación del ÚLTIMO mensaje avisa y responde, viendo toda la ráfaga junta.
    after(async () => {
      try {
        await new Promise((r) => setTimeout(r, BURST_WAIT_MS));
        const { data: latest } = await supabase
          .from('contact_history')
          .select('id')
          .eq('business_id', businessId)
          .eq('action_type', 'whatsapp_reply')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (myReplyId && latest?.id !== myReplyId) return; // llegó otro mensaje después: él se encarga

        const since = new Date(Date.now() - BURST_WINDOW_MS).toISOString();
        const { data: burstRows } = await supabase
          .from('contact_history')
          .select('notes')
          .eq('business_id', businessId)
          .eq('action_type', 'whatsapp_reply')
          .gte('created_at', since)
          .order('created_at', { ascending: true });
        const human = (burstRows || []).map((r) => r.notes || '').filter((n) => !isLikelyBotReply(n));
        const meaningful = human.filter((n) => !isTrivialMessage(n));
        if (meaningful.length === 0) return; // solo bots, saludos o "gracias": no vale un aviso
        const burstText = human.join('\n');

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
        let draftSent = false;
        if (brainMode() !== 'off') {
          try {
            const out = await draftReplyForBusiness(businessId);
            if (out && out.action !== 'skip' && out.reply) {
              draft = out.reply;
              draftAction = out.action;
            }
            // Respuesta automática (solo modo 'auto', casos simples y con guardas). Si algo falla o no
            // aplica, queda como borrador + aviso a un humano.
            if (
              out && brainMode() === 'auto' && !autoReplied && draft &&
              out.action === 'reply' && AUTO_INTENTS.includes(out.intent) && !out.needsTemplate &&
              match.phone && await canAutoReply(businessId, { isManualLead, autoFollowupEnabled: match.auto_followup_enabled })
            ) {
              const sent = await sendWhatsAppMessage(match.phone, out.reply);
              if (sent.success) {
                draftSent = true;
                await supabase.from('contact_history').insert({
                  business_id: businessId,
                  action_type: 'auto_whatsapp_reply',
                  notes: `[cerebro B2B · ${out.intent}] ${out.reply}`,
                });
                await supabase.from('businesses').update({ contacted_at: new Date().toISOString() }).eq('id', businessId);
              } else {
                console.error('B2B brain auto-reply send failed:', sent.error);
              }
            }
            // Lead calificado: señal de compra clara → la card pasa a "interesado" (solo desde etapas
            // tempranas, nunca hacia atrás) y se apaga el bot. El cerebro NO envía nada.
            const BUY_INTENTS = ['pide_propuesta', 'interesado', 'pide_precio'];
            if (out && (out.action === 'handoff' || out.action === 'reply') && BUY_INTENTS.includes(out.intent)) {
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
          message: burstText,
          tier: analysis?.potential_tier ?? null,
          revenueMin: analysis?.estimated_revenue_min ?? null,
          revenueMax: analysis?.estimated_revenue_max ?? null,
          ownerName: owner?.name ?? null,
          fromHunt: !!huntLead,
          autoReplyIntent,
          draft,
          draftAction,
          qualified,
          draftSent,
        });
      } catch (e) {
        console.error('Webhook background (cerebro/Slack) error:', e);
      }
    });

    return NextResponse.json({ ok: true, matched: true, businessId, autoReplied, autoReplyIntent });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to avoid retries
  }
}
