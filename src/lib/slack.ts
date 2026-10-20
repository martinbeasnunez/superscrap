// Avisos a Slack por Incoming Webhook (SLACK_WEBHOOK_URL).
// Sin la variable configurada no hace nada: el flujo de WhatsApp nunca depende de Slack.

const ORBIT_URL = process.env.ORBIT_URL || 'https://superscrap.vercel.app';
// Proyecto de Kapso donde vive el número de ORBIT (bandeja de conversaciones).
const KAPSO_PROJECT_ID = process.env.KAPSO_PROJECT_ID || '420a8328-9366-4b26-8fcf-cf347b28f039';

export interface ReplyAlert {
  businessId: string;
  businessName: string;
  // Conversación en la bandeja de Kapso (para leer el hilo completo y contestar desde ahí).
  conversationId?: string | null;
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
  // Borrador del cerebro B2B (no enviado) y qué recomienda hacer.
  draft?: string | null;
  draftAction?: string | null;
  // Señal de compra: la card pasó sola a "interesado" y el bot quedó apagado.
  qualified?: boolean;
  // El cerebro ya envió el borrador solo (no hay que copiarlo).
  draftSent?: boolean;
}

// A quién etiquetar en cada aviso: IDs de miembro de Slack. Slack solo notifica con el ID
// (<@U…>); escribir "@nombre" como texto no etiqueta a nadie.
// Por defecto: Martín (U07DPU4MRKM) y Alejandro Ramos (U07EBT6HKQU).
// SLACK_MENTION_IDS="U01ABC,U02DEF" los reemplaza sin tocar el código.
const DEFAULT_MENTION_IDS = 'U07DPU4MRKM,U07EBT6HKQU';

function mentions(): string {
  return (process.env.SLACK_MENTION_IDS || DEFAULT_MENTION_IDS)
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[UW][A-Z0-9]+$/.test(id))
    .map((id) => `<@${id}>`)
    .join(' ');
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
  const tags = mentions();
  const lines = [
    alert.qualified
      ? `🔥 *LEAD CALIFICADO — ${esc(alert.businessName)}*${who}${tags ? ` · ${tags}` : ''}\n_Pasó a *interesado* y el bot se apagó. Atiéndelo tú._`
      : `💬 *${esc(alert.businessName)}*${who} respondió${tags ? ` · ${tags}` : ''}`,
    `> ${esc(alert.message.slice(0, 500)).replace(/\n/g, '\n> ')}`,
    facts,
    alert.autoReplyIntent ? `🤖 El bot ya contestó solo (${esc(alert.autoReplyIntent)})` : null,
    // Solo se muestra lo que el cerebro YA envió; el borrador sin enviar no va a Slack (vive en ORBIT).
    alert.draft && alert.draftSent
      ? `🤖 *El cerebro ya respondió solo:*\n> ${esc(alert.draft.slice(0, 600)).replace(/\n/g, '\n> ')}`
      : null,
    alert.conversationId
      ? `<https://app.kapso.ai/projects/${KAPSO_PROJECT_ID}/inbox?conversation_id=${encodeURIComponent(alert.conversationId)}|Ver conversación>`
      : null,
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

// Mensaje libre a Slack (reportes de salud). Nunca rompe el flujo que lo llama.
export async function postSlackText(text: string): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch (error) {
    console.error('Slack text error:', error);
    return false;
  }
}
