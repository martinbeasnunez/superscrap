// Heuristic to detect generic auto-bot replies vs real human responses.
// Most Peruvian B2B WhatsApp accounts have bot greetings configured ("Gracias por
// comunicarte con...", "Hola, somos X. ¿Cómo podemos ayudar?"). These are NOT real
// engagement — the human hasn't seen the message yet.

const BOT_PHRASES = [
  // Generic auto-replies
  'gracias por comunicarte',
  'gracias por contactarnos',
  'gracias por tu mensaje',
  'gracias por escribirnos',
  'gracias por contactar',
  'gracias por su mensaje',
  // Self-introduction bots
  'somos el ',     // "Hola, somos el centro..."
  'somos la ',
  'somos un ',     // "Somos un espacio de bienestar..."
  'somos una ',
  'te saluda',
  // Welcome bots
  'bienvenido',
  'bienvenida',
  // Formal openers
  'estimado(a)',
  'estimado/a',
  // Generic helpfulness questions
  '¿cómo podemos ayudar',
  '¿cómo puedo ayudar',
  '¿en qué puedo ayudar',
  '¿en qué podemos ayudar',
  'tu mensaje es importante',
];

export function isLikelyBotReply(text: string | null | undefined): boolean {
  if (!text) return false;
  // Strip the "[backfill from kapso inbox] " prefix used in historical rows
  const cleaned = text.replace(/^\[backfill from kapso inbox\]\s*/, '').toLowerCase();
  // Only check the first 120 chars — bot greeting patterns appear at the start
  const head = cleaned.slice(0, 120);
  return BOT_PHRASES.some(p => head.includes(p));
}
