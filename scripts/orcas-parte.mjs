// Parte diario de orcas — corre en la rutina de las 8am.
// Consulta Supabase directo (sin server ni deploy) y arma el parte:
// nuevas sin tocar, calientes, follows vencidos, estancadas y "Tu día" (Martín).
// Uso: node scripts/orcas-parte.mjs
import { readFileSync } from 'fs';

const MARTIN_ID = '87f03c9f-9c41-440a-b8b9-683c9a30b427'; // martin@getlavado.com
// Toda orca ya supera S/2,500/mes (regla del GM). Para el ruteo, "grande" = cuenta
// premium que Martín trabaja personalmente: potencial >= S/5,000 o rubro hotel/clínica.
const GRANDE_REV = 5000;

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
const now = Date.now();
const one = (v) => (Array.isArray(v) ? v[0] : v) || {};

const { data: users } = await sb.from('users').select('id, name');
const userMap = new Map((users || []).map((u) => [u.id, u.name]));

const SELECT = `
  id, name, phone, address, contact_actions, sales_stage, contacted_at, contacted_by, source,
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

const rows = await fetchAll((from, to) =>
  sb.from('businesses').select(SELECT).eq('service_analyses.potential_tier', 'orca').range(from, to));

const toLead = (b) => {
  const a = one(b.service_analyses); const s = one(b.searches);
  const stage = STAGES.includes(b.sales_stage) ? b.sales_stage : 'nuevo';
  const actions = Array.isArray(b.contact_actions) ? b.contact_actions : [];
  const contacted = actions.length > 0 || (b.sales_stage && b.sales_stage !== 'nuevo');
  const days = b.contacted_at ? Math.floor((now - new Date(b.contacted_at).getTime()) / 86400000) : null;
  const revMax = a.estimated_revenue_max ?? null;
  const revMin = a.estimated_revenue_min ?? null;
  const type = s.business_type || '';
  const esGrande = (revMin ?? 0) >= GRANDE_REV || /hotel|hosp|cl[ií]nic|resort/i.test(type);
  return {
    id: b.id, name: b.name, phone: b.phone, city: s.city || null, type,
    score: a.potential_score ?? null, revMin, revMax, stage, contacted,
    ownerId: b.contacted_by || null,
    ownerName: b.contacted_by ? (userMap.get(b.contacted_by) || 'Desconocido') : null,
    days, esGrande,
  };
};

const orcas = rows.map(toLead);
const open = orcas.filter((o) => !CLOSED.includes(o.stage));

// Buckets
const byScore = (a, b) => (b.score ?? -1) - (a.score ?? -1);
const byColdest = (a, b) => (b.days ?? -1) - (a.days ?? -1);

const nuevas = open.filter((o) => o.stage === 'nuevo' && !o.contacted).sort(byScore);
const calientes = open.filter((o) => HOT.includes(o.stage)).sort(byScore);
const follows = open
  .filter((o) => o.contacted && !HOT.includes(o.stage) && (o.days ?? 0) >= 3)
  .sort(byColdest);
const estancadas = open.filter((o) => (o.days ?? 0) >= 14 && !HOT.includes(o.stage)).sort(byColdest);

// Tu día (Martín)
const misOrcas = orcas.filter((o) => o.ownerId === MARTIN_ID);
const misAbiertas = misOrcas.filter((o) => !CLOSED.includes(o.stage));
const peruOffset = -5 * 60;
const peru = new Date(now + (peruOffset - new Date().getTimezoneOffset()) * 60000);
const startPeru = new Date(peru.getFullYear(), peru.getMonth(), peru.getDate());
const todayISO = new Date(startPeru.getTime() - peruOffset * 60000).toISOString();

// Helpers de formato
const soles = (n) => (n == null ? '?' : `S/${Math.round(n).toLocaleString('es-PE')}`);
const waLink = (phone) => {
  if (!phone) return null;
  const d = String(phone).replace(/[^\d]/g, '');
  const full = d.length <= 9 ? `51${d}` : d;
  return `https://wa.me/${full}`;
};
const ruta = (o) => (o.esGrande ? '📱 tu WhatsApp / correo @laundryheap' : '☎️ número ORBIT/Kapso');

const line = (o) => {
  const wa = waLink(o.phone);
  const dias = o.days == null ? 'sin contacto' : `${o.days}d`;
  const rev = o.revMin != null ? `${soles(o.revMin)}–${soles(o.revMax)}/mes` : 'rev ?';
  const dueno = o.ownerName ? ` · ${o.ownerName}` : ' · sin dueño';
  const w = wa ? ` · ${wa}` : (o.phone ? ` · ${o.phone}` : ' · sin tel');
  return `- **${o.name}**${o.city ? ` (${o.city})` : ''} — score ${o.score ?? '?'} · ${rev} · ${dias}${dueno} · ${ruta(o)}${w}`;
};

const block = (title, arr, n = 8) => {
  if (!arr.length) return `### ${title}\n_(nada)_\n`;
  const shown = arr.slice(0, n).map(line).join('\n');
  const extra = arr.length > n ? `\n_+${arr.length - n} más_` : '';
  return `### ${title} — ${arr.length}\n${shown}${extra}\n`;
};

const revOpenMin = open.reduce((s, o) => s + (o.revMin || 0), 0);
const revOpenMax = open.reduce((s, o) => s + (o.revMax || 0), 0);

const parte = `# 🐋 Parte de Orcas — ${peru.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}

**Resumen:** ${open.length} orcas abiertas · ${calientes.length} calientes · ${nuevas.length} nuevas sin tocar · ${open.filter((o) => !o.ownerId).length} sin dueño · potencial ${soles(revOpenMin)}–${soles(revOpenMax)}/mes

${block('🔥 CALIENTES — cerrar ya', calientes)}
${block('🆕 NUEVAS sin tocar', nuevas)}
${block('⏰ FOLLOWS vencidos (3d+)', follows)}
${block('🧊 ESTANCADAS (14d+)', estancadas)}
### 📌 Tu día (Martín)
- Tus orcas abiertas: **${misAbiertas.length}**
- Contactadas hoy por ti: **${misOrcas.filter((o) => o.days === 0).length}**
- Tuyas calientes (interesado/cotizado): **${misOrcas.filter((o) => HOT.includes(o.stage)).length}**
- Tuyas vencidas (3d+): **${misAbiertas.filter((o) => o.contacted && !HOT.includes(o.stage) && (o.days ?? 0) >= 3).length}**
`;

console.log(parte);
