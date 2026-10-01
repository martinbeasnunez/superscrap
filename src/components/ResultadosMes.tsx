'use client';

import { useEffect, useState } from 'react';

// Resultados mes a mes: qué se hizo (a mano vs bot) y qué resultó (respuestas, cierres).
// Pensado para responder de un vistazo "¿este mes sirvió de algo?".

interface TierStat { trabajadas: number; respondieron: number; nuevas: number }
interface MesResultado {
  mes: string;
  label: string;
  trabajoHumano: number;
  cuentasTrabajadas: number;
  botEnvios: number;
  respuestasReales: number;
  orca: TierStat;
  delfin: TierStat;
  ganados: { name: string; tier: string | null; conOwner: boolean }[];
  perdidos: { humano: number; bot: number };
  hitos: { name: string; tier: string | null; texto: string; cuando: string }[];
  orcasEnJuego: { name: string; stage: string | null; respondio: boolean }[];
}

// Etiqueta corta y honesta de la etapa de una jugada.
function stageBadge(stage: string | null): { txt: string; cls: string } {
  switch (stage) {
    case 'cotizado': return { txt: '💬 propuesta enviada', cls: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'interesado': return { txt: '🔥 mostró interés', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'cliente': return { txt: '✅ ganada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'perdido': return { txt: '❌ perdida', cls: 'bg-gray-100 text-gray-500 border-gray-200' };
    default: return { txt: '⏳ en seguimiento', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
}

function Metric({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="text-center min-w-[64px]">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{label}</p>
    </div>
  );
}

export default function ResultadosMes() {
  const [meses, setMeses] = useState<MesResultado[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/resultados-mes?meses=6')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setMeses(d.meses || []))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <div className="text-center py-12 text-gray-500">No se pudieron cargar los resultados.</div>;
  }
  if (!meses) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-10 w-10 border-3 border-[#0890F1] border-t-transparent rounded-full" />
      </div>
    );
  }
  if (meses.length === 0) {
    return <div className="text-center py-12 text-gray-500">Aún no hay actividad registrada.</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 px-1">
        Mes a mes: lo que se hizo <b>a mano</b> y lo que <b>resultó de verdad</b>. Separamos el trabajo de la persona del envío automático del bot, y las respuestas reales de ellos de las autorespuestas. Las <b>orcas</b> son lo que mueve la aguja.
      </p>

      {meses.map((m) => {
        const ganadosOrca = m.ganados.filter((g) => g.tier === 'orca');
        const ganadosDelfin = m.ganados.filter((g) => g.tier === 'delfin');
        const ganadosOtro = m.ganados.filter((g) => g.tier !== 'orca' && g.tier !== 'delfin');
        const sinResultadoOrca = m.orca.respondieron === 0 && ganadosOrca.length === 0;

        return (
          <div key={m.mes} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Cabecera del mes */}
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#0890F1]/5 to-transparent border-b border-gray-100">
              <h3 className="font-bold text-gray-900 capitalize">{m.label}</h3>
              {sinResultadoOrca ? (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                  ⚠️ ninguna orca mordió
                </span>
              ) : (
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                  🐋 {m.orca.respondieron} orca(s) respondieron · {ganadosOrca.length} ganada(s)
                </span>
              )}
            </div>

            <div className="p-5 grid gap-5 lg:grid-cols-2">
              {/* Lo que se HIZO */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Lo que se hizo</p>
                <div className="flex items-center gap-5 flex-wrap">
                  <Metric value={m.trabajoHumano} label="toques a mano" color="text-[#0890F1]" />
                  <Metric value={m.cuentasTrabajadas} label="cuentas trabajadas" color="text-[#0890F1]" />
                  <div className="w-px h-10 bg-gray-200" />
                  <Metric value={m.botEnvios} label="envíos del bot 🤖" color="text-gray-400" />
                </div>
              </div>

              {/* Lo que RESULTÓ */}
              <div className="lg:border-l lg:border-gray-100 lg:pl-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Lo que resultó</p>
                <div className="flex items-center gap-5 flex-wrap">
                  <Metric value={m.respuestasReales} label="respondieron de verdad" color="text-[#D4A84F]" />
                  <div className="w-px h-10 bg-gray-200" />
                  <Metric value={`${m.orca.respondieron}/${m.orca.trabajadas}`} label="orcas respondieron/trabajadas" color="text-[#9A7A35]" />
                  <Metric value={`${m.delfin.respondieron}/${m.delfin.trabajadas}`} label="delfines resp./trab." color="text-gray-500" />
                </div>
              </div>
            </div>

            {/* Siembra + cierres */}
            <div className="px-5 pb-4 flex flex-wrap items-center gap-2 text-sm">
              {(m.orca.nuevas > 0 || m.delfin.nuevas > 0) && (
                <span
                  className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-xs"
                  title="Leads que el buscador scrapeó y puntuó este mes. No es siembra a mano."
                >
                  📥 Entraron al sistema: {m.orca.nuevas > 0 && <b>{m.orca.nuevas} orca(s)</b>} {m.delfin.nuevas > 0 && <>· {m.delfin.nuevas} delfín(es)</>}
                </span>
              )}
              {m.ganados.length > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-1 text-xs">
                  ✅ Ganados: {ganadosOrca.length > 0 && <b>{ganadosOrca.length} orca</b>}{ganadosDelfin.length > 0 && <> · {ganadosDelfin.length} delfín</>}{ganadosOtro.length > 0 && <> · {ganadosOtro.length} otros</>}
                  {' — '}{m.ganados.map((g) => g.name).join(', ')}
                </span>
              )}
              {(m.perdidos.humano > 0 || m.perdidos.bot > 0) && (
                <span className="inline-flex items-center gap-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 text-xs">
                  ❌ Perdidos: {m.perdidos.humano} a mano{m.perdidos.bot > 0 && <> · {m.perdidos.bot} auto-cierre del bot</>}
                </span>
              )}
            </div>

            {/* Orcas en juego: tus jugadas del mes, con nombre y etapa (aunque no hayan respondido) */}
            {m.orcasEnJuego.length > 0 && (
              <div className="px-5 pb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">🐋 Orcas en juego este mes ({m.orcasEnJuego.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {m.orcasEnJuego.map((o, i) => {
                    const b = stageBadge(o.stage);
                    return (
                      <span key={i} className={`inline-flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs ${b.cls}`}>
                        <b>{o.name}</b>
                        <span className="opacity-70">· {b.txt}</span>
                        {o.respondio && <span title="Te respondió este mes">· 💬 respondió</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hitos: respuestas reales de orcas (lo más valioso) */}
            {m.hitos.length > 0 && (
              <div className="px-5 pb-5">
                <p className="text-xs font-semibold text-gray-500 mb-2">🐋 Orcas que respondieron</p>
                <ul className="space-y-1.5">
                  {m.hitos.map((h, i) => (
                    <li key={i} className="text-sm text-gray-700 bg-[#FFF8E7] border border-[#F0E3C0] rounded-lg px-3 py-2">
                      <b className="text-[#9A7A35]">{h.name}</b>
                      {h.texto && <span className="text-gray-600"> — «{h.texto}»</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
