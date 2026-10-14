import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage, sendWhatsAppTemplate } from '@/lib/kapso';
import { getWhatsAppPitchServer } from '@/lib/whatsapp-pitch';

// Envío del bot por el número ORBIT (Kapso). Lo comparten el cron de auto-followup y la
// aprobación de la caza del día (que manda el primer WhatsApp al instante, sin esperar
// la próxima pasada del cron).

// Primero texto libre; fuera de la ventana de 24h WhatsApp lo rechaza y va la plantilla.
export async function sendWithFallback(phone: string, pitch: string, bizName: string, stage: string, address?: string | null) {
  const textResult = await sendWhatsAppMessage(phone, pitch);
  if (textResult.success) return { ...textResult, method: 'text' as const };
  if (textResult.error?.includes('24-hour') || textResult.error?.includes('Re-engagement')) {
    const templateResult = await sendWhatsAppTemplate(phone, bizName, stage, address);
    return { ...templateResult, method: 'template' as const };
  }
  return { ...textResult, method: 'text' as const };
}

// El bot escribe en horario de oficina de Lima, de lunes a viernes. Fuera de eso, el primer
// mensaje queda para la siguiente pasada del cron.
export function isBotSendingWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima', weekday: 'short', hour: 'numeric', hour12: false,
  }).formatToParts(now);
  const day = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return day !== 'Sat' && day !== 'Sun' && hour >= 8 && hour < 19;
}

export interface FirstTouchResult {
  sent: boolean;
  reason?: 'outside_window' | 'not_new' | 'no_phone' | 'send_failed';
  error?: string;
}

// Primer contacto de un lead SIN dueño que sigue en 'nuevo': mismo efecto que la primera
// pasada del cron (mensaje de apertura, stage → contactado, historial), para que la escalera
// de seguimientos continúe desde ahí.
export async function sendFirstBotTouch(businessId: string): Promise<FirstTouchResult> {
  if (!isBotSendingWindow()) return { sent: false, reason: 'outside_window' };

  const { data: biz } = await supabase
    .from('businesses')
    .select('id, name, phone, address, business_type, sales_stage, contact_actions, searches (business_type)')
    .eq('id', businessId)
    .maybeSingle();
  if (!biz?.phone) return { sent: false, reason: 'no_phone' };
  const stage = biz.sales_stage || 'nuevo';
  if (stage !== 'nuevo') return { sent: false, reason: 'not_new' };

  const search = Array.isArray(biz.searches) ? biz.searches[0] : biz.searches;
  const businessType = (search as { business_type?: string } | null)?.business_type || biz.business_type;
  const nextStage = 'contactado';
  const pitch = getWhatsAppPitchServer(biz.name, businessType, nextStage, 0);

  const result = await sendWithFallback(biz.phone, pitch, biz.name, nextStage, biz.address);
  if (!result.success) return { sent: false, reason: 'send_failed', error: result.error };

  const now = new Date().toISOString();
  await supabase.from('contact_history').insert([
    { business_id: biz.id, action_type: 'stage_change', notes: `📋 Auto-avance: ${stage} → ${nextStage}` },
    { business_id: biz.id, action_type: 'auto_whatsapp', notes: pitch },
  ]);
  await supabase.from('businesses').update({
    sales_stage: nextStage,
    contacted_at: now,
    auto_followup_last_sent: now,
    contact_actions: [...((biz.contact_actions as string[] | null) || []).filter((a) => a !== 'whatsapp'), 'whatsapp'],
  }).eq('id', biz.id);

  return { sent: true };
}
