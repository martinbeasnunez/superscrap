export type SalesStage = 'nuevo' | 'contactado' | 'seguimiento_1' | 'seguimiento_2' | 'seguimiento_3' | 'interesado' | 'cotizado';

export interface EmailTemplate {
  id: string;
  stage: SalesStage | 'closing';
  subject: string;
  body: string;
}

interface TemplateVars {
  businessName: string;
  industria: string;
  textiles: string;
}

const SIGNATURE = `\n---\n\n*Alejandro Ramos*\nBusiness Development · GetLavado\n+51 928 113 653`;

// ============================================================
// NUEVO - First contact (5 variants)
// ============================================================
const NUEVO_TEMPLATES: EmailTemplate[] = [
  {
    id: 'nuevo_pain',
    stage: 'nuevo',
    subject: '{{businessName}} - pregunta rapida sobre lavanderia',
    body: `Hola equipo de *{{businessName}}*

El 73% de empresas en Peru gastan *40% de mas* en lavanderia.

Somos lavanderia industrial. Recogemos {{textiles}} en su local y los devolvemos impecables. Asi de simple.

*10 min para mostrarles numeros?*${SIGNATURE}`,
  },
  {
    id: 'nuevo_social',
    stage: 'nuevo',
    subject: 'Como {{industria}}s similares reducen 40% en lavanderia',
    body: `Hola equipo de *{{businessName}}*

+800 empresas nos eligen. Hoteles 5 estrellas, clinicas, restaurantes top.

Hacemos simple lo que ustedes hacen complejo: {{textiles}} impecables, sin que muevan un dedo.

*Les paso una cotizacion sin compromiso?*${SIGNATURE}`,
  },
  {
    id: 'nuevo_direct',
    stage: 'nuevo',
    subject: 'Lavanderia industrial para {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Somos GetLavado. Recojo y entrega de {{textiles}} en su local.

3 razones para hablar 5 min:
- Hasta 40% menos que hacerlo interno
- Capacidad para alto volumen
- 0 problemas, nosotros nos encargamos

*Les interesa cotizar?*${SIGNATURE}`,
  },
  {
    id: 'nuevo_curiosity',
    stage: 'nuevo',
    subject: 'Estan pagando de mas por {{textiles}}?',
    body: `Hola equipo de *{{businessName}}*

Pregunta seria: cuanto gastan al mes en lavar {{textiles}}?

La mayoria de {{industria}}s que contactamos descubren que pagan *40% mas* de lo necesario.

*Un "si me interesa" y les mando numeros reales.*${SIGNATURE}`,
  },
  {
    id: 'nuevo_case',
    stage: 'nuevo',
    subject: 'Un(a) {{industria}} en Miraflores ahorro S/1,800/mes',
    body: `Hola equipo de *{{businessName}}*

Un(a) {{industria}} en Miraflores gestionaba {{textiles}} internamente. Ahora nos lo terceriza y ahorra S/1,800/mes.

Recogemos, lavamos, devolvemos. Ustedes solo apilan.

*5 min para contarles como funciona?*${SIGNATURE}`,
  },
  {
    id: 'nuevo_question',
    stage: 'nuevo',
    subject: '{{businessName}} - quien lava sus {{textiles}}?',
    body: `Hola equipo de *{{businessName}}*

Pregunta directa: tienen proveedor de lavanderia o lo hacen interno?

Sea cual sea, les puedo mostrar como ahorrar. Sin compromiso, sin presion.

*Responden con un "si" y les mando info.*${SIGNATURE}`,
  },
];

// ============================================================
// CONTACTADO / SEGUIMIENTO_1 - Follow-up (5 variants)
// ============================================================
const FOLLOWUP_TEMPLATES: EmailTemplate[] = [
  {
    id: 'followup_gentle',
    stage: 'contactado',
    subject: 'Re: Lavanderia para {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Les escribi hace unos dias sobre lavanderia industrial. Solo queria saber si tuvieron chance de verlo.

*Tienen 5 min para una llamada rapida?*${SIGNATURE}`,
  },
  {
    id: 'followup_value',
    stage: 'contactado',
    subject: 'Dato interesante para {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Seguimiento a mi mensaje anterior. Un dato: el costo promedio de lavar {{textiles}} internamente es *2.5x* mas que tercerizarlo.

*Les mando los numeros especificos para su caso?*${SIGNATURE}`,
  },
  {
    id: 'followup_easy',
    stage: 'contactado',
    subject: 'Sin compromiso - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Se que estan ocupados. Solo 2 opciones:

1. *"Si, mandame cotizacion"* - se las preparo
2. *"No me interesa"* - los dejo tranquilos

Cualquier respuesta me sirve${SIGNATURE}`,
  },
  {
    id: 'followup_fomo',
    stage: 'contactado',
    subject: 'Esto le funciono a un(a) {{industria}} como ustedes',
    body: `Hola equipo de *{{businessName}}*

Un(a) {{industria}} que contactamos el mes pasado ya empezo con nosotros. Ahorra S/2,000+/mes.

*Quieren que les prepare los mismos numeros para su caso?*${SIGNATURE}`,
  },
  {
    id: 'followup_short',
    stage: 'contactado',
    subject: 'Seguimiento rapido - GetLavado',
    body: `Hola equipo de *{{businessName}}*

Les escribi sobre lavanderia industrial para {{textiles}}.

*Les interesa o prefieren que no los contacte mas?*

Cualquier respuesta me ayuda${SIGNATURE}`,
  },
];

// ============================================================
// SEGUIMIENTO_2 - Urgent follow-up (5 variants)
// ============================================================
const SEGUIMIENTO2_TEMPLATES: EmailTemplate[] = [
  {
    id: 'seg2_direct',
    stage: 'seguimiento_2',
    subject: 'Re: Lavanderia - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Les he escrito un par de veces. Entiendo que estan ocupados.

Pregunta directa: *les interesa cotizar lavanderia industrial?*

Si no, sin problema. Un "no" me ayuda a no molestarlos mas${SIGNATURE}`,
  },
  {
    id: 'seg2_provider',
    stage: 'seguimiento_2',
    subject: 'Tienen proveedor? - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Si ya tienen proveedor de lavanderia y estan contentos, me encantaria saberlo.

Si no lo tienen o quieren comparar precios, *les preparo una cotizacion en 24 hrs*.

Que me dicen?${SIGNATURE}`,
  },
  {
    id: 'seg2_savings',
    stage: 'seguimiento_2',
    subject: 'S/1,500+ de ahorro potencial - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Segun el volumen tipico de un(a) {{industria}}, podrian estar ahorrando *S/1,500+/mes* en {{textiles}}.

*Quieren que les haga el calculo exacto?* Es gratis y sin compromiso${SIGNATURE}`,
  },
  {
    id: 'seg2_busy',
    stage: 'seguimiento_2',
    subject: 'Se que estan ocupados - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Se que estan super ocupados. No quiero molestar.

Pero si en algun momento quieren reducir costos de lavanderia, *respondan este email y les mando info*.

Sino, los dejo tranquilos${SIGNATURE}`,
  },
  {
    id: 'seg2_last',
    stage: 'seguimiento_2',
    subject: 'Ultimo seguimiento - GetLavado para {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Este es mi ultimo seguimiento sobre lavanderia industrial.

*Si les interesa: responden "si" y les mando cotizacion.*
*Si no: sin problema, gracias por su tiempo.*${SIGNATURE}`,
  },
];

// ============================================================
// SEGUIMIENTO_3 - Final attempt (5 variants)
// ============================================================
const SEGUIMIENTO3_TEMPLATES: EmailTemplate[] = [
  {
    id: 'seg3_close',
    stage: 'seguimiento_3',
    subject: 'Cerrando el tema - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Les he escrito varias veces sobre lavanderia industrial. Entiendo que no es prioridad ahora.

*Cierro el tema de mi lado.* Si algun dia necesitan cotizar, mi contacto queda arriba.

Exitos!${SIGNATURE}`,
  },
  {
    id: 'seg3_door',
    stage: 'seguimiento_3',
    subject: 'La puerta queda abierta - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

No los voy a molestar mas con esto. Pero la puerta queda abierta:

Si algun dia quieren *cotizar lavanderia industrial*, me escriben y les respondo en 24 hrs.

Saludos!${SIGNATURE}`,
  },
  {
    id: 'seg3_recap',
    stage: 'seguimiento_3',
    subject: 'Resumen rapido - GetLavado',
    body: `Hola equipo de *{{businessName}}*

Resumen de lo que ofrecemos (por si lo necesitan a futuro):

- Lavanderia industrial, recojo y entrega
- Ahorro de ~40% vs hacerlo interno
- +800 clientes en Peru

*Mi linea directa queda arriba.* Exitos!${SIGNATURE}`,
  },
  {
    id: 'seg3_friendly',
    stage: 'seguimiento_3',
    subject: 'Sin rencores - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Se que probablemente vieron mis mensajes y no era el momento. Esta perfecto.

*Guarden mi contacto.* Cuando necesiten lavanderia industrial, aqui estamos.

Les deseo lo mejor${SIGNATURE}`,
  },
  {
    id: 'seg3_question',
    stage: 'seguimiento_3',
    subject: 'Una ultima pregunta - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Ultima pregunta antes de dejarlos tranquilos:

*Fue por precio, por timing, o simplemente no necesitan lavanderia externa?*

Si me responden, me ayuda a mejorar. Gracias!${SIGNATURE}`,
  },
];

// ============================================================
// INTERESADO - Push towards quote (5 variants)
// ============================================================
const INTERESADO_TEMPLATES: EmailTemplate[] = [
  {
    id: 'int_info',
    stage: 'interesado',
    subject: 'Tu cotizacion - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Que bueno que les interesa! Para la cotizacion necesito:

1. Tipo de {{textiles}} que manejan
2. Volumen semanal aproximado
3. Frecuencia de recojo

*Responden con eso y les mando los numeros!*${SIGNATURE}`,
  },
  {
    id: 'int_visit',
    stage: 'interesado',
    subject: 'Coordinamos visita? - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Que bueno que les intereso! Dos opciones:

*A) Les mando cotizacion por email* - necesito tipo de textiles y volumen
*B) Hacemos visita a su local* - vemos in situ y les cotizo al toque

Que prefieren?${SIGNATURE}`,
  },
  {
    id: 'int_trial',
    stage: 'interesado',
    subject: 'Prueba gratis 1 semana - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Propuesta: *1 semana de prueba sin compromiso.*

Recogemos sus {{textiles}}, los procesamos, y si les gusta el resultado, seguimos.

*Si no les convence, no pagan nada.* Que dicen?${SIGNATURE}`,
  },
  {
    id: 'int_numbers',
    stage: 'interesado',
    subject: 'Los numeros para {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Para darles numeros exactos, me ayudan con:

- Cuantas piezas de {{textiles}} lavan por semana?
- Cada cuanto necesitan recojo?

*Con eso les preparo cotizacion en 24 hrs.*${SIGNATURE}`,
  },
  {
    id: 'int_fast',
    stage: 'interesado',
    subject: 'Cotizacion express - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Les preparo la cotizacion hoy mismo.

Solo necesito saber:
- Que tipo de {{textiles}} manejan
- Cantidad aproximada por semana

*Responden y la tienen manana en su correo.*${SIGNATURE}`,
  },
];

// ============================================================
// COTIZADO - Push towards close (5 variants)
// ============================================================
const COTIZADO_TEMPLATES: EmailTemplate[] = [
  {
    id: 'cot_followup',
    stage: 'cotizado',
    subject: 'Re: Cotizacion lavanderia - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Queria saber si revisaron la cotizacion.

*Tienen alguna duda? Hay algo que ajustar?*

Podemos hacer prueba de 1 semana sin compromiso si les ayuda a decidir${SIGNATURE}`,
  },
  {
    id: 'cot_trial',
    stage: 'cotizado',
    subject: 'Prueba sin riesgo - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Se que tomar la decision toma tiempo. Por eso ofrecemos:

*Prueba 1 semana - si no les convence, no pagan nada.*

Quieren coordinar una fecha para empezar?${SIGNATURE}`,
  },
  {
    id: 'cot_adjust',
    stage: 'cotizado',
    subject: 'Podemos ajustar - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Si algo de la cotizacion no les cuadra, *me dicen y lo ajustamos*.

- Precio muy alto? Vemos opciones
- Frecuencia no encaja? La adaptamos
- Necesitan algo especial? Lo incluimos

*Que necesitan para decidir?*${SIGNATURE}`,
  },
  {
    id: 'cot_guarantee',
    stage: 'cotizado',
    subject: 'Garantia total - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Para que sea facil decidir:

- *Sin contrato largo* - mes a mes
- *Garantia de calidad* - si algo no esta perfecto, lo repetimos gratis
- *Prueba sin compromiso* - 1 semana gratis

*Cuando empezamos?*${SIGNATURE}`,
  },
  {
    id: 'cot_urgency',
    stage: 'cotizado',
    subject: 'La cotizacion sigue vigente - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Solo queria confirmar que la cotizacion sigue vigente.

*Quieren que coordinemos la primera prueba?* Podemos empezar con un dia de bajo volumen.

Me dicen y les agendo${SIGNATURE}`,
  },
];

// ============================================================
// CLOSING - For 3+ and 5+ contacts (5 variants)
// ============================================================
const CLOSING_TEMPLATES: EmailTemplate[] = [
  {
    id: 'close_binary',
    stage: 'closing',
    subject: 'Si o no? - Lavanderia {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Les he escrito varias veces. Solo necesito saber:

*Si: les mando cotizacion*
*No: los dejo tranquilos*

Cualquier respuesta me ayuda${SIGNATURE}`,
  },
  {
    id: 'close_last',
    stage: 'closing',
    subject: 'Ultimo mensaje - GetLavado',
    body: `Hola equipo de *{{businessName}}*

Este es mi ultimo intento. Si no responden, entiendo que no es el momento.

*Pero si tienen aunque sea curiosidad, un "si" me basta para enviarles numeros.*${SIGNATURE}`,
  },
  {
    id: 'close_respect',
    stage: 'closing',
    subject: 'Respeto su tiempo - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

No quiero ser insistente. Les he escrito sobre lavanderia industrial y entiendo que estan ocupados.

*Responden "no" y no los contacto mas.*
*Responden "si" y les preparo cotizacion.*

Gracias por su paciencia${SIGNATURE}`,
  },
  {
    id: 'close_door',
    stage: 'closing',
    subject: 'Mi contacto queda abierto - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

No los voy a contactar mas por este medio. Pero si algun dia necesitan lavanderia industrial, *mi numero queda arriba*.

Les deseo mucho exito!${SIGNATURE}`,
  },
  {
    id: 'close_feedback',
    stage: 'closing',
    subject: 'Me ayudan con 1 cosa? - {{businessName}}',
    body: `Hola equipo de *{{businessName}}*

Ultimo mensaje. Solo una pregunta: *por que no les intereso?*

a) Ya tienen proveedor
b) No necesitan el servicio
c) No era el momento

*Me ayuda a mejorar.* Gracias!${SIGNATURE}`,
  },
];

// ============================================================
// Detect industry from business type
// ============================================================
export function detectIndustryForEmail(businessType: string | null): { industria: string; textiles: string } {
  const typeLower = (businessType || '').toLowerCase();

  if (typeLower.includes('hotel') || typeLower.includes('hostal')) {
    return { industria: 'hotel', textiles: 'sabanas, toallas y uniformes' };
  }
  if (typeLower.includes('clinic') || typeLower.includes('hospital') || typeLower.includes('medic') || typeLower.includes('salud') || typeLower.includes('estetica')) {
    return { industria: 'centro de salud', textiles: 'uniformes medicos, sabanas y batas' };
  }
  if (typeLower.includes('spa') || typeLower.includes('gym') || typeLower.includes('fitness') || typeLower.includes('gimnasio')) {
    return { industria: 'centro de bienestar', textiles: 'toallas y batas' };
  }
  if (typeLower.includes('restaurante') || typeLower.includes('comida') || typeLower.includes('cevich')) {
    return { industria: 'restaurante', textiles: 'manteles, servilletas y uniformes' };
  }
  if (typeLower.includes('seguridad') || typeLower.includes('vigilancia')) {
    return { industria: 'empresa de seguridad', textiles: 'uniformes de su personal' };
  }
  return { industria: 'empresa', textiles: 'textiles' };
}

// ============================================================
// Template selection with rotation
// ============================================================
function getTemplatesForStage(stage: string, contactCount: number): EmailTemplate[] {
  // Closing templates for 5+ contacts (unless in final stages)
  if (contactCount >= 5 && !['interesado', 'cotizado', 'cliente'].includes(stage)) {
    return CLOSING_TEMPLATES;
  }
  // Also use closing for 3-4 contacts in certain stages
  if (contactCount >= 3 && !['interesado', 'cotizado', 'cliente', 'seguimiento_3'].includes(stage)) {
    return CLOSING_TEMPLATES;
  }

  switch (stage) {
    case 'nuevo': return NUEVO_TEMPLATES;
    case 'contactado':
    case 'seguimiento_1': return FOLLOWUP_TEMPLATES;
    case 'seguimiento_2': return SEGUIMIENTO2_TEMPLATES;
    case 'seguimiento_3': return SEGUIMIENTO3_TEMPLATES;
    case 'interesado': return INTERESADO_TEMPLATES;
    case 'cotizado': return COTIZADO_TEMPLATES;
    default: return NUEVO_TEMPLATES;
  }
}

export function renderTemplate(template: EmailTemplate, vars: TemplateVars): { id: string; subject: string; body: string } {
  const replace = (text: string) =>
    text
      .replace(/\{\{businessName\}\}/g, vars.businessName)
      .replace(/\{\{industria\}\}/g, vars.industria)
      .replace(/\{\{textiles\}\}/g, vars.textiles);

  return {
    id: template.id,
    subject: replace(template.subject),
    body: replace(template.body),
  };
}

export function getEmailTemplate(
  stage: string,
  businessType: string | null,
  contactCount: number,
  excludeTemplateId?: string | null,
): { id: string; subject: string; body: string } {
  const templates = getTemplatesForStage(stage, contactCount);
  const { industria, textiles } = detectIndustryForEmail(businessType);

  // Filter out the excluded template for rotation
  let available = excludeTemplateId
    ? templates.filter(t => t.id !== excludeTemplateId)
    : templates;

  // If all were filtered, use all
  if (available.length === 0) available = templates;

  // Pick random
  const template = available[Math.floor(Math.random() * available.length)];

  return renderTemplate(template, {
    businessName: '{{businessName}}', // Will be replaced by caller with actual name
    industria,
    textiles,
  });
}

// Convenience: get template with business name already filled in
export function getRenderedEmailTemplate(
  businessName: string,
  businessType: string | null,
  stage: string,
  contactCount: number,
  excludeTemplateId?: string | null,
): { id: string; subject: string; body: string } {
  const templates = getTemplatesForStage(stage, contactCount);
  const { industria, textiles } = detectIndustryForEmail(businessType);

  let available = excludeTemplateId
    ? templates.filter(t => t.id !== excludeTemplateId)
    : templates;

  if (available.length === 0) available = templates;

  const template = available[Math.floor(Math.random() * available.length)];

  return renderTemplate(template, { businessName, industria, textiles });
}
