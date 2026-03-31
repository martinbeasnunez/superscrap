// WhatsApp Pitch Engine — Single source of truth
// Each stage uses a different psychological framework for maximum conversion

export function getWhatsAppPitchServer(businessName: string, businessType: string | null, salesStage?: string, contactCount?: number): string {
  const typeLower = (businessType || '').toLowerCase();
  const stage = salesStage || 'nuevo';
  const contacts = contactCount || 0;

  // ═══════════════════════════════════════════════════════
  // OVERRIDE: Contact count takes priority over stage
  // ═══════════════════════════════════════════════════════

  // 5+ contactos → Pattern interrupt: ángulo completamente nuevo
  if (contacts >= 5 && !['interesado', 'cotizado', 'cliente'].includes(stage)) {
    return `Buenas! De GetLavado para *${businessName}*

Cambiando de tema: ¿sabían que el *72% de negocios* en Lima que tercerizan textiles ahorran más de S/2,000/mes?

Solo curiosidad: ¿cuánto gastan hoy en lavado? 🤔`;
  }

  // 3-4 contactos → Ultra-directo, binary close
  if (contacts >= 3 && !['interesado', 'cotizado', 'cliente', 'seguimiento_3'].includes(stage)) {
    return `Hola! GetLavado para *${businessName}*

¿Les paso cotización o prefieren que no los contacte más?

Cualquier respuesta va 👍`;
  }

  // ═══════════════════════════════════════════════════════
  // STAGE-SPECIFIC PITCHES
  // ═══════════════════════════════════════════════════════

  // SEGUIMIENTO 3 — Binary close + respeto (último intento)
  if (stage === 'seguimiento_3') {
    return `Hola! Soy de GetLavado para *${businessName}*

Último mensaje, lo prometo 🤝

¿Les interesa una cotización sin compromiso? Un "sí" o "no" me ayuda a cerrar el tema de mi lado.`;
  }

  // SEGUIMIENTO 2 — Loss aversion + competitor pressure
  if (stage === 'seguimiento_2') {
    return `Hola! De GetLavado para *${businessName}*

Varios negocios de su zona ya nos eligieron este mes. Todavía puedo apartarles el mismo precio preferencial.

¿Quieren que les mande los números antes de que cambie? 📊`;
  }

  // SEGUIMIENTO 1 — Value reframe + micro-commitment
  if (stage === 'seguimiento_1') {
    return `Hola! De GetLavado para *${businessName}*

¿Tienen *5 min* esta semana? Les cuento en una llamada rápida cuánto podrían ahorrar vs. lo que gastan hoy.

Sin compromiso, solo números. ¿Les funciona mañana o pasado? 📞`;
  }

  // CONTACTADO — Social proof + curiosity gap (primer follow-up por industria)
  if (stage === 'contactado') {
    return getContactadoPitch(businessName, typeLower);
  }

  // INTERESADO — Consultative selling, pedir datos para cotizar
  if (stage === 'interesado') {
    return `Hola! De GetLavado para *${businessName}* 📋

Para armarles la cotización necesito 3 datos rápidos:

1. ¿Qué textiles manejan? (toallas, sábanas, uniformes, manteles)
2. ¿Volumen aprox semanal en kg?
3. ¿Frecuencia de recojo ideal?

Con eso les tengo los números en *24 horas*.`;
  }

  // COTIZADO — Objection handling + urgencia suave
  if (stage === 'cotizado') {
    return `Hola! De GetLavado para *${businessName}*

¿Pudieron revisar la cotización? Si hay algo que ajustar estoy a la orden.

Los precios que les compartí son *válidos esta semana* — después toca recalcular con la tarifa actualizada. ¿Alguna duda? 💬`;
  }

  // NUEVO — Pitch por industria (primer contacto)
  return getNuevoPitch(businessName, typeLower);
}

// ═══════════════════════════════════════════════════════
// CONTACTADO: Social proof por industria
// ═══════════════════════════════════════════════════════
function getContactadoPitch(name: string, type: string): string {
  if (type.includes('hotel') || type.includes('hostal')) {
    return `Hola! De GetLavado para *${name}*

Un hotel boutique en Barranco redujo *35% su costo* de textiles con nosotros. Antes tenían 2 personas lavando, ahora cero.

¿Cuántas habitaciones manejan? Les armo una comparación rápida 📊`;
  }

  if (type.includes('gym') || type.includes('gimnasio') || type.includes('fitness') || type.includes('club')) {
    return `Hola! De GetLavado para *${name}*

Un gym en Miraflores pasó de gastar *S/4,200 a S/2,500/mes*. Misma cantidad de toallas, mejor calidad.

¿Cuántas toallas rotan por semana? Les paso los números 💪`;
  }

  if (type.includes('spa') || type.includes('masaje') || type.includes('wellness')) {
    return `Hola! De GetLavado para *${name}*

Un spa premium en San Isidro nos dijo que sus clientes ahora comentan *lo suave de las toallas*. Ese es nuestro diferencial.

¿10 min para contarles cómo elevamos la experiencia de sus clientes? ✨`;
  }

  if (type.includes('clinic') || type.includes('hospital') || type.includes('medic') || type.includes('salud')) {
    return `Hola! De GetLavado para *${name}*

Una clínica en Surco nos eligió después de que su proveedor falló 3 veces en entregas. Con nosotros: *cero fallas en 18 meses*.

¿Les comparto nuestros protocolos de esterilización? 🏥`;
  }

  if (type.includes('restaurante') || type.includes('comida') || type.includes('cevich')) {
    return `Hola! De GetLavado para *${name}*

Un restaurante en Miraflores liberó *15 horas semanales* de su equipo al tercerizarnos los manteles y uniformes.

¿Cuántos manteles/uniformes manejan? Les paso una propuesta 🍽️`;
  }

  // Default contactado
  return `Hola! De GetLavado para *${name}*

Negocios como el suyo nos eligen porque *eliminamos el dolor de cabeza* del lavado de textiles. Recogemos, lavamos, entregamos.

¿Qué tipo de textiles manejan? Les armo una propuesta en 24h 📋`;
}

// ═══════════════════════════════════════════════════════
// NUEVO: Primer contacto frío por industria
// ═══════════════════════════════════════════════════════
function getNuevoPitch(name: string, type: string): string {
  if (type.includes('hotel') || type.includes('hostal')) {
    return `Hola! Les escribo de GetLavado a *${name}*

¿Sabían que los hoteles que tercerizan lavandería ahorran en promedio *35%* vs. hacerlo internamente?

Tenemos capacidad para alto volumen con entrega diaria. ¿Cuántas habitaciones tienen? Les paso cotización sin compromiso 🏨`;
  }

  if (type.includes('gym') || type.includes('gimnasio') || type.includes('fitness') || type.includes('club')) {
    return `Hola! Les escribo de GetLavado a *${name}*

Dato: los gimnasios que nos eligen reducen *40% su gasto* en toallas. Misma cantidad, mejor calidad, cero logística.

¿Cuántas toallas rotan por semana? Les armo los números 💪`;
  }

  if (type.includes('spa') || type.includes('masaje') || type.includes('wellness')) {
    return `Hola! Les escribo de GetLavado a *${name}*

El secreto de los spas premium: *tercerizan su lavandería*. Blancura y suavidad de hotel 5 estrellas, sin el esfuerzo.

¿10 min para contarles cómo elevamos la experiencia de sus clientes? ✨`;
  }

  if (type.includes('clinic') || type.includes('hospital') || type.includes('medic') || type.includes('salud')) {
    return `Hola! Les escribo de GetLavado a *${name}*

En salud no hay margen de error. Por eso ofrecemos protocolos de esterilización certificados + *trazabilidad de cada pieza*.

¿Les comparto nuestros protocolos y precios? 🏥`;
  }

  if (type.includes('restaurante') || type.includes('comida') || type.includes('cevich')) {
    return `Hola! Les escribo de GetLavado a *${name}*

¿Cuántas horas a la semana dedica su equipo a lavar manteles y uniformes? Nuestros clientes recuperan en promedio *15 horas semanales*.

¿Cuántos manteles/uniformes manejan? Les paso propuesta 🍽️`;
  }

  // Default nuevo
  return `Hola! Les escribo de GetLavado a *${name}*

+800 negocios en Lima ya nos eligieron. Recogemos, lavamos y entregamos — ustedes solo apilan.

¿Manejan toallas, uniformes, sábanas o manteles? Les armo cotización sin compromiso 📋`;
}
