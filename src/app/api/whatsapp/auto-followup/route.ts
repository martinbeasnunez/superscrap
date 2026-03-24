import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/kapso';

// This endpoint is called by a cron job or manually to send auto follow-ups
// GET /api/whatsapp/auto-followup
export async function GET() {
  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Find businesses with auto_followup_enabled that haven't been contacted in 3+ days
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select(`
        id, name, phone, business_type, sales_stage, contacted_at,
        contact_actions, auto_followup_last_sent,
        searches (business_type)
      `)
      .eq('auto_followup_enabled', true)
      .not('phone', 'is', null)
      .lt('contacted_at', threeDaysAgo.toISOString())
      .not('sales_stage', 'in', '("cliente","perdido")')
      .limit(50);

    if (error) {
      console.error('Error fetching auto-followup businesses:', error);
      return NextResponse.json({ error: 'DB query error' }, { status: 500 });
    }

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, message: 'No leads need follow-up' });
    }

    // Get contact counts
    const businessIds = businesses.map(b => b.id);
    const { data: contactHistory } = await supabase
      .from('contact_history')
      .select('business_id')
      .in('business_id', businessIds);

    const contactCountMap: Record<string, number> = {};
    contactHistory?.forEach(c => {
      contactCountMap[c.business_id] = (contactCountMap[c.business_id] || 0) + 1;
    });

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const biz of businesses) {
      if (!biz.phone) {
        skipped++;
        continue;
      }

      const contactCount = contactCountMap[biz.id] || 0;
      const stage = biz.sales_stage || 'nuevo';
      const businessType = (biz as any).searches?.business_type || biz.business_type;

      // Generate a simple follow-up pitch
      const pitch = generateAutoFollowUpPitch(biz.name, businessType, stage, contactCount);

      const result = await sendWhatsAppMessage(biz.phone, pitch);

      if (result.success) {
        // Log auto-sent message
        await supabase.from('contact_history').insert({
          business_id: biz.id,
          action_type: 'auto_whatsapp',
          notes: `🤖 Auto follow-up: ${pitch.substring(0, 100)}...`,
        });

        // Update contacted_at and auto_followup_last_sent
        await supabase
          .from('businesses')
          .update({
            contacted_at: now.toISOString(),
            auto_followup_last_sent: now.toISOString(),
            contact_actions: [...(biz.contact_actions || []).filter((a: string) => a !== 'whatsapp'), 'whatsapp'],
          })
          .eq('id', biz.id);

        sent++;
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
      total: businesses.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Auto follow-up error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateAutoFollowUpPitch(
  businessName: string,
  businessType: string | null,
  stage: string,
  contactCount: number,
): string {
  // Short, direct follow-up messages for auto-send
  if (contactCount >= 5) {
    return `Hola! De GetLavado para *${businessName}*. Les he escrito antes sobre lavanderia industrial. Solo queria saber: les interesa cotizar? Un "si" o "no" me ayuda. Gracias!`;
  }

  if (contactCount >= 3) {
    return `Hola! Seguimiento de GetLavado para *${businessName}*. Les interesa recibir una cotizacion de lavanderia industrial sin compromiso? O prefieren que no los contacte mas?`;
  }

  if (stage === 'interesado') {
    return `Hola! De GetLavado para *${businessName}*. Nos comentaron que les interesa el servicio. Para la cotizacion necesito saber: que textiles manejan y volumen semanal? Con eso les preparo los numeros!`;
  }

  if (stage === 'cotizado') {
    return `Hola! De GetLavado para *${businessName}*. Queria saber si revisaron la cotizacion. Tienen alguna duda? Pueden probar 1 semana sin compromiso si les ayuda a decidir.`;
  }

  // Default follow-up
  return `Hola! De GetLavado para *${businessName}*. Les escribi hace unos dias sobre lavanderia industrial. Queria hacer seguimiento rapido. Tienen 5 min esta semana para una llamada?`;
}
