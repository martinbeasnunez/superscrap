/**
 * De dónde salió cada contacto.
 *
 * ORBIT metía en la misma bolsa tres cosas muy distintas: lo que Martín hace a
 * mano, lo que manda hacer a un agente, y lo que dispara el cron solo. Los tres
 * quedaban igual en `contact_history`, así que el tablero no podía contar la
 * historia de la semana — y "Tu día" llegó a atribuirle al vendedor los envíos
 * automáticos, porque el cron escribe `businesses.contacted_at`.
 *
 * No hace falta una columna nueva: el origen se deriva de lo que ya guardamos.
 */

export type ContactOrigin = 'humano' | 'agente' | 'cron' | 'cliente';

/** Acciones que dispara el cron de auto-followup, nunca una persona. */
const ACCIONES_CRON = new Set(['auto_whatsapp', 'auto_whatsapp_reply']);

/** Acciones entrantes: las escribe el prospecto, no nosotros. */
const ACCIONES_CLIENTE = new Set(['whatsapp_reply', 'auto_whatsapp_reply']);

/** Marca que el cron deja al avanzar de etapa solo. */
const AUTO_AVANCE = /auto-avance/i;

export interface ContactoParaOrigen {
  action_type: string | null;
  user_id?: string | null;
  notes?: string | null;
}

export function origenDeContacto(c: ContactoParaOrigen): ContactOrigin {
  const tipo = c.action_type || '';

  // Lo entrante es del prospecto, aunque el saludo lo haya escrito su propio bot.
  if (ACCIONES_CLIENTE.has(tipo)) return 'cliente';

  // Con user_id sabemos quién fue: lo hizo una persona dentro de ORBIT.
  if (c.user_id) return 'humano';

  // El cron de auto-followup: plantilla, sin criterio detrás.
  if (ACCIONES_CRON.has(tipo)) return 'cron';
  if (tipo === 'stage_change' && AUTO_AVANCE.test(c.notes || '')) return 'cron';

  // Queda el trabajo dirigido: un agente ejecutando una instrucción de Martín
  // (mensaje pensado, táctica elegida). Cuenta como trabajo del equipo, no del bot.
  return 'agente';
}

/** ¿Cuenta como esfuerzo comercial nuestro? (humano o dirigido, no el cron ni el cliente) */
export function esTrabajoNuestro(c: ContactoParaOrigen): boolean {
  const o = origenDeContacto(c);
  return o === 'humano' || o === 'agente';
}

export const ETIQUETA_ORIGEN: Record<ContactOrigin, string> = {
  humano: 'A mano',
  agente: 'Dirigido',
  cron: 'Automático',
  cliente: 'Respuesta',
};
