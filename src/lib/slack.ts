// Avisos a Slack por Incoming Webhook (SLACK_WEBHOOK_URL).
// Sin la variable configurada no hace nada: el flujo de WhatsApp nunca depende de Slack.

const ORBIT_URL = process.env.ORBIT_URL || 'https://superscrap.vercel.app';

export interface ReplyAlert {
  businessName: string;
  phone: string | null;
  contactName?: string | null;
  message: string;
  tier?: string | null;
  revenueMin?: number | null;
  revenueMax?: number | null;
  ownerName?: string | null;
  fromHunt?: boolean;
  // Si el bot ya contestó solo, qué entendió ("pide_info", "no_interesado", ...).
  autoReplyIntent?: string | null;
}

// Slack usa su propio escape para &, < y >.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function waLink(phone: string): string {
  const c = phone.replace(/\D/g, '').replace(/^0+/, '');
  return `https://wa.me/${c.startsWith('51') ? c : `51${c}`}`;
}

export async function notifyReplyOnSlack(alert: ReplyAlert): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;

  const soles = (n: number) => `S/${Math.round(n).toLocaleString('es-PE')}`;
  const facts = [
    alert.tier === 'orca' ? '🐋 orca' : alert.tier === 'delfin' ? '🐬 delfín' : null,
    alert.revenueMin != null && alert.revenueMax != null
      ? `${soles(alert.revenueMin)}–${soles(alert.revenueMax)}/mes`
      : null,
    alert.fromHunt ? '🎯 caza del día' : null,
    alert.ownerName ? `dueño: ${alert.ownerName}` : 'sin dueño',
  ].filter(Boolean).join(' · ');

  const who = alert.contactName ? ` (${esc(alert.contactName)})` : '';
  const lines = [
    `💬 *${esc(alert.businessName)}*${who} respondió`,
    `> ${esc(alert.message.slice(0, 500)).replace(/\n/g, '\n> ')}`,
    facts,
    alert.autoReplyIntent ? `🤖 El bot ya contestó solo (${esc(alert.autoReplyIntent)})` : null,
    [
      alert.phone ? `<${waLink(alert.phone)}|Responder por WhatsApp>` : null,
      `<${ORBIT_URL}/seguimiento|Abrir ORBIT>`,
    ].filter(Boolean).join('  ·  '),
  ].filter(Boolean);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) console.error('Slack notify failed:', res.status, await res.text());
    return res.ok;
  } catch (error) {
    console.error('Slack notify error:', error);
    return false;
  }
}
