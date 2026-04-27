import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage, sendWhatsAppTemplate } from '@/lib/kapso';
import { getWhatsAppPitchServer } from '@/lib/whatsapp-pitch';

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

// B2B follow-up cadence
function getDaysToWait(stage: string): number {
  switch (stage) {
    case 'contactado': return 2;
    case 'seguimiento_1': return 3;
    case 'seguimiento_2': return 4;
    case 'seguimiento_3': return 14; // quincenal — rotación de ángulos
    case 'interesado': return 2;
    case 'cotizado': return 3;
    default: return 3;
  }
}

// Next stage in the pipeline
function getNextStage(stage: string): string | null {
  const flow: Record<string, string> = {
    'nuevo': 'contactado',
    'contactado': 'seguimiento_1',
    'seguimiento_1': 'seguimiento_2',
    'seguimiento_2': 'seguimiento_3',
    // seguimiento_3: no auto-advance — vendedor decide manualmente
  };
  return flow[stage] || null;
}

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

    // Get all businesses with auto_followup_enabled
    // Includes 'nuevo' (first-contact) — ordered by potential_score desc so Orcas/Delfines go first
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select(`
        id, name, phone, address, business_type, sales_stage, contacted_at,
        contact_actions, auto_followup_last_sent,
        searches (business_type),
        service_analyses (potential_score)
      `)
      .eq('auto_followup_enabled', true)
      .not('phone', 'is', null)
      .not('sales_stage', 'in', '("cliente","perdido")')
      .order('potential_score', { referencedTable: 'service_analyses', ascending: false, nullsFirst: false })
      .limit(100); // Fetch more, filter in code, send max 15

    if (error) {
      console.error('Error fetching auto-followup businesses:', error);
      return NextResponse.json({ error: 'DB query error' }, { status: 500 });
    }

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, advanced: 0, lost: 0, message: 'No leads need follow-up' });
    }

    // Get contact counts + check for unread replies per business
    const businessIds = businesses.map(b => b.id);
    const { data: contactHistory } = await supabase
      .from('contact_history')
      .select('business_id, action_type')
      .in('business_id', businessIds);

    const contactCountMap: Record<string, number> = {};
    const hasReplyMap: Record<string, boolean> = {};
    contactHistory?.forEach(c => {
      contactCountMap[c.business_id] = (contactCountMap[c.business_id] || 0) + 1;
      if (c.action_type === 'whatsapp_reply') {
        hasReplyMap[c.business_id] = true;
      }
    });

    let sent = 0;
    let skipped = 0;
    let advanced = 0;
    let lost = 0;
    const errors: string[] = [];

    const MAX_SENDS = 15;
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

      // Null/missing sales_stage = first-contact lead (treat as 'nuevo' so it advances to 'contactado')
      const stage = biz.sales_stage || 'nuevo';

      // Cadence check — skipped for first-contact leads (no contacted_at yet, send ASAP)
      if (biz.contacted_at) {
        const daysToWait = getDaysToWait(stage);
        const cutoff = new Date(now.getTime() - daysToWait * 24 * 60 * 60 * 1000);
        const lastContact = new Date(biz.contacted_at);
        if (lastContact > cutoff) {
          skipped++;
          continue;
        }
      }

      // Determine next stage
      const nextStage = getNextStage(stage);
      const contactCount = contactCountMap[biz.id] || 0;
      const businessType = (biz as any).searches?.business_type || biz.business_type;

      // seguimiento_3/interesado/cotizado: re-send without moving
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
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      // AUTO-ADVANCE: move to next stage + send stage-specific template
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

      // Rate limit: 2 seconds between messages (fits in 30s cron timeout)
      await new Promise(r => setTimeout(r, 2000));
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
