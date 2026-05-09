// WhatsApp Pitch Engine — Single source of truth
// Each stage uses a different psychological framework for maximum conversion
// Tone: natural WhatsApp, like a real human (Alejandro from GetLavado)
//
// Principles after May-2026 rewrite:
//   - Plain language (no "tercerizar", "protocolos", "trazabilidad")
//   - Open with simple question they can answer in one word
//   - Each stage uses a DIFFERENT structure (avoid repetitive feel across pitches)
//   - First line never starts with stat/social-proof — sounds like spam

export function getWhatsAppPitchServer(businessName: string, businessType: string | null, salesStage?: string, contactCount?: number): string {
  const typeLower = (businessType || '').toLowerCase();
  const stage = salesStage || 'nuevo';
  const contacts = contactCount || 0;

  // ═══════════════════════════════════════════════════════
  // OVERRIDE: Contact count takes priority over stage
  // ═══════════════════════════════════════════════════════

  // SEGUIMIENTO 3 — Quincenal rotation (nunca repite)
  if (stage === 'seguimiento_3') {
    return getSeguimiento3Pitch(businessName, typeLower, contacts);
  }

  // 5+ contactos en otras etapas → Pattern interrupt
  if (contacts >= 5 && !['interesado', 'cotizado', 'cliente', 'seguimiento_3'].includes(stage)) {
    return `Hola! Alejandro de GetLavado 👋

Para no insistir más: ¿les sirve que les pase una cotización rápida o prefieren que no los moleste más?

Cualquier respuesta me ayuda 🙏`;
  }

  // 3-4 contactos → Ultra-directo, binary close
  if (contacts >= 3 && !['interesado', 'cotizado', 'cliente', 'seguimiento_3'].includes(stage)) {
    return `Hola! Alejandro de GetLavado

¿Les paso cotización de lavandería o lo dejo por ahora?

Un sí o no me ayuda 👍`;
  }

  // ═══════════════════════════════════════════════════════
  // STAGE-SPECIFIC PITCHES
  // ═══════════════════════════════════════════════════════

  // SEGUIMIENTO 2 — Loss aversion + competitor pressure
  if (stage === 'seguimiento_2') {
    return `Hola! Alejandro de nuevo 👋

Sigo con espacio para sumarlos este mes con tarifa preferencial. Después de eso vuelve al precio normal.

¿Les paso números antes de que cambie?`;
  }

  // SEGUIMIENTO 1 — Pivot: ofrece llamada corta o cotización por escrito
  if (stage === 'seguimiento_1') {
    return `Hola! Soy Alejandro de GetLavado 📞

¿Cómo prefieren que les pase la info?

1) Llamada de 5 min
2) Cotización por aquí mismo
3) Mejor en otro momento

Respondan con el número que les funcione 👍`;
  }

  // CONTACTADO — Soft re-engage: pregunta abierta sobre situación actual
  if (stage === 'contactado') {
    return getContactadoPitch(businessName, typeLower);
  }

  // INTERESADO — Consultative selling, pedir datos para cotizar
  if (stage === 'interesado') {
    return `Genial! Para armarles números necesito 3 cosas rápidas 📋

1. ¿Qué textiles? (toallas, sábanas, uniformes, manteles)
2. ¿Cuánto kg aprox por semana?
3. ¿Cada cuánto les recogemos?

Con eso les mando cotización en 24h.`;
  }

  // COTIZADO — Objection handling + urgencia suave
  if (stage === 'cotizado') {
    return `Hola! Alejandro 👋

¿Pudieron revisar la cotización? Si hay algo a ajustar, dígame y lo vemos.

Los precios que les pasé valen esta semana — después toca actualizar la tarifa.`;
  }

  // NUEVO — Pitch por industria (primer contacto)
  return getNuevoPitch(businessName, typeLower);
}

// ═══════════════════════════════════════════════════════
// NUEVO: Primer contacto — pregunta simple sobre situación actual
// (No vende — solo abre conversación)
// ═══════════════════════════════════════════════════════
function getNuevoPitch(name: string, type: string): string {
  if (type.includes('hotel') || type.includes('hostal') || type.includes('reserv')) {
    return `Hola! Soy Alejandro de GetLavado 🏨

Lavamos sábanas y toallas para varios hoteles en Lima — recogemos y entregamos en 24h.

En *${name}* el lavado lo hacen ustedes mismos o ya trabajan con un proveedor?`;
  }

  if (type.includes('gym') || type.includes('gimnasio') || type.includes('fitness') || type.includes('club') || type.includes('deport')) {
    return `Hola! Soy Alejandro de GetLavado 💪

Le hacemos el lavado de toallas a varios gimnasios en Lima — recojo y entrega diaria.

En *${name}* las toallas las lavan ustedes o tienen proveedor?`;
  }

  if (type.includes('spa') || type.includes('masaje') || type.includes('wellness') || type.includes('sauna')) {
    return `Hola! Soy Alejandro de GetLavado ✨

Lavamos toallas y batas para varios spas en Lima. Recojo a domicilio, entrega impecable.

En *${name}* cómo manejan hoy el lavado — interno o externo?`;
  }

  if (type.includes('clinic') || type.includes('hospital') || type.includes('medic') || type.includes('salud') || type.includes('odonto') || type.includes('dental')) {
    return `Hola! Soy Alejandro de GetLavado 🧺

Lavamos uniformes, batas y sábanas para varias clínicas en Lima. Recogemos diario.

En *${name}* el lavado lo hacen internamente o ya tienen proveedor?`;
  }

  if (type.includes('restaurante') || type.includes('comida') || type.includes('cevich') || type.includes('cocina')) {
    return `Hola! Soy Alejandro de GetLavado 🍽️

Lavamos manteles y uniformes para varios restaurantes en Lima — recojo y entrega.

En *${name}* cómo lo manejan hoy — internamente o con proveedor?`;
  }

  // Default nuevo
  return `Hola! Soy Alejandro de GetLavado 👋

Trabajamos lavado de textiles (toallas, uniformes, sábanas, manteles) para más de 800 negocios en Lima.

En *${name}* cómo manejan el lavado actualmente?`;
}

// ═══════════════════════════════════════════════════════
// CONTACTADO: Re-engage después del primer mensaje sin respuesta
// Cambia el ángulo: pregunta concreta sobre números, no repite el opener
// ═══════════════════════════════════════════════════════
function getContactadoPitch(name: string, type: string): string {
  if (type.includes('hotel') || type.includes('hostal') || type.includes('reserv')) {
    return `Hola, Alejandro otra vez 🙋‍♂️

Para mandarles algo concreto: cuántas habitaciones tienen en *${name}*?

Con ese dato les paso un costo aproximado por mes 📊`;
  }

  if (type.includes('gym') || type.includes('gimnasio') || type.includes('fitness') || type.includes('club') || type.includes('deport')) {
    return `Hola, Alejandro otra vez 🙋‍♂️

Para mandarles costo concreto: cuántas toallas rotan a la semana en *${name}* aprox?

Con eso les calculo el ahorro vs lo que gastan hoy 💪`;
  }

  if (type.includes('spa') || type.includes('masaje') || type.includes('wellness') || type.includes('sauna')) {
    return `Hola, Alejandro otra vez 🙋‍♂️

Una pregunta para mandarles propuesta: en *${name}* cuántas toallas/batas mueven por día?

Les armo precio en base a eso ✨`;
  }

  if (type.includes('clinic') || type.includes('hospital') || type.includes('medic') || type.includes('salud') || type.includes('odonto') || type.includes('dental')) {
    return `Hola, Alejandro otra vez 🙋‍♂️

Para pasarles costo concreto: en *${name}* cuántos uniformes/batas y sábanas mueven a la semana?

Con eso les calculo precio mensual 📊`;
  }

  if (type.includes('restaurante') || type.includes('comida') || type.includes('cevich') || type.includes('cocina')) {
    return `Hola, Alejandro otra vez 🙋‍♂️

Una pregunta corta: en *${name}* cuántos manteles y uniformes manejan a la semana?

Con ese dato les armo costo mensual 🍽️`;
  }

  // Default contactado
  return `Hola, Alejandro otra vez 🙋‍♂️

Para mandarles algo concreto: qué tipo de textiles manejan en *${name}* (toallas, sábanas, uniformes, manteles)?

Con eso les armo cotización en 24h 📋`;
}

// ═══════════════════════════════════════════════════════
// SEGUIMIENTO 3: Rotación quincenal (5 ángulos diferentes)
// Usa contactCount como índice para no repetir
// Cada ángulo usa un framework psicológico distinto
// ═══════════════════════════════════════════════════════
function getSeguimiento3Pitch(name: string, type: string, contacts: number): string {
  // Detectar industria para personalizar
  let sector = 'negocio';
  if (type.includes('hotel') || type.includes('hostal') || type.includes('reserv')) sector = 'hotel';
  else if (type.includes('gym') || type.includes('gimnasio') || type.includes('fitness') || type.includes('club') || type.includes('deport')) sector = 'gym';
  else if (type.includes('spa') || type.includes('masaje') || type.includes('wellness') || type.includes('sauna')) sector = 'spa';
  else if (type.includes('clinic') || type.includes('hospital') || type.includes('medic') || type.includes('odonto') || type.includes('dental')) sector = 'clínica';
  else if (type.includes('restaurante') || type.includes('comida') || type.includes('cevich') || type.includes('cocina')) sector = 'restaurante';

  const pitches = [
    // Round 1: Binary close + respeto
    `Hola! Alejandro de GetLavado 🤝

Sé que están con muchas cosas. Solo quería cerrar mi tema:

¿Les interesa una cotización de lavandería para *${name}* o lo dejamos por ahora?

Un sí o no me ayuda mucho.`,

    // Round 2: Pregunta del sector
    sector === 'hotel'
      ? `Hola! Alejandro 👋

Curiosidad: en *${name}* cuánto les sale por mes el lavado de sábanas y toallas hoy?

Si quieren les comparo contra lo nuestro 🏨`
      : sector === 'gym'
      ? `Hola! Alejandro 👋

Curiosidad: en *${name}* cuánto pagan al mes por las toallas (lavado o reposición)?

Si me dicen, les comparo contra lo nuestro 💪`
      : sector === 'clínica'
      ? `Hola! Alejandro 👋

En *${name}* el lavado de uniformes y sábanas lo manejan ustedes o ya tienen proveedor?

Solo curiosidad — si quieren les paso comparativa 🏥`
      : sector === 'restaurante'
      ? `Hola! Alejandro 👋

En *${name}* cuántas horas a la semana le dedican al lavado de manteles y uniformes?

Le pregunto porque varios clientes recuperaron 10-15h al tercerizarnos 🍽️`
      : `Hola! Alejandro 👋

En *${name}* cómo manejan el lavado de textiles hoy?

Solo para saber si tendría sentido mandarles propuesta 🤔`,

    // Round 3: Caso parecido — social proof concreto
    `Hola! Alejandro de GetLavado

Hace 2 semanas un ${sector === 'negocio' ? 'cliente' : sector} parecido a *${name}* nos contrató. Bajaron 30% el costo del lavado.

¿Quieren que les comparta cómo lo armamos? Sin compromiso 📊`,

    // Round 4: Oferta temporal
    `Hola! Alejandro 👋

Tengo capacidad libre este mes y puedo hacerles tarifa especial para *${name}*.

¿Les armo la propuesta? Si no es momento, también me dicen 💬`,

    // Round 5: Cierre definitivo — respeto total
    `Hola! Alejandro 🤝

Último intento por el tema lavandería en *${name}*.

¿Lo descartamos definitivamente o lo retomamos en unos meses?

Cualquier respuesta me sirve, gracias por su tiempo!`,
  ];

  // Rotate based on contact count (subtract base contacts before seg3)
  const index = Math.max(0, contacts - 4) % pitches.length;
  return pitches[index];
}
