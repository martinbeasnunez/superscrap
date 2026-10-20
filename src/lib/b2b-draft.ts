import { supabase } from '@/lib/supabase';
import { runB2bBrain, type BrainOutput, type BrainTurn } from '@/lib/b2b-brain';

// Modo del cerebro B2B: 'off' no hace nada, 'draft' (por defecto) solo redacta borradores
// que un humano aprueba. Nunca envía solo.
export function brainMode(): 'off' | 'draft' {
  return process.env.B2B_BRAIN_MODE === 'off' ? 'off' : 'draft';
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
