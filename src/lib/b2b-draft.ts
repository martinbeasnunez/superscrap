import { supabase } from '@/lib/supabase';
import { runB2bBrain, type BrainOutput, type BrainTurn } from '@/lib/b2b-brain';

// Modo del cerebro B2B: 'off' no hace nada; 'draft' solo redacta borradores que un humano aprueba;
// 'auto' (por defecto) contesta solo los casos simples con las guardas de abajo.
// Interruptor sin tocar código: B2B_BRAIN_MODE=draft|off en Vercel.
export function brainMode(): 'off' | 'draft' | 'auto' {
  const m = process.env.B2B_BRAIN_MODE;
  return m === 'off' ? 'off' : m === 'draft' ? 'draft' : 'auto';
}

// Solo estas intenciones se contestan solas. Lo demás (no, gatekeeper, gerencia, reunión, dudas)
// queda como borrador + aviso a un humano.
export const AUTO_INTENTS = ['pide_info', 'pide_precio', 'pide_propuesta', 'interesado', 'lava_interno', 'confuso'];

// Guardas para responder solo. true = se puede enviar automáticamente.
export async function canAutoReply(businessId: string, opts: { isManualLead: boolean; autoFollowupEnabled: boolean | null }): Promise<boolean> {
  if (opts.isManualLead) return false;                    // cuentas curadas a mano: solo humanos
  if (opts.autoFollowupEnabled === false) return false;   // un humano ya tomó la conversación
  const now = Date.now();
  const since30d = new Date(now - 30 * 86400000).toISOString();
  const { data } = await supabase
    .from('contact_history')
    .select('action_type, notes, created_at')
    .eq('business_id', businessId)
    .gte('created_at', since30d)
    .in('action_type', ['whatsapp', 'auto_whatsapp_reply']);
  const rows = data || [];
  // WhatsApp personal del GM en el último mes → es su conversación.
  if (rows.some((r) => r.action_type === 'whatsapp' && /personal/i.test(r.notes || ''))) return false;
  const brainReplies = rows.filter((r) => r.action_type === 'auto_whatsapp_reply' && (r.notes || '').startsWith('[cerebro B2B'));
  if (brainReplies.length >= 3) return false;              // máximo 3 respuestas automáticas por lead
  if (brainReplies.some((r) => now - new Date(r.created_at).getTime() < 60_000)) return false; // ráfaga de mensajes
  return true;
}

const COMM = ['whatsapp_reply', 'auto_whatsapp', 'whatsapp', 'auto_whatsapp_reply'];

// Arma la conversación real del lead y le pide al cerebro el borrador de respuesta.
// Devuelve null si no hay nada a que responder (el último mensaje no es de ellos).
export async function draftReplyForBusiness(businessId: string): Promise<BrainOutput | null> {
  const [{ data: biz }, { data: hist }] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, name, business_type, searches (business_type)')
      .eq('id', businessId)
      .maybeSingle(),
    supabase
      .from('contact_history')
      .select('action_type, notes, created_at')
      .eq('business_id', businessId)
      .in('action_type', COMM)
      .order('created_at', { ascending: false })
      .limit(14),
  ]);
  if (!biz || !hist || hist.length === 0) return null;

  const chron = [...hist].reverse();
  let last = chron.length - 1;
  while (last >= 0 && chron[last].action_type !== 'whatsapp_reply') last--;
  if (last < 0) return null;

  const turns: BrainTurn[] = chron.slice(0, last + 1).map((h) => ({
    from: h.action_type === 'whatsapp_reply' ? 'ellos' : 'nosotros',
    text: h.notes || '',
  }));
  const search = Array.isArray(biz.searches) ? biz.searches[0] : biz.searches;
  const businessType = (search as { business_type?: string } | null)?.business_type || biz.business_type;
  const hours = Math.round((Date.now() - new Date(chron[last].created_at).getTime()) / 3600000);

  return runB2bBrain({ businessName: biz.name, businessType, transcript: turns, hoursSinceLastInbound: hours });
}
