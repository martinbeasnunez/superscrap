import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchAll } from '@/lib/hunt';
import { isLikelyBotReply } from '@/lib/reply-classifier';
import { postSlackText } from '@/lib/slack';
import { getNumberQuality, getTemplateStatuses, isQualityDegraded } from '@/lib/kapso';

// Reporte diario de salud del pipeline B2B → Slack. Lo dispara el cron de Vercel (vercel.json)
// al cierre del día hábil, así no depende de ninguna computadora. Solo lee y avisa.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Si hay CRON_SECRET, Vercel lo manda como Bearer; sin él el endpoint queda abierto (solo lee).
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // "Hoy" en hora de Lima (UTC-5): desde las 00:00 Lima.
  const limaNow = new Date(Date.now() - 5 * 3600_000);
  const dayStartUtc = new Date(Date.UTC(limaNow.getUTCFullYear(), limaNow.getUTCMonth(), limaNow.getUTCDate(), 5, 0, 0)).toISOString();
  const dow = limaNow.getUTCDay(); // 0 dom … 6 sáb
  const weekday = dow >= 1 && dow <= 5;

  const rows = await fetchAll<{ business_id: string; action_type: string; notes: string | null; created_at: string }>(
    (from, to) =>
      supabase
        .from('contact_history')
        .select('business_id, action_type, notes, created_at')
        .gte('created_at', dayStartUtc)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to));

  const botSends = rows.filter((r) => r.action_type === 'auto_whatsapp');
  const moved = rows.filter((r) => r.action_type === 'stage_change' && /Auto-avance/.test(r.notes || '')).length;
  const brainReplies = rows.filter((r) => r.action_type === 'auto_whatsapp_reply' && (r.notes || '').startsWith('[cerebro B2B')).length;
  const qualified = rows.filter((r) => r.action_type === 'stage_change' && /\(cerebro B2B\)/.test(r.notes || '')).length;
  const humanReplies = rows.filter((r) => r.action_type === 'whatsapp_reply' && !isLikelyBotReply(r.notes) && /[a-záéíóúñ]/i.test(r.notes || ''));

  // Control: leads que respondieron como persona (alguna vez) y hoy recibieron mensaje del bot.
  const sentIds = [...new Set(botSends.map((r) => r.business_id))];
  let leaks: string[] = [];
  if (sentIds.length) {
    const replied = await fetchAll<{ business_id: string; notes: string | null }>(
      (from, to) =>
        supabase
          .from('contact_history')
          .select('business_id, notes')
          .eq('action_type', 'whatsapp_reply')
          .in('business_id', sentIds)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to));
    const humanSet = new Set(replied.filter((r) => !isLikelyBotReply(r.notes) && /[a-záéíóúñ]/i.test(r.notes || '')).map((r) => r.business_id));
    leaks = sentIds.filter((id) => humanSet.has(id));
  }

  const quality = await getNumberQuality();
  const tpl = await getTemplateStatuses('orbit_s3_');
  const tplList = Object.entries(tpl);
  const tplApproved = tplList.filter(([, st]) => st === 'APPROVED').length;
  const tplBad = tplList.filter(([, st]) => st === 'REJECTED' || st === 'PAUSED' || st === 'DISABLED');
  const problems: string[] = [];
  if (quality && isQualityDegraded(quality.rating)) problems.push(`🛑 *Calidad del número en ${quality.rating}*: el bot está pausado hasta que vuelva a verde.`);
  if (!quality) problems.push('⚠️ No pude leer la calidad del número (Kapso no respondió).');
  if (weekday && botSends.length === 0) problems.push('⚠️ *El bot no envió ningún mensaje hoy.* Revisa cron-job.org (job pausado o sin saldo).');
  if (leaks.length) problems.push(`⚠️ ${leaks.length} lead(s) que ya respondieron recibieron mensaje del bot hoy.`);

  if (tplBad.length) problems.push(`⚠️ Plantillas con problema en Meta: ${tplBad.map(([n, st]) => `${n} (${st})`).join(', ')}. Hay que reenviarlas con otro texto.`);
  const lines = [
    `📊 *ORBIT — cierre del día* ${problems.length ? '🔴' : '🟢'}`,
    `• Mensajes del bot: *${botSends.length}* · Cards movidas: *${moved}*`,
    `• Respuestas reales de clientes: *${humanReplies.length}* · Respondió el cerebro solo: *${brainReplies}* · Leads calificados: *${qualified}*`,
    `• Calidad del número (Meta): *${quality?.rating ?? 'sin dato'}*${quality?.limit ? ` · límite ${quality.limit}` : ''}`,
    tplList.length ? `• Plantillas seguimiento_3: *${tplApproved}/${tplList.length} aprobadas*${tplApproved === tplList.length ? ' ✅ (ya se envían los 5 textos nuevos)' : ' · mientras tanto el bot no envía en seguimiento_3 fuera de ventana'}` : null,
    ...problems,
  ].filter(Boolean);

  const sent = weekday || problems.length ? await postSlackText(lines.join('\n')) : false;
  return NextResponse.json({ ok: true, weekday, botSends: botSends.length, moved, brainReplies, qualified, humanReplies: humanReplies.length, leaks: leaks.length, slack: sent, quality: quality?.rating ?? null });
}
