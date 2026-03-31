import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/kapso';
import { getWhatsAppPitchServer } from '@/lib/whatsapp-pitch';

// B2B follow-up cadence
function getDaysToWait(stage: string): number {
  switch (stage) {
    case 'contactado': return 2;
    case 'seguimiento_1': return 3;
    case 'seguimiento_2': return 4;
    case 'seguimiento_3': return 7;
    case 'interesado': return 2;
    case 'cotizado': return 3;
    default: return 3;
  }
}

// Next stage in the pipeline
function getNextStage(stage: string): string | null {
  const flow: Record<string, string> = {
    'contactado': 'seguimiento_1',
    'seguimiento_1': 'seguimiento_2',
    'seguimiento_2': 'seguimiento_3',
    'seguimiento_3': 'perdido',
  };
  return flow[stage] || null;
}

// GET /api/whatsapp/auto-followup
export async function GET() {
  try {
    const now = new Date();

    // Get all businesses with auto_followup_enabled
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select(`
        id, name, phone, business_type, sales_stage, contacted_at,
        contact_actions, auto_followup_last_sent,
        searches (business_type)
      `)
      .eq('auto_followup_enabled', true)
      .not('phone', 'is', null)
      .not('contacted_at', 'is', null)
      .not('sales_stage', 'in', '("nuevo","cliente","perdido")')
      .limit(100);

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

    for (const biz of businesses) {
      if (!biz.phone || !biz.contacted_at) {
        skipped++;
        continue;
      }

      // STOP if lead has replied — vendedor handles from here
      if (hasReplyMap[biz.id]) {
        skipped++;
        continue;
      }

      const stage = biz.sales_stage || 'contactado';
      const daysToWait = getDaysToWait(stage);
      const cutoff = new Date(now.getTime() - daysToWait * 24 * 60 * 60 * 1000);
      const lastContact = new Date(biz.contacted_at);

      // Not enough time has passed
      if (lastContact > cutoff) {
        skipped++;
        continue;
      }

      // Determine next stage
      const nextStage = getNextStage(stage);

      // interesado/cotizado: don't auto-advance, just re-send
      if (stage === 'interesado' || stage === 'cotizado') {
        const contactCount = contactCountMap[biz.id] || 0;
        const businessType = (biz as any).searches?.business_type || biz.business_type;
        const pitch = getWhatsAppPitchServer(biz.name, businessType, stage, contactCount);
        const result = await sendWhatsAppMessage(biz.phone, pitch);

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
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      if (!nextStage) {
        skipped++;
        continue;
      }

      // seguimiento_3 → perdido: just move, don't send
      if (nextStage === 'perdido') {
        await supabase.from('contact_history').insert({
          business_id: biz.id,
          action_type: 'stage_change',
          notes: `📋 Auto: Sin respuesta después de seguimiento 3 → Perdido`,
        });
        await supabase.from('businesses').update({
          sales_stage: 'perdido',
          auto_followup_enabled: false,
        }).eq('id', biz.id);
        lost++;
        continue;
      }

      // Auto-advance + send pitch for new stage
      const contactCount = contactCountMap[biz.id] || 0;
      const businessType = (biz as any).searches?.business_type || biz.business_type;
      const pitch = getWhatsAppPitchServer(biz.name, businessType, nextStage, contactCount);
      const result = await sendWhatsAppMessage(biz.phone, pitch);

      if (result.success) {
        // Log stage change
        await supabase.from('contact_history').insert({
          business_id: biz.id,
          action_type: 'stage_change',
          notes: `📋 Auto-avance: ${stage} → ${nextStage}`,
        });
        // Log message
        await supabase.from('contact_history').insert({
          business_id: biz.id,
          action_type: 'auto_whatsapp',
          notes: pitch,
        });
        // Update business
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

      // Rate limit: 1 message per second
      await new Promise(r => setTimeout(r, 1000));
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
