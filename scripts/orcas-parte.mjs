// Parte diario de orcas — corre en la rutina de las 8am.
// Consulta Supabase directo y arma el parte a partir de la ACTIVIDAD REAL
// (contact_history), no del campo congelado businesses.contacted_at.
// Buckets: te respondieron, calientes, follows vencidos, nuevas sin registro,
// estancadas y "Tu día" (Martín).
// Uso: node scripts/orcas-parte.mjs
import { readFileSync } from 'fs';

const MARTIN_ID = '87f03c9f-9c41-440a-b8b9-683c9a30b427'; // martin@getlavado.com
// Toda orca ya supera S/2,500/mes (regla del GM). Para el ruteo, "grande" = cuenta
// premium que Martín trabaja personalmente: potencial >= S/5,000 o rubro hotel/clínica.
const GRANDE_REV = 5000;
// Leads a omitir del parte (por pedido de Martín). Match por substring de nombre.
const EXCLUDE_NAMES = ['Hospital María Auxiliadora'];

// Credenciales: primero variables de entorno (rutina en la nube), luego .env.local (local).
const strip = (s) => s.replace(/^["']|["']$/g, '');
let fileEnv = {};
try {
  fileEnv = Object.fromEntries(
    readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), strip(l.slice(i + 1).trim())]; })
  );
} catch { /* sin .env.local (nube): usamos process.env */ }
const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const STAGES = ['nuevo', 'contactado', 'seguimiento_1', 'seguimiento_2', 'seguimiento_3', 'interesado', 'cotizado', 'cliente', 'perdido'];
const CLOSED = ['cliente', 'perdido'];
const HOT = ['interesado', 'cotizado'];
// Tipos de contact_history que son comunicación real (excluye note/stage_change).
const COMM = new Set(['whatsapp_reply', 'whatsapp', 'email', 'auto_whatsapp', 'call', 'ai_call']);
// El único tipo INBOUND (lo dijo el prospecto). Si es lo último → la bola está en tu cancha.
const INBOUND = 'whatsapp_reply';
const now = Date.now();
const one = (v) => (Array.isArray(v) ? v[0] : v) || {};
const daysAgo = (iso) => (iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : null);
// Kapso (número ORBIT) inserta por webhook: user_id vacío + timestamp con milisegundos.
// Un humano registrando a mano deja user_id o timestamp redondeado (sin subsegundo).
const hasSubsec = (iso) => /\.\d/.test(((iso || '').split('T')[1]) || '');
// Filtro rápido de autorespuestas de negocio (bienvenida/horario/agradecimiento) para no contarlas
// como "te respondieron". Heurística; el clasificador fino vive en src/lib/reply-classifier.ts.
const BOT_REPLY = /bienvenid|te saluda|gracias por (tu|su)|horario de atenci|canal de reservas|para reservar|no estamos respond|estamos cerrando|placer atender|indicarme tu nombre|en qu[eé] podemos ayudar|somos .* atenci[oó]n/i;
const isRealReply = (txt) => {
  const t = (txt || '').trim();
  if (!/[a-záéíóúñ]/i.test(t)) return false;                 // solo emojis/símbolos
  if (/^(gracias|muchas gracias|ok|oki|listo|perfecto|de nada)[\s.!¡]*$/i.test(t)) return false;
  if (BOT_REPLY.test(t)) return false;
  return true;
};
// Canal del último mensaje de SALIDA (donde vas a responder / dónde te escribieron).
const channelFromOut = (o) => {
  if (!o) return null; // sin evidencia registrada
  const t = o.action_type;
  if (t === 'email') return 'correo';
  if (t === 'auto_whatsapp') return 'kapso';
  if (t === 'call' || t === 'ai_call') return 'llamada';
  if (/personal/i.test(o.notes || '')) return 'personal';       // "WhatsApp personal" del GM
  if (o.user_id) return 'kapso';                                 // rep lo mandó vía ORBIT (número ORBIT/Kapso)
  if (o.user_id == null && hasSubsec(o.created_at)) return 'kapso';
  return 'personal';                                            // narración manual sin user → personal
};

const { data: users } = await sb.from('users').select('id, name');
const userMap = new Map((users || []).map((u) => [u.id, u.name]));

const SELECT = `
  id, name, phone, address, contact_actions, sales_stage, contacted_at, contacted_by, source, is_focus,
  searches ( business_type, city ),
  service_analyses!inner ( potential_tier, potential_score, estimated_revenue_min, estimated_revenue_max )`;

// paginado (Supabase corta en 1000)
async function fetchAll(make) {
  const size = 1000; const rows = []; let page = 0;
  for (;;) {
    const { data, error } = await make(page * size, page * size + size - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < size) break;
    page++;
  }
  return rows;
}

const ACTIVE = ['contactado', 'seguimiento_1', 'seguimiento_2', 'seguimiento_3', 'interesado', 'cotizado'];
const orcaRows = await fetchAll((from, to) =>
  sb.from('businesses').select(SELECT).eq('service_analyses.potential_tier', 'orca').range(from, to));
// Delfines: SOLO los en juego (stage activo), para no arrastrar el mar de delfines nuevos/fríos del bot.
const delfinRows = await fetchAll((from, to) =>
  sb.from('businesses').select(SELECT).eq('service_analyses.potential_tier', 'delfin').in('sales_stage', ACTIVE).range(from, to));
const rows = [...orcaRows, ...delfinRows];

// --- Actividad real: última comunicación por negocio desde contact_history ---
const ids = rows.map((b) => b.id);
const histByBiz = new Map(); // id -> [entries] (desc por fecha)
for (let i = 0; i < ids.length; i += 150) {
  const chunk = ids.slice(i, i + 150);
  const { data, error } = await sb
    .from('contact_history')
    .select('business_id, action_type, notes, created_at, user_id')
    .in('business_id', chunk)
    .order('created_at', { ascending: false });
  if (error) throw error;
  for (const e of (data || [])) {
    if (!histByBiz.has(e.business_id)) histByBiz.set(e.business_id, []);
    histByBiz.get(e.business_id).push(e);
  }
}

const one0 = (v) => (Array.isArray(v) ? v[0] : v) || {};
const toLead = (b) => {
  const a = one0(b.service_analyses); const s = one0(b.searches);
  const stage = STAGES.includes(b.sales_stage) ? b.sales_stage : 'nuevo';

  const hist = histByBiz.get(b.id) || [];
  const comms = hist.filter((e) => COMM.has(e.action_type));
  const lastComm = comms[0] || null;               // comunicación más reciente (in/out)
  const lastReply = comms.find((e) => e.action_type === INBOUND) || null;
  const lastOut = comms.find((e) => e.action_type !== INBOUND) || null; // nuestro último saliente
  const channel = channelFromOut(lastOut);         // canal real (evidencia); null si no hay
  // Actividad = última comunicación real; si no hay, cae a contacted_at.
  const activityAt = lastComm?.created_at || b.contacted_at || null;
  const days = daysAgo(activityAt);
  // Bola en tu cancha: lo último fue que ELLOS respondieron (y no una autorespuesta de bot).
  const awaiting = !!lastComm && lastComm.action_type === INBOUND && isRealReply(lastComm.notes);
  // ¿Alguna vez respondieron de verdad (no autorespuesta de bot)? = engagement real (para tibio).
  const hasEngaged = comms.some((e) => e.action_type === INBOUND && isRealReply(e.notes));
  const touched = hist.length > 0 || (Array.isArray(b.contact_actions) && b.contact_actions.length > 0) || stage !== 'nuevo';

  const revMax = a.estimated_revenue_max ?? null;
  const revMin = a.estimated_revenue_min ?? null;
  const type = s.business_type || '';
  const esGrande = (revMin ?? 0) >= GRANDE_REV || /hotel|hosp|cl[ií]nic|resort/i.test(type);
  return {
    id: b.id, name: b.name, phone: b.phone, city: s.city || null, type,
    tier: a.potential_tier || null,
    score: a.potential_score ?? null, revMin, revMax, stage, touched, awaiting,
    ownerId: b.contacted_by || null,
    ownerName: b.contacted_by ? (userMap.get(b.contacted_by) || 'Desconocido') : null,
    days, activityAt, esGrande, channel, isFocus: !!b.is_focus, noComms: !lastComm, hasEngaged,
    lastType: lastComm?.action_type || null,
    lastNote: (lastComm?.notes || '').replace(/\s+/g, ' ').trim() || null,
    replyNote: (lastReply?.notes || '').replace(/\s+/g, ' ').trim() || null,
  };
};

const orcas = rows
  .filter((b) => !EXCLUDE_NAMES.some((n) => (b.name || '').includes(n)))
  .map(toLead);
const open = orcas.filter((o) => !CLOSED.includes(o.stage));

// Buckets (mutuamente excluyentes en prioridad: respondieron > calientes > follows)
const byScore = (a, b) => (b.score ?? -1) - (a.score ?? -1);
const byColdest = (a, b) => (b.days ?? -1) - (a.days ?? -1);
const byFreshest = (a, b) => (a.days ?? 1e9) - (b.days ?? 1e9);

const isOrca = (o) => o.tier === 'orca';
const nf = (o) => !o.isFocus;                          // no-foco (los focos van arriba, sin duplicar)
const dropped = (o) => o.noComms && !o.ownerId;        // marcado 'contactado+' pero nunca mensajeado y sin dueño (ej. Brox)

// ⭐ Focos: TODO lead marcado con estrella en ORBIT, sin importar tier ni stage. Nunca se esconde.
const focos = open.filter((o) => o.isFocus).sort(byColdest);

const respondieron = open.filter((o) => nf(o) && o.awaiting).sort(byFreshest);
const calientes = open.filter((o) => nf(o) && HOT.includes(o.stage) && !o.awaiting).sort(byScore);
// Follows: orcas + delfines CON DUEÑO, con algún contacto real previo (excluye los 'dropped').
const follows = open
  .filter((o) => nf(o) && !dropped(o) && o.touched && !o.awaiting && !HOT.includes(o.stage) && (o.days ?? 0) >= 3 && (isOrca(o) || o.ownerId))
  .sort(byColdest);
// Marcados sin primer contacto: cualquier tier, sin dueño, sin ningún mensaje registrado (incluye a Brox).
const huerfanos = open.filter((o) => nf(o) && dropped(o) && !o.awaiting && (o.days ?? 99) >= 3).sort(byFreshest);
// Nuevas sin registro: solo orcas sin tocar (no queremos el mar de delfines nuevos).
const nuevas = open.filter((o) => nf(o) && isOrca(o) && !o.touched).sort(byScore);
const estancadas = open.filter((o) => nf(o) && !dropped(o) && !o.awaiting && (o.days ?? 0) >= 14 && !HOT.includes(o.stage) && (isOrca(o) || o.ownerId)).sort(byColdest);

// Temperatura por INTENCIÓN (igual que la app): caliente = interesado/cotizado — interés
// que marcó un HUMANO (el bot ya no toca stages, así que es confiable). Sin filtro de días.
// "Te respondieron" (awaiting) va aparte como su propia sección accionable.
// tibio = alguna vez respondieron de verdad, pero aún sin interés marcado.
const esCaliente = (o) => HOT.includes(o.stage) && !CLOSED.includes(o.stage);
const esTibio = (o) => !CLOSED.includes(o.stage) && !esCaliente(o) && o.hasEngaged;
const calientesReales = open.filter(esCaliente);
const tibiosReales = open.filter(esTibio);

// Tu día (Martín)
const misOrcas = orcas.filter((o) => o.ownerId === MARTIN_ID);
const misAbiertas = misOrcas.filter((o) => !CLOSED.includes(o.stage));
const peruOffset = -5 * 60;
const peru = new Date(now + (peruOffset - new Date().getTimezoneOffset()) * 60000);

// Helpers de formato
const soles = (n) => (n == null ? '?' : `S/${Math.round(n).toLocaleString('es-PE')}`);
const waLink = (phone) => {
  if (!phone) return null;
  const d = String(phone).replace(/[^\d]/g, '');
  const full = d.length <= 9 ? `51${d}` : d;
  return `https://wa.me/${full}`;
};
const CH_LABEL = {
  kapso: '📲 número ORBIT/Kapso',
  personal: '📱 tu WhatsApp personal',
  correo: '📧 correo @laundryheap',
  llamada: '📞 por llamada',
};
// Canal real si hay evidencia; si no, sugerencia por tamaño (marcada).
const ruta = (o) => CH_LABEL[o.channel]
  || (o.esGrande ? '📱 personal/correo (sugerido)' : '📲 número ORBIT/Kapso (sugerido)');
const dias = (o) => (o.days == null ? 'sin actividad' : `${o.days}d`);

const line = (o, opts = {}) => {
  const wa = waLink(o.phone);
  const rev = o.revMin != null ? `${soles(o.revMin)}–${soles(o.revMax)}/mes` : 'rev ?';
  const dueno = o.ownerName ? ` · ${o.ownerName}` : ' · sin dueño';
  const w = wa ? ` · ${wa}` : (o.phone ? ` · ${o.phone}` : ' · sin tel');
  let extra = '';
  if (opts.reply && o.replyNote) extra = `\n    ↳ respondió: "${o.replyNote.slice(0, 120)}"`;
  else if (opts.note && o.lastNote) extra = `\n    ↳ último (${o.lastType}): "${o.lastNote.slice(0, 100)}"`;
  return `- **${o.name}**${o.city ? ` (${o.city})` : ''} — score ${o.score ?? '?'} · ${rev} · ${dias(o)}${dueno} · ${ruta(o)}${w}${extra}`;
};

const block = (title, arr, opts = {}, n = 8) => {
  if (!arr.length) return `### ${title}\n_(nada)_\n`;
  const shown = arr.slice(0, n).map((o) => line(o, opts)).join('\n');
  const extra = arr.length > n ? `\n_+${arr.length - n} más_` : '';
  return `### ${title} — ${arr.length}\n${shown}${extra}\n`;
};

const orcasOpen = open.filter(isOrca);
const revOpenMin = orcasOpen.reduce((s, o) => s + (o.revMin || 0), 0);
const revOpenMax = orcasOpen.reduce((s, o) => s + (o.revMax || 0), 0);

const parte = `# 🐋 Parte de Orcas — ${peru.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}

**Resumen:** ⭐ ${focos.length} focos · ${orcasOpen.length} orcas abiertas · ${respondieron.length} te respondieron · ${calientesReales.length} calientes · ${tibiosReales.length} tibios · ${follows.length} follows · ${huerfanos.length} sin primer contacto · ${nuevas.length} orcas sin registro · potencial (orcas) ${soles(revOpenMin)}–${soles(revOpenMax)}/mes
_Días = desde la última actividad real en ORBIT (contact_history). Incluye orcas + delfines EN JUEGO (foco/calientes/con dueño/que respondieron). Marca leads con ⭐ en ORBIT para que aparezcan siempre acá. Tu trabajo por WhatsApp/LinkedIn fuera de ORBIT no se ve._

${block('⭐ TUS FOCOS — pase lo que pase, revísalos', focos, { note: true }, 20)}
${block('💬 TE RESPONDIERON — bola en tu cancha', respondieron, { reply: true })}
${block('🔥 CALIENTES — cerrar ya (interesado/cotizado)', calientesReales.filter((o) => nf(o) && !o.awaiting), { note: true }, 12)}
${block('🌡️ TIBIOS — empujar (respondieron, sin interés marcado aún)', tibiosReales.filter((o) => nf(o) && !o.awaiting), { note: true }, 10)}
${block('⏰ FOLLOWS vencidos (3d+)', follows, { note: true }, 12)}
${block('🆘 MARCADOS SIN PRIMER CONTACTO (sin dueño — asígnalos o mensájalos)', huerfanos, { note: true }, 15)}
${block('🆕 ORCAS sin registro de contacto en ORBIT', nuevas, {}, 10)}
${block('🧊 ESTANCADAS (14d+)', estancadas, { note: true })}
### 📌 Tu día (Martín)
- Tus orcas abiertas: **${misAbiertas.length}**
- Te respondieron y esperan: **${misAbiertas.filter((o) => o.awaiting).length}**
- Tuyas calientes (interesado/cotizado): **${misAbiertas.filter((o) => HOT.includes(o.stage)).length}**
- Tuyas con actividad hoy: **${misAbiertas.filter((o) => o.days === 0).length}**
- Tuyas vencidas (3d+, sin respuesta pendiente): **${misAbiertas.filter((o) => o.touched && !o.awaiting && !HOT.includes(o.stage) && (o.days ?? 0) >= 3).length}**
`;

console.log(parte);
