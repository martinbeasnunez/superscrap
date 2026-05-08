// Heuristic to detect generic auto-bot replies vs real human responses.
// Most Peruvian B2B WhatsApp accounts have bot greetings configured ("Gracias por
// comunicarte con...", "Hola, somos X. ¿Cómo podemos ayudar?"). These are NOT real
// engagement — the human hasn't seen the message yet.

const BOT_PHRASES = [
  // Explicit auto-reply markers
  'mensaje automático',
  'mensaje automatico',
  'respuesta automática',
  'respuesta automatica',
  // Generic auto-replies — "gracias por X"
  'gracias por comunicarte',
  'gracias por comunicarse',     // formal "se" form
  'gracias por contactarnos',
  'gracias por contactarte',
  'gracias por contactarse',     // formal "se"
  'gracias por contactar',       // catches "contactar a X"
  'gracias por tu mensaje',
  'gracias por su mensaje',
  'gracias por escribir',        // broader — catches "escribir a", "escribirnos", "escribirme"
  // Self-introduction bots
  'somos el ',
  'somos la ',
  'somos un ',
  'somos una ',
  'te saluda',
  'le saluda',                   // formal "le saluda X, asistente..."
  'asistente de',                // "asistente de la Doctora..."
  // Welcome bots — broader root catches "Bienvenido", "Bienvenida", "Bienvenid@", "Bienvenid(a)", "Bienvenid😄"
  'bienvenid',
  // Formal openers
  'estimado(a)',
  'estimado/a',
  'estimada(o)',
  'estimado paciente',
  'estimada paciente',
  // Wait/handoff bots
  'lo atenderemos',
  'le atenderemos',
  'te atenderemos',
  'lo atenderán',
  'le atenderán',
  'estoy aquí para responder',
  'estoy aqui para responder',
  // Generic helpfulness questions
  '¿cómo podemos ayudar',
  '¿cómo puedo ayudar',
  '¿en qué puedo ayudar',
  '¿en qué podemos ayudar',
  'tu mensaje es importante',
  // Hours-of-operation auto-replies
  'horario de atención',
  'horario de atencion',
  // English bots
  'thank you for contacting',
  'thanks for contacting',
  'welcome to ',
];

export function isLikelyBotReply(text: string | null | undefined): boolean {
  if (!text) return false;
  // Strip the "[backfill from kapso inbox] " prefix used in historical rows
  const cleaned = text.replace(/^\[backfill from kapso inbox\]\s*/, '').toLowerCase();
  // Only check the first 160 chars — bot greeting patterns appear at the start
  // (slightly larger window since some bots open with emoji/greeting before the marker)
  const head = cleaned.slice(0, 160);
  return BOT_PHRASES.some(p => head.includes(p));
}
