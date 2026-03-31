// WhatsApp Pitch Engine — Single source of truth
// Each stage uses a different psychological framework for maximum conversion
// Tone: natural WhatsApp, like a real human (Alejandro from GetLavado)

export function getWhatsAppPitchServer(businessName: string, businessType: string | null, salesStage?: string, contactCount?: number): string {
  const typeLower = (businessType || '').toLowerCase();
  const stage = salesStage || 'nuevo';
  const contacts = contactCount || 0;

  // ═══════════════════════════════════════════════════════
  // OVERRIDE: Contact count takes priority over stage
  // ═══════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════
  // SEGUIMIENTO 3 — Quincenal rotation (nunca repite)
  // Each message uses a different psychological angle
  // ═══════════════════════════════════════════════════════
  if (stage === 'seguimiento_3') {
    return getSeguimiento3Pitch(businessName, typeLower, contacts);
  }

  // 5+ contactos en otras etapas → Pattern interrupt
  if (contacts >= 5 && !['interesado', 'cotizado', 'cliente', 'seguimiento_3'].includes(stage)) {
    return `Buenas! Soy Alejandro de GetLavado 👋

Cambiando de tema: ¿sabían que el *72% de negocios* en Lima que tercerizan textiles ahorran más de S/2,000/mes?

Solo curiosidad: ¿cuánto gastan hoy en lavado? 🤔`;
  }

  // 3-4 contactos → Ultra-directo, binary close
  if (contacts >= 3 && !['interesado', 'cotizado', 'cliente', 'seguimiento_3'].includes(stage)) {
    return `Hola! Soy Alejandro de GetLavado

¿Les paso cotización o prefieren que no los contacte más?

Cualquier respuesta va 👍`;
  }

  // ═══════════════════════════════════════════════════════
  // STAGE-SPECIFIC PITCHES
  // ═══════════════════════════════════════════════════════

  // SEGUIMIENTO 2 — Loss aversion + competitor pressure
  if (stage === 'seguimiento_2') {
    return `Hola! Soy Alejandro de GetLavado

Varios negocios de su zona ya se sumaron este mes. Todavía puedo apartarles el mismo precio preferencial.

¿Quieren que les mande los números antes de que cambie? 📊`;
  }

  // SEGUIMIENTO 1 — Value reframe + micro-commitment
  if (stage === 'seguimiento_1') {
    return `Hola! Soy Alejandro de GetLavado 📞

¿Tienen *5 min* esta semana? Les cuento en una llamada rápida cuánto podrían ahorrar vs. lo que gastan hoy.

Sin compromiso, solo números. ¿Les funciona mañana o pasado?`;
  }

  // CONTACTADO — Social proof + curiosity gap (primer follow-up por industria)
  if (stage === 'contactado') {
    return getContactadoPitch(businessName, typeLower);
  }

  // INTERESADO — Consultative selling, pedir datos para cotizar
  if (stage === 'interesado') {
    return `Hola! Soy Alejandro de GetLavado 📋

Qué bueno que les interesa! Para armarles la cotización necesito 3 datos rápidos:

1. ¿Qué textiles manejan? (toallas, sábanas, uniformes, manteles)
2. ¿Volumen aprox semanal en kg?
3. ¿Frecuencia de recojo ideal?

Con eso les tengo los números en *24 horas*.`;
  }

  // COTIZADO — Objection handling + urgencia suave
  if (stage === 'cotizado') {
    return `Hola! Soy Alejandro de GetLavado

¿Pudieron revisar la cotización? Si hay algo que ajustar estoy a la orden 💬

Los precios que les compartí son *válidos esta semana* — después toca recalcular con la tarifa actualizada.`;
  }

  // NUEVO — Pitch por industria (primer contacto)
  return getNuevoPitch(businessName, typeLower);
}

// ═══════════════════════════════════════════════════════
// CONTACTADO: Social proof por industria
// ═══════════════════════════════════════════════════════
function getContactadoPitch(name: string, type: string): string {
  if (type.includes('hotel') || type.includes('hostal') || type.includes('reserv')) {
    return `Hola! Soy Alejandro de GetLavado 👋

Un hotel boutique en Barranco redujo *35% su costo* en textiles con nosotros. Antes tenían 2 personas lavando, ahora cero.

¿Cuántas habitaciones manejan en *${name}*? Les armo una comparación rápida 📊`;
  }

  if (type.includes('gym') || type.includes('gimnasio') || type.includes('fitness') || type.includes('club') || type.includes('deport')) {
    return `Hola! Soy Alejandro de GetLavado 👋

Un gym en Miraflores pasó de gastar *S/4,200 a S/2,500/mes*. Misma cantidad de toallas, mejor calidad.

¿Cuántas toallas rotan por semana en *${name}*? Les paso los números 💪`;
  }

  if (type.includes('spa') || type.includes('masaje') || type.includes('wellness') || type.includes('sauna')) {
    return `Hola! Soy Alejandro de GetLavado 👋

Un spa premium en San Isidro nos dijo que sus clientes ahora comentan *lo suave de las toallas*. Ese es nuestro diferencial.

¿Tienen 10 min para contarles cómo elevamos la experiencia en *${name}*? ✨`;
  }

  if (type.includes('clinic') || type.includes('hospital') || type.includes('medic') || type.includes('salud') || type.includes('odonto') || type.includes('dental')) {
    return `Hola! Soy Alejandro de GetLavado 👋

Una clínica en Surco nos eligió después de que su proveedor falló 3 entregas. Con nosotros: *cero fallas en 18 meses*.

¿Les comparto nuestros protocolos de esterilización para *${name}*? 🏥`;
  }

  if (type.includes('restaurante') || type.includes('comida') || type.includes('cevich') || type.includes('cocina')) {
    return `Hola! Soy Alejandro de GetLavado 👋

Un restaurante en Miraflores liberó *15 horas semanales* de su equipo al tercerizarnos manteles y uniformes.

¿Cuántos manejan en *${name}*? Les paso una propuesta rápida 🍽️`;
  }

  // Default contactado
  return `Hola! Soy Alejandro de GetLavado 👋

Negocios como *${name}* nos eligen porque eliminamos el dolor de cabeza del lavado de textiles. Recogemos, lavamos, entregamos.

¿Qué tipo de textiles manejan? Les armo una propuesta en 24h 📋`;
}

// ═══════════════════════════════════════════════════════
// NUEVO: Primer contacto frío por industria
// ═══════════════════════════════════════════════════════
function getNuevoPitch(name: string, type: string): string {
  if (type.includes('hotel') || type.includes('hostal') || type.includes('reserv')) {
    return `Hola! Soy Alejandro de GetLavado 🏨

¿Sabían que los hoteles que tercerizan lavandería ahorran en promedio *35%* vs. hacerlo internamente?

Tenemos capacidad para alto volumen con entrega diaria. ¿Cuántas habitaciones manejan en *${name}*?`;
  }

  if (type.includes('gym') || type.includes('gimnasio') || type.includes('fitness') || type.includes('club') || type.includes('deport')) {
    return `Hola! Soy Alejandro de GetLavado 💪

Los gimnasios que nos eligen reducen *40% su gasto* en toallas. Misma cantidad, mejor calidad, cero logística.

¿Cuántas toallas rotan por semana en *${name}*? Les armo los números`;
  }

  if (type.includes('spa') || type.includes('masaje') || type.includes('wellness') || type.includes('sauna')) {
    return `Hola! Soy Alejandro de GetLavado ✨

El secreto de los spas premium: *tercerizan su lavandería*. Blancura y suavidad de hotel 5 estrellas, sin el esfuerzo.

¿10 min para contarles cómo elevamos la experiencia en *${name}*?`;
  }

  if (type.includes('clinic') || type.includes('hospital') || type.includes('medic') || type.includes('salud') || type.includes('odonto') || type.includes('dental')) {
    return `Hola! Soy Alejandro de GetLavado 🏥

En salud no hay margen de error. Ofrecemos protocolos de esterilización certificados + *trazabilidad de cada pieza*.

¿Les comparto protocolos y precios para *${name}*?`;
  }

  if (type.includes('restaurante') || type.includes('comida') || type.includes('cevich') || type.includes('cocina')) {
    return `Hola! Soy Alejandro de GetLavado 🍽️

¿Cuántas horas a la semana dedica su equipo a lavar manteles y uniformes? Nuestros clientes recuperan en promedio *15 horas semanales*.

¿Cuántos manejan en *${name}*? Les paso propuesta`;
  }

  // Default nuevo
  return `Hola! Soy Alejandro de GetLavado 👋

+800 negocios en Lima ya nos eligieron. Recogemos, lavamos y entregamos — ustedes solo apilan.

¿Manejan toallas, uniformes, sábanas o manteles en *${name}*? Les armo cotización sin compromiso`;
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
    // Round 1: Binary close + respeto (primer intento en seg3)
    `Hola! Soy Alejandro de GetLavado 🤝

Sé que están ocupados en *${name}*. Solo quería cerrar el tema de mi lado:

¿Les interesa una cotización sin compromiso? Un "sí" o "no" me ayuda mucho.`,

    // Round 2: Noticia del sector — relevancia contextual
    sector === 'hotel'
      ? `Hola! Soy Alejandro de GetLavado

Dato: este mes *3 hoteles* en Lima nos contrataron. La tendencia es tercerizar para bajar costos fijos.

¿En *${name}* siguen manejando el lavado internamente? Solo curiosidad 🤔`
      : sector === 'gym'
      ? `Hola! Soy Alejandro de GetLavado

Dato: este mes *4 gimnasios* en Lima empezaron a tercerizar sus toallas con nosotros. La tendencia está clara.

¿En *${name}* cómo lo manejan actualmente? 🤔`
      : sector === 'clínica'
      ? `Hola! Soy Alejandro de GetLavado

Dato: las clínicas que tercerizan lavandería reducen *infecciones cruzadas* y cumplen mejor los protocolos MINSA.

¿En *${name}* ya evaluaron esta opción? 🏥`
      : sector === 'restaurante'
      ? `Hola! Soy Alejandro de GetLavado

Dato: varios restaurantes en Lima están tercerizando manteles para *liberar personal de cocina*. El ROI es inmediato.

¿En *${name}* cuántas horas le dedican al lavado? 🍽️`
      : `Hola! Soy Alejandro de GetLavado

Dato: este mes varios negocios de su zona empezaron a tercerizar textiles con nosotros. La tendencia crece.

¿En *${name}* cómo lo manejan actualmente? 🤔`,

    // Round 3: Caso de éxito cercano — social proof fresco
    `Hola! Soy Alejandro de GetLavado

Le cuento: un ${sector === 'negocio' ? 'negocio' : sector} parecido a *${name}* nos eligió hace 2 semanas y ya redujo *30% su gasto* en textiles.

Si quieren les comparto qué hicimos diferente. Solo me dicen 📊`,

    // Round 4: Oferta temporal — urgencia real
    `Hola! Soy Alejandro de GetLavado

Tenemos *capacidad libre* este mes y puedo hacerles precio especial para *${name}*. No sé cuánto dure la disponibilidad.

¿Les armo una propuesta rápida? Sin compromiso 💬`,

    // Round 5: Cierre definitivo — respeto total
    `Hola! Soy Alejandro de GetLavado

Último check para *${name}* 🤝

Entiendo si no es el momento. Solo necesito saber: ¿lo descartamos o lo dejamos pendiente para más adelante?

Cualquier respuesta me sirve, gracias!`,
  ];

  // Rotate based on contact count (subtract base contacts before seg3)
  // First time in seg3 usually has ~4-5 contacts, so we subtract 4
  const index = Math.max(0, contacts - 4) % pitches.length;
  return pitches[index];
}
