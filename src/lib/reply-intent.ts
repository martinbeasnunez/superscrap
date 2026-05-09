// Classify customer WhatsApp replies into high-confidence intents that we can
// auto-respond to safely. Anything ambiguous returns 'unclear' — Alejandro handles.
//
// Design principle: precision over recall. False positives damage relationships
// (auto-closing a hot lead is worse than leaving it manual).

export type ReplyIntent =
  | 'no_interest'         // "no nos interesa" / "ya tenemos proveedor" → close as perdido
  | 'wrong_number'        // "se equivocó" / "no soy" → close as perdido
  | 'confused'            // "no entiendo" / "?" → re-explain in plain language
  | 'asking_price'        // "cuánto cuesta" without volume → request volume to quote
  | 'unclear';            // anything else → human

interface ClassificationResult {
  intent: ReplyIntent;
  confidence: 'high' | 'medium' | 'low';
  matchedPhrase?: string;
}

// Strip common prefixes/sender names like "John: " before matching
function normalize(text: string): string {
  return text
    .replace(/^\[backfill from kapso inbox\]\s*/i, '')
    .replace(/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]{1,40}:\s*/, '') // sender name prefix
    .toLowerCase()
    .trim();
}

// NO_INTEREST patterns — must explicitly say "no" or equivalent close
const NO_INTEREST_PHRASES = [
  'no nos interesa',
  'no me interesa',
  'no estamos interesados',
  'no estoy interesad',
  'no nos interesan',
  'no requerimos',
  'no necesitamos',
  'no necesito',
  'gracias pero no',
  'gracias, no',
  'no, gracias',
  'no gracias',
  'tenemos lavandería propia',
  'tenemos lavanderia propia',
  'lavandería propia',
  'lavanderia propia',
  'ya tenemos proveedor',
  'ya contamos con proveedor',
  'ya tenemos quien',
  'lo hacemos internamente',
  'lo hacemos interno',
  'lavamos internamente',
  'tercerizamos con',
  'trabajamos con otra',
  'estamos cerrando',
  'estamos cerrad',  // estamos cerrados / cerrada
  'el negocio cerró',
  'ya no operamos',
];

// WRONG_NUMBER patterns
const WRONG_NUMBER_PHRASES = [
  'número equivocado',
  'numero equivocado',
  'se equivocó',
  'se equivoco',
  'se ha equivocado',
  'está equivocad',
  'esta equivocad',
  'no soy ',
  'no es ',          // "no es Maryol" — risky alone, only with context
  'a quién busca',
  'a quien busca',
];

// CONFUSED patterns
const CONFUSED_PHRASES = [
  'no entiendo',
  'no comprendo',
  'no le entiendo',
  'no entendí',
  'no entendi',
  '¿qué?',
  'que?',
  'qué dice',
  'que dice',
  'no captó',
  'cómo dice',
  'como dice',
  'perdón?',
  'perdon?',
  'disculpe?',
  'puede repetir',
  'puede explicar',
  'no sé de qué',
  'no se de que',
];

// ASKING_PRICE patterns (without volume context)
const PRICE_PHRASES = [
  'cuánto cuesta',
  'cuanto cuesta',
  'cuánto sale',
  'cuanto sale',
  'cuánto cobran',
  'cuanto cobran',
  'qué precio',
  'que precio',
  'cuál es el precio',
  'cual es el precio',
  'precio por kilo',
  'cuál es la tarifa',
  'cual es la tarifa',
  'cuánto vale',
  'cuanto vale',
];

// Volume signals — if present, asking_price isn't really "no volume"
const VOLUME_SIGNALS = [
  'kilo', 'kg ', ' kg', 'libra',
  'habitacion', 'habitación', 'cuarto',
  'mesa', 'cubierto',
  'toalla', 'sábana', 'sabana', 'manta',
  'uniforme', 'mantel',
  'persona', 'cliente', 'paciente',
  'semana', 'mes ', 'mensual', 'diario',
  'docena', 'unidad',
];

function matchPhrase(text: string, phrases: string[]): string | null {
  for (const p of phrases) {
    if (text.includes(p)) return p;
  }
  return null;
}

export function classifyReplyIntent(rawText: string | null | undefined): ClassificationResult {
  if (!rawText || rawText.trim().length === 0) {
    return { intent: 'unclear', confidence: 'low' };
  }

  const text = normalize(rawText);

  // Very short replies that are JUST punctuation ("?", "??", "...") → confused
  if (/^[?¿!¡.\s]{1,5}$/.test(text)) {
    return { intent: 'confused', confidence: 'high', matchedPhrase: 'short punctuation' };
  }

  // NO_INTEREST — high confidence
  const noMatch = matchPhrase(text, NO_INTEREST_PHRASES);
  if (noMatch) {
    return { intent: 'no_interest', confidence: 'high', matchedPhrase: noMatch };
  }

  // WRONG_NUMBER — high confidence
  const wrongMatch = matchPhrase(text, WRONG_NUMBER_PHRASES);
  if (wrongMatch) {
    // "no soy" / "no es" need extra care — must not be inside a longer phrase
    if (wrongMatch === 'no soy ' || wrongMatch === 'no es ') {
      // Require the message to be short — otherwise too risky
      if (text.length > 60) {
        return { intent: 'unclear', confidence: 'low' };
      }
    }
    return { intent: 'wrong_number', confidence: 'high', matchedPhrase: wrongMatch };
  }

  // CONFUSED — high confidence
  const confusedMatch = matchPhrase(text, CONFUSED_PHRASES);
  if (confusedMatch) {
    return { intent: 'confused', confidence: 'high', matchedPhrase: confusedMatch };
  }

  // ASKING_PRICE without volume
  const priceMatch = matchPhrase(text, PRICE_PHRASES);
  if (priceMatch) {
    const hasVolume = VOLUME_SIGNALS.some(v => text.includes(v));
    if (!hasVolume) {
      return { intent: 'asking_price', confidence: 'high', matchedPhrase: priceMatch };
    }
    // Has volume → leave to Alejandro to quote properly
    return { intent: 'unclear', confidence: 'low' };
  }

  return { intent: 'unclear', confidence: 'low' };
}

// Suggested auto-replies per intent. Plain Spanish, short, no jargon.
export function getAutoReplyText(intent: ReplyIntent): string | null {
  switch (intent) {
    case 'no_interest':
      return `Entendido, muchas gracias por su tiempo! 🙏\n\nCualquier cosa más adelante, quedamos a la orden.`;

    case 'wrong_number':
      return `Disculpe la confusión, fue un error de mi parte. Que tenga buen día! 🙏`;

    case 'confused':
      return `Disculpe! Soy Alejandro de GetLavado — lavamos textiles para negocios (toallas, sábanas, uniformes). Recogemos y entregamos.\n\n¿Sería de interés para ustedes?`;

    case 'asking_price':
      return `Hola! Para pasarles precio exacto necesito saber el volumen aproximado por semana — kg, cantidad de toallas, sábanas o uniformes.\n\n¿Cuánto manejan más o menos? 📊`;

    default:
      return null;
  }
}

// Whether the intent should also trigger a stage change to "perdido"
export function shouldCloseAsLost(intent: ReplyIntent): boolean {
  return intent === 'no_interest' || intent === 'wrong_number';
}
