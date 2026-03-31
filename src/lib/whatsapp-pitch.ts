// Server-side WhatsApp pitch generator (mirrors frontend getWhatsAppPitch)
export function getWhatsAppPitchServer(businessName: string, businessType: string | null, salesStage?: string, contactCount?: number): string {
  const typeLower = (businessType || '').toLowerCase();
  const stage = salesStage || 'nuevo';
  const contacts = contactCount || 0;

  if (contacts >= 5 && !['interesado', 'cotizado', 'cliente'].includes(stage)) {
    return `Hola! Soy de GetLavado, les he escrito varias veces sobre lavanderia industrial para *${businessName}* 🧺

Entiendo que estan super ocupados! Solo queria saber:

¿Les interesa que les envie una cotizacion? O mejor los contacto en otro momento?

Un "si" o "no" me ayuda mucho, gracias! 🙌`;
  }

  if (contacts >= 3 && !['interesado', 'cotizado', 'cliente', 'seguimiento_3'].includes(stage)) {
    return `Hola! Soy de GetLavado para *${businessName}*

Les he escrito un par de veces sobre lavanderia industrial. Solo queria confirmar:

¿Les interesa recibir una cotizacion sin compromiso? O prefieren que no los moleste mas?

Cualquier respuesta me sirve 👍`;
  }

  if (stage === 'seguimiento_3') {
    return `Hola! Soy de GetLavado, les habia escrito sobre lavanderia industrial para *${businessName}* 🧺

Se que estan ocupados! Solo queria cerrar el tema de mi lado:

¿Les gustaria que les prepare una cotizacion? O prefieren que los contacte en otro momento?

Cualquier respuesta me sirve, gracias! 🙌`;
  }

  if (stage === 'seguimiento_1' || stage === 'seguimiento_2' || stage === 'contactado') {
    if (stage === 'seguimiento_2') {
      return `Hola! Soy de GetLavado, les habiamos escrito hace unos dias sobre lavanderia industrial para *${businessName}*

Solo queria saber si tuvieron chance de revisar la propuesta?

Si ya tienen proveedor o no les interesa, me avisan y no los molesto mas 👍`;
    }

    return `Hola! Les escribo de nuevo de GetLavado para *${businessName}*

Queria hacer seguimiento a mi mensaje anterior sobre lavanderia industrial.

Tienen 5 min esta semana para una llamada rapida? Les explico como podemos ayudarles a reducir costos.`;
  }

  if (stage === 'interesado') {
    return `Hola! Soy de GetLavado para *${businessName}*

Me comentaron que les interesa el servicio. Para enviarles una cotizacion necesito saber:

1. Que tipo de textiles manejan? (toallas, sabanas, uniformes, manteles)
2. Volumen aproximado semanal?
3. Frecuencia de recojo que necesitan?

Con esos datos les preparo la cotizacion! 📋`;
  }

  if (stage === 'cotizado') {
    return `Hola! Soy de GetLavado para *${businessName}*

Queria hacer seguimiento a la cotizacion que les enviamos.

Tienen alguna duda? Hay algo que podamos ajustar para que les funcione mejor?

Estamos a la orden para resolver cualquier pregunta 👍`;
  }

  // NUEVO - pitch genérico por industria
  if (typeLower.includes('hotel') || typeLower.includes('hostal')) {
    return `Hola! Les escribo de GetLavado a *${businessName}*

Caso real: Un hotel boutique en Barranco redujo su costo de lavanderia 35%. Antes tenian 2 personas lavando, ahora nadie.

Lo que hacemos:
- Sabanas y toallas impecables, siempre a tiempo
- Capacidad para alto volumen
- Servicio diario si lo necesitan

Cuantas habitaciones tienen? Les paso cotizacion sin compromiso`;
  }

  if (typeLower.includes('gym') || typeLower.includes('gimnasio') || typeLower.includes('fitness')) {
    return `Hola! Les escribo de GetLavado a *${businessName}*

Caso real: Un gimnasio en Miraflores paso de gastar S/4,200 a S/2,500 mensuales. Mismo volumen de toallas, mejor calidad.

Lo que hacemos diferente:
- Toallas siempre blancas y suaves
- Recojo y entrega en tu local
- *40% menos* que hacerlo internamente

Cuantas toallas manejan aprox? Les paso cotizacion`;
  }

  return `Hola! Les escribo de GetLavado a *${businessName}*

Somos lavanderia industrial con +800 clientes y 8 anos en el mercado:
- Recojo y entrega en tu local
- Tu solo apilas, nosotros hacemos el resto
- Cotizacion sin compromiso

Manejan toallas, uniformes, sabanas o manteles? Cuentenme y les paso numeros`;
}
