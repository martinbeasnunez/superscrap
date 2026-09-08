// Reactivación B2B — Fase 2: guiones y mensajes por segmento (del PDF "Guiones y
// Mensajes · Misión 2"). Viven en la ficha para copiar/pegar sin editar a mano.
//
// Placeholders: {empresa} {contacto} {marca} {descuento} {descuentoMax}
//  - {empresa}       → nombre del cliente de la ficha
//  - {contacto}      → nombre de la persona; si vacío, se usa {empresa}
//  - {marca}         → marca en los textos (default "Lavado"), editable
//  - {descuento}     → descuento de la ficha (empieza 10, tope 15)
//  - {descuentoMax}  → descuento de urgencia (15)

export const BRAND_DEFAULT = 'GetLavado';
export const DISCOUNT_START = 10;
export const DISCOUNT_MAX = 15;
export const SEND_WINDOW = 'mar–jue · 8–10am / 12–2pm';

export interface FillVars {
  empresa: string;
  contacto?: string | null;
  marca?: string | null;
  descuento?: number | null;
}

// Reemplaza los placeholders por los valores finales de la ficha.
export function fillTemplate(text: string, v: FillVars): string {
  const empresa = v.empresa || '';
  const contacto = (v.contacto && v.contacto.trim()) || empresa;
  const marca = (v.marca && v.marca.trim()) || BRAND_DEFAULT;
  const descuento = v.descuento ?? DISCOUNT_START;
  return text
    .replace(/\{empresa\}/g, empresa)
    .replace(/\{contacto\}/g, contacto)
    .replace(/\{marca\}/g, marca)
    .replace(/\{descuento\}/g, String(descuento))
    .replace(/\{descuentoMax\}/g, String(DISCOUNT_MAX));
}

// --- WhatsApp: Tier B (medianos) ---
export const TIER_B = {
  firstTouch:
    'Hola {empresa} 👋 Soy Joaquín de {marca}. Vi que hace un tiempo no coordinamos tu lavado y quería reactivarte esta semana con un {descuento}% de descuento. Recojo y entrega gratis, tú no te mueves. ¿Te agendo un recojo?',
};

// --- WhatsApp: Tier C (chicas) — dos variantes ---
export const TIER_C = {
  firstTouch:
    'Hola {empresa} 🧺 Tenemos rutas activas en tu zona esta semana y un {descuento}% para ti. Recojo y entrega gratis. ¿Agendamos hoy?',
  soft:
    'Hola {empresa} 👋 ¿Coordinamos tu lavado de esta semana? Recogemos y entregamos gratis. ¿Te agendo un recojo?',
};

// --- 2do toque (Tier B y C) · a los 7 días → LLAMADA (solo a los que no respondieron) ---
export const SECOND_TOUCH = {
  hint: 'No mandes otro WhatsApp — llámalos. Convierte más y no quema el número.',
  script:
    'Hola {contacto}, te habla Joaquín de {marca} 👋 Te escribí hace unos días — te llamo rapidito porque activamos un {descuentoMax}% solo por esta semana y no quería que te lo pierdas. Ideal para adelantar ropa de cama, mantelería o uniformes acumulados. ¿Te coordino el recojo?',
  close: 'Cierra con día y hora concretos.',
};

// --- Tier A · guion de llamada por pasos (para leer/guiar, no se pega) ---
export interface TierAPath { k: string; t: string }
export interface TierAStep {
  n: number;
  title: string;
  subtitle: string;
  quote?: string;
  copy?: boolean;      // solo la apertura lleva "Copiar"
  note?: string;
  paths?: TierAPath[];
}

export const TIER_A = {
  intro:
    'No es una llamada de descuento, es reconectar una relación. Primero escuchas por qué pausaron; recién después ofreces. Si aparece un reclamo, no vendes: lo resuelves.',
  steps: [
    {
      n: 1,
      title: 'Apertura',
      subtitle: 'Cálida y personal, que sientan que es por ellos',
      quote:
        'Hola {contacto}, te habla Fernanda de {marca} 👋 ¿Cómo va todo? Te llamo directamente porque {empresa} es de nuestros clientes importantes y vi que hace un tiempo no coordinamos un recojo. Quería saber cómo están y si todo bien con nosotros.',
      copy: true,
    },
    {
      n: 2,
      title: 'Escuchar',
      subtitle: 'Acá está la clave — deja que hablen. Vas a caer en uno de tres caminos:',
      paths: [
        { k: 'Problema', t: '"Algo salió mal / se perdió algo" → no vendas. "Lamento eso, déjame encargarme yo. ¿Me cuentas qué pasó?" Anótalo y pásalo al flujo de reclamos. Recién cuando esté resuelto se ofrece volver.' },
        { k: 'Se fueron', t: '"Ya no usamos / conseguimos otro" → indaga por qué (precio, tiempos, calidad) antes de ofrecer nada.' },
        { k: 'Se pausó', t: '"Nada, se nos pasó / bajó el movimiento" → esa es la fácil, pasa a ofrecer.' },
      ],
    },
    {
      n: 3,
      title: 'Ofrecer',
      subtitle: 'Trato preferente, empezando suave',
      quote:
        'Me encantaría tenerte de vuelta esta semana. Te dejo un {descuento}% en tu próximo recojo y yo misma te coordino la ruta el día que te quede mejor. El recojo y la entrega siguen siendo gratis.',
      note: 'Empieza en {descuento}%. Solo si dudan, sube a {descuentoMax}% — no pases de ahí.',
    },
    {
      n: 4,
      title: 'Cerrar con acción',
      subtitle: 'Sal de la llamada con día y hora, no con un "lo pienso"',
      quote: '¿Te agendo el recojo para mañana o el jueves? ¿En la mañana o al mediodía?',
    },
  ] as TierAStep[],
  objeciones: [
    { k: '"Está caro"', t: 'Resalta recojo + entrega gratis y que tú coordinas todo; ofrece el {descuentoMax}%.' },
    { k: '"No tengo volumen"', t: '"Sin problema, ¿te escribo a fin de mes para retomar?" — agenda el seguimiento.' },
    { k: '"Déjame ver"', t: '"Claro, ¿te llamo el jueves?" — no lo dejes abierto.' },
  ] as TierAPath[],
};
