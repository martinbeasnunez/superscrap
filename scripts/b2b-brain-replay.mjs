// Prueba del cerebro B2B sobre conversaciones REALES. NO envía nada ni escribe en la base:
// solo lee contact_history y muestra qué habría respondido.
// Uso: node --experimental-strip-types scripts/b2b-brain-replay.mjs "Club Dionys" "Rafael" ...
// (sin argumentos usa la lista por defecto)
import { readFileSync } from 'fs';
import { runB2bBrain } from '../src/lib/b2b-brain.ts';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const strip = (s) => s.replace(/^["']|["']$/g, '');
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), strip(l.slice(i + 1).trim())]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const NAMES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['Club Dionys', 'Rafael', 'Clínica Dental Cano', 'Apart Hotel Caminos del Inca', 'VivirPilates', 'Red Geriátrica', 'Casa de Reposo "Alfredo Novoa"', 'Casa De Reposo San Francisco', 'Cirugía 24 Horas', 'Casino Mardigras'];

const OUT = new Set(['auto_whatsapp', 'whatsapp', 'auto_whatsapp_reply']);

for (const name of NAMES) {
  const { data: biz } = await sb.from('businesses').select('id,name,business_type').ilike('name', `${name}%`).limit(1).maybeSingle();
  if (!biz) { console.log(`\n### ${name}: no encontrado`); continue; }
  const { data: hist } = await sb.from('contact_history')
    .select('action_type,notes,created_at')
    .eq('business_id', biz.id)
    .in('action_type', ['whatsapp_reply', ...OUT])
    .order('created_at', { ascending: false }).limit(14);
  const chron = [...(hist || [])].reverse()
    .filter((h) => !/^\[20-oct\]/.test(h.notes || '') && !/^\[Kapso/.test(h.notes || '') || h.action_type === 'whatsapp_reply')
    .map((h) => ({ from: h.action_type === 'whatsapp_reply' ? 'ellos' : 'nosotros', text: h.notes || '', at: h.created_at }));
  // cortar en el último mensaje de ELLOS
  let last = chron.length - 1;
  while (last >= 0 && chron[last].from !== 'ellos') last--;
  if (last < 0) { console.log(`\n### ${biz.name}: sin respuesta de ellos`); continue; }
  const turns = chron.slice(0, last + 1);
  const hrs = Math.round((Date.now() - new Date(turns[last].at).getTime()) / 3600000);
  const out = await runB2bBrain({ businessName: biz.name, businessType: biz.business_type, transcript: turns, hoursSinceLastInbound: hrs }, openai);
  console.log(`\n### ${biz.name}  (último msg de ellos hace ${hrs}h${out.needsTemplate ? ' → necesita plantilla' : ''})`);
  console.log(`ELLOS: ${turns[last].text.slice(0, 200).replace(/\n/g, ' ')}`);
  console.log(`CEREBRO [${out.action} · ${out.intent}]: ${out.reply || '(sin respuesta)'}`);
  console.log(`  por qué: ${out.reason}${Object.keys(out.extracted).length ? ' | datos: ' + JSON.stringify(out.extracted) : ''}`);
}
