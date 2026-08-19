import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage, sendWhatsAppTemplate } from '@/lib/kapso';
import { getWhatsAppPitchServer } from '@/lib/whatsapp-pitch';
import { isLikelyBotReply } from '@/lib/reply-classifier';

// Try text message first, fall back to template if outside 24h window
async function sendWithFallback(phone: string, pitch: string, bizName: string, stage: string, address?: string | null) {
  const textResult = await sendWhatsAppMessage(phone, pitch);
  if (textResult.success) return { ...textResult, method: 'text' as const };
  if (textResult.error?.includes('24-hour') || textResult.error?.includes('Re-engagement')) {
    const templateResult = await sendWhatsAppTemplate(phone, bizName, stage, address);
    return { ...templateResult, method: 'template' as const };
  }
  return { ...textResult, method: 'text' as const };
}

// Días a esperar antes del siguiente toque. Sirve tanto para el stage humano
// (leads SIN dueño) como para el peldaño del bot (leads CON dueño).
function getDaysToWait(stage: string): number {
  switch (stage) {
    case 'contactado': return 2;
    case 'seguimiento_1': return 3;
    case 'seguimiento_2': return 4;
    case 'seguimiento_3': return 7;  // semanal — más presión antes de cerrar
    case 'interesado': return 2;
    case 'cotizado': return 3;
    default: return 3;
  }
}

// Siguiente stage en el pipeline. SOLO se usa para leads SIN dueño: el bot los
// avanza automáticamente por la escalera. Los leads CON dueño nunca se avanzan.
function getNextStage(stage: string): string | null {
  const flow: Record<string, string> = {
    'nuevo': 'contactado',
    'contactado': 'seguimiento_1',
    'seguimiento_1': 'seguimiento_2',
    'seguimiento_2': 'seguimiento_3',
    // seguimiento_3: no auto-advance — se re-envía sin mover
  };
  return flow[stage] || null;
}

// Escalera FIJA de cadencia del bot para leads CON dueño. El "paso" lo determina
// el nº de contactos previos (contactCount), NO el sales_stage: así el bot elige
// template + espera SIN tocar el pipeline (sales_stage sigue siendo 100% humano).
const LADDER = ['contactado', 'seguimiento_1', 'seguimiento_2', 'seguimiento_3'] as const;

// GET /api/whatsapp/auto-followup
export async function GET() {
  // DISABLED: Waiting for Meta to approve per-stage templates (seg1, seg2, seg3)
  // Sending the same generic template repeatedly = spam. Re-enable by setting to true
  const ENABLED = true;
  if (!ENABLED) {
    return NextResponse.json({
      sent: 0, skipped: 0, advanced: 0, lost: 0, total: 0,
      message: 'Auto-followup paused — waiting for per-stage templates approval from Meta',
    });
  }

  try {
    const now = new Date();

    // Skip weekends in Lima time — B2B leads ignore WhatsApp on Sat/Sun, sending
    // there hurts open rate without lifting replies.
    const limaDayShort = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Lima',
      weekday: 'short',
    }).format(now); // 'Sun' | 'Mon' | ... | 'Sat'
    if (limaDayShort === 'Sat' || limaDayShort === 'Sun') {
      return NextResponse.json({
        sent: 0, skipped: 0, advanced: 0, lost: 0, total: 0,
        message: `Auto-followup skipped — weekend (${limaDayShort} Lima time)`,
      });
    }

    // Get all businesses with auto_followup_enabled. Includes 'nuevo' (first-contact).
    // We fetch all eligible (typically <500), then sort by potential_score desc in JS and
    // take top 100. PostgREST can't order across the businesses↔service_analyses
    // relation (many-to-many from PG's view), so we sort client-side.
    const { data: rawBusinesses, error } = await supabase
      .from('businesses')
      .select(`
        id, name, phone, address, business_type, sales_stage, contacted_at,
        contacted_by, contact_actions, auto_followup_last_sent,
        searches (business_type),
        service_analyses (potential_score)
      `)
      .eq('auto_followup_enabled', true)
      .not('phone', 'is', null)
      // Include NULL sales_stage (treated as 'nuevo' first-contact). Naive
      // .not('sales_stage','in',...) excludes NULL rows because in SQL
      // 'NULL NOT IN (...)' evaluates to NULL (not TRUE), so the row drops.
      .or('sales_stage.is.null,sales_stage.not.in.(cliente,perdido)')
      .limit(500);

    if (error) {
      console.error('Error fetching auto-followup businesses:', error);
      return NextResponse.json({ error: 'DB query error' }, { status: 500 });
    }

    if (!rawBusinesses || rawBusinesses.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, advanced: 0, lost: 0, message: 'No leads need follow-up' });
    }

    // Sort by potential_score desc (Orcas/Delfines first, Unknown last)
    const scoreOf = (b: any) => {
      const sa = Array.isArray(b.service_analyses) ? b.service_analyses[0] : b.service_analyses;
      return sa?.potential_score ?? -1;
    };
    const businesses = rawBusinesses.slice().sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 300);

    // Get contact counts + check for HUMAN replies per business
    // Bot greetings ("Gracias por comunicarte con...") don't count — the human never saw the
    // message, so we keep auto-following up. Only real human replies stop the cron.
    const businessIds = businesses.map(b => b.id);
    const { data: contactHistory } = await supabase
      .from('contact_history')
      .select('business_id, action_type, notes')
      .in('business_id', businessIds);

    const contactCountMap: Record<string, number> = {};
    const hasReplyMap: Record<string, boolean> = {};
    contactHistory?.forEach(c => {
      contactCountMap[c.business_id] = (contactCountMap[c.business_id] || 0) + 1;
      if (c.action_type === 'whatsapp_reply' && !isLikelyBotReply(c.notes)) {
        hasReplyMap[c.business_id] = true;
      }
    });

    let sent = 0;
    let skipped = 0;
    let advanced = 0;
    let lost = 0;
    const errors: string[] = [];

    const MAX_SENDS = 30;
    for (const biz of businesses) {
      if (sent >= MAX_SENDS) break;
      if (!biz.phone) {
        skipped++;
        continue;
      }

      // Skip if contacted less than 1 hour ago (dedup against double triggers)
      // First-contact leads (nuevo) have null contacted_at — no dedup needed
      if (biz.contacted_at) {
        const lastContactTime = new Date(biz.contacted_at).getTime();
        if (now.getTime() - lastContactTime < 60 * 60 * 1000) {
          skipped++;
          continue;
        }
      }

      // Skip landlines — only mobile numbers work with WhatsApp
      const cleanPhone = biz.phone.replace(/\D/g, '');
      const isMobile = (cleanPhone.length === 9 && cleanPhone.startsWith('9')) ||
                        (cleanPhone.startsWith('519') && cleanPhone.length >= 11);
      if (!isMobile) {
        skipped++;
        continue;
      }

      // STOP if lead has replied — vendedor handles from here
      if (hasReplyMap[biz.id]) {
        skipped++;
        continue;
      }

      const contactCount = contactCountMap[biz.id] || 0;
      const businessType = (biz as any).searches?.business_type || biz.business_type;
      // Dueño humano = null → lead "frío" de Martín que el bot puede empujar por el
      // pipeline. Con dueño → un vendedor lo trabaja; el bot NUNCA toca su sales_stage.
      const hasOwner = !!biz.contacted_by;

      if (!hasOwner) {
        // ===== Lead SIN dueño: el bot avanza el pipeline (como antes) =====
        const stage = biz.sales_stage || 'nuevo';

        // Cadencia basada en el stage — skip para primer contacto (sin contacted_at).
        if (biz.contacted_at) {
          const daysToWait = getDaysToWait(stage);
          const cutoff = new Date(now.getTime() - daysToWait * 24 * 60 * 60 * 1000);
          const lastContact = new Date(biz.contacted_at);
          if (lastContact > cutoff) {
            skipped++;
            continue;
          }
        }

        const nextStage = getNextStage(stage);

        // seguimiento_3/interesado/cotizado (o sin siguiente): re-enviar sin mover el stage.
        if (!nextStage || stage === 'seguimiento_3' || stage === 'interesado' || stage === 'cotizado') {
          const pitch = getWhatsAppPitchServer(biz.name, businessType, stage, contactCount);
          const result = await sendWithFallback(biz.phone, pitch, biz.name, stage, biz.address);
          if (result.success) {
            await supabase.from('contact_history').insert({
              business_id: biz.id,
              action_type: 'auto_whatsapp',
              notes: pitch,
            });
            await supabase.from('businesses').update({
              contacted_at: now.toISOString(),
              auto_followup_last_sent: now.toISOString(),
            }).eq('id', biz.id);
            sent++;
          } else {
            errors.push(`${biz.name}: ${result.error}`);
            skipped++;
          }
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        // AUTO-AVANCE: solo para leads sin dueño — mueve el stage + template del nuevo stage.
        const pitch = getWhatsAppPitchServer(biz.name, businessType, nextStage, contactCount);
        const result = await sendWithFallback(biz.phone, pitch, biz.name, nextStage, biz.address);
        if (result.success) {
          await supabase.from('contact_history').insert({
            business_id: biz.id,
            action_type: 'stage_change',
            notes: `📋 Auto-avance: ${stage} → ${nextStage}`,
          });
          await supabase.from('contact_history').insert({
            business_id: biz.id,
            action_type: 'auto_whatsapp',
            notes: pitch,
          });
          await supabase.from('businesses').update({
            sales_stage: nextStage,
            contacted_at: now.toISOString(),
            auto_followup_last_sent: now.toISOString(),
            contact_actions: [...(biz.contact_actions || []).filter((a: string) => a !== 'whatsapp'), 'whatsapp'],
          }).eq('id', biz.id);
          sent++;
          advanced++;
        } else {
          errors.push(`${biz.name}: ${result.error}`);
          skipped++;
        }
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      // ===== Lead CON dueño: cadencia por contactCount, NUNCA toca sales_stage =====
      // STOP: ya se envió el último peldaño (seguimiento_3) en una corrida previa.
      if (contactCount > LADDER.length - 1) {
        skipped++;
        continue;
      }

      // Paso del bot en su escalera fija (0..LADDER.length-1). Solo elige template + espera.
      const step = Math.min(contactCount, LADDER.length - 1);
      const cadenceStage = LADDER[step];

      // Cadence check — skipped for first-contact leads (no contacted_at yet, send ASAP).
      // Usa cadenceStage (peldaño del bot), NUNCA el sales_stage humano.
      if (biz.contacted_at) {
        const daysToWait = getDaysToWait(cadenceStage);
        const cutoff = new Date(now.getTime() - daysToWait * 24 * 60 * 60 * 1000);
        const lastContact = new Date(biz.contacted_at);
        if (lastContact > cutoff) {
          skipped++;
          continue;
        }
      }

      // Enviar el peldaño correspondiente. Para leads CON dueño el cron NUNCA toca
      // sales_stage ni inserta 'stage_change': solo registra el envío como auto_whatsapp.
      const pitch = getWhatsAppPitchServer(biz.name, businessType, cadenceStage, contactCount);
      const result = await sendWithFallback(biz.phone, pitch, biz.name, cadenceStage, biz.address);

      if (result.success) {
        await supabase.from('contact_history').insert({
          business_id: biz.id,
          action_type: 'auto_whatsapp',
          notes: pitch,
        });
        await supabase.from('businesses').update({
          contacted_at: now.toISOString(),
          auto_followup_last_sent: now.toISOString(),
        }).eq('id', biz.id);
        sent++;
      } else {
        errors.push(`${biz.name}: ${result.error}`);
        skipped++;
      }

      // Rate limit: 500ms between messages — keeps full 15-batch under 30s cron-job.org timeout
      await new Promise(r => setTimeout(r, 500));
    }

    return NextResponse.json({
      sent,
      skipped,
      advanced,
      lost,
      total: businesses.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Auto follow-up error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
