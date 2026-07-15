'use client';

import { useEffect, useState } from 'react';

interface LossByStage {
  stage: string;
  label: string;
  count: number;
  topReason: string | null;
  topReasonLabel: string | null;
}

interface LossByReason {
  reason: string;
  label: string;
  count: number;
}

interface Insights {
  month: string;
  availableMonths: string[];
  summary: {
    totalLeads: number;
    wonClientes: number;
    lostPerdidos: number;
    activeLeads: number;
    winRate: number;
  };
  lossByPreviousStage: LossByStage[];
  lossByReason: LossByReason[];
}

// 'YYYY-MM' -> 'Junio 2026'
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Mes en curso ('YYYY-MM') — default del selector: arranca en el mes actual,
// no en todo el histórico.
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Recomendación accionable por cada motivo de pérdida.
// La gracia del bloque no es el gráfico, es el "¿y ahora qué hago?".
const REASON_TIPS: Record<string, string> = {
  precio:
    'Ofrece un plan de entrada o precio por volumen, y muéstrales el ahorro real vs. lavar internamente.',
  lavado_interno:
    'Cuantifica su costo oculto (personal, agua, espacio, roturas) y véndeles ahorro + consistencia.',
  tiene_proveedor:
    'Ofrece un piloto sin compromiso y compite por tiempos y servicio, no solo por precio.',
  mal_timing:
    'No los pierdas: agéndalos para recontacto en 30–60 días. El interés existe, falta el momento.',
  no_interesado:
    'Revisa a quién estás prospectando — puede ser un problema de segmentación, no de venta.',
  no_contesta:
    'Prueba otro canal y horario, y combina WhatsApp con llamada antes de darlos por perdidos.',
  no_decisor:
    'Desde el primer contacto pide hablar con el dueño o gerente que toma la decisión.',
};

function Bar({ value, max, color, track }: { value: number; max: number; color: string; track: string }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex-1 h-1.5 rounded-full" style={{ background: track }}>
      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function LossInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [month, setMonth] = useState(currentMonthKey);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/insights?month=${encodeURIComponent(month)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((d: Insights) => {
        if (!('error' in d)) setData(d);
      })
      .catch((e) => console.error('Error fetching insights:', e))
      .finally(() => setLoading(false));
  }, [month]);

  if (!data && loading) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm mb-4 sm:mb-6 h-40 animate-pulse" />
    );
  }
  if (!data) return null;
  // En "todo el tiempo" sin perdidos, ocultamos el bloque entero.
  // Con un mes elegido mostramos el header + un vacío (para poder cambiar de mes).
  if (month === 'all' && data.summary.lostPerdidos === 0) return null;

  const { summary, lossByReason, lossByPreviousStage } = data;

  // Motivos con razón registrada (excluye "Sin razón") para las recomendaciones.
  const reasonsWithLabel = lossByReason.filter((r) => r.reason !== 'unset');
  const unset = lossByReason.find((r) => r.reason === 'unset');
  const unsetShare = summary.lostPerdidos > 0 ? (unset?.count ?? 0) / summary.lostPerdidos : 0;

  const maxReason = Math.max(1, ...lossByReason.map((r) => r.count));
  const maxStage = Math.max(1, ...lossByPreviousStage.map((s) => s.count));

  // Top 3 motivos accionables para las recomendaciones.
  const topTips = reasonsWithLabel
    .filter((r) => REASON_TIPS[r.reason])
    .slice(0, 3);

  // Insight de embudo: ¿dónde se caen realmente los leads perdidos?
  // Cuatro momentos, no dos. El detalle clave: el seguimiento no es un solo
  // saco — caer en Seguimiento 1-2 (abandonaste antes de tiempo) pide MÁS
  // insistencia, pero caer en Último Intento (ya agotaste la secuencia) pide
  // lo contrario: el problema ya no es insistir, es a quién prospectas y si el
  // mensaje engancha. Meterlos juntos daría el consejo al revés.
  const STAGE_BUCKET: Record<string, 'prospeccion' | 'seguimiento' | 'agotado' | 'cierre'> = {
    nuevo: 'prospeccion',
    contactado: 'prospeccion',
    seguimiento_1: 'seguimiento',
    seguimiento_2: 'seguimiento',
    seguimiento_3: 'agotado', // "Último Intento" — perseguido hasta el final
    interesado: 'cierre',
    cotizado: 'cierre',
    cliente: 'cierre',
  };
  const bucketTotals = { prospeccion: 0, seguimiento: 0, agotado: 0, cierre: 0 };
  for (const s of lossByPreviousStage) {
    const b = STAGE_BUCKET[s.stage];
    if (b) bucketTotals[b] += s.count;
  }
  const stagedTotal =
    bucketTotals.prospeccion + bucketTotals.seguimiento + bucketTotals.agotado + bucketTotals.cierre;
  const dominantBucket = (['prospeccion', 'seguimiento', 'agotado', 'cierre'] as const).reduce((a, b) =>
    bucketTotals[b] > bucketTotals[a] ? b : a
  );
  const dominantShare = stagedTotal > 0 ? Math.round((bucketTotals[dominantBucket] / stagedTotal) * 100) : 0;

  const decided = summary.wonClientes + summary.lostPerdidos;
  const lostShare = decided > 0 ? Math.round((summary.lostPerdidos / decided) * 100) : 0;

  // Garantiza que el mes seleccionado (por defecto el mes en curso) siempre sea
  // una opción, aunque el API aún no lo devuelva por no tener leads decididos.
  const monthOptions =
    month === 'all' || data.availableMonths.includes(month)
      ? data.availableMonths
      : [month, ...data.availableMonths];

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <h2 className="text-sm sm:text-lg font-semibold text-gray-900">¿Por qué perdemos leads?</h2>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
            {summary.lostPerdidos} perdidos · {lostShare}% de los decididos
          </span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-[11px] sm:text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Todo el tiempo</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {summary.lostPerdidos === 0 ? (
        <div className="bg-white rounded-xl sm:rounded-2xl p-6 border border-gray-100 shadow-sm text-center text-sm text-gray-400">
          No se perdió ningún lead en {monthLabel(month)}
        </div>
      ) : (
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Motivos de rechazo */}
          <div>
            <div className="text-xs sm:text-sm font-bold text-gray-800 mb-3">🧨 Motivo del rechazo</div>
            <div className="flex flex-col gap-2.5">
              {lossByReason.slice(0, 7).map((r) => (
                <div key={r.reason}>
                  <div className="flex justify-between items-baseline mb-1 text-xs gap-2">
                    <span className="text-gray-700 truncate">{r.label}</span>
                    <span className="text-gray-400 tabular-nums">{r.count}</span>
                  </div>
                  <Bar value={r.count} max={maxReason} color="#ef4444" track="#fef2f2" />
                </div>
              ))}
            </div>
          </div>

          {/* En qué etapa se caen */}
          <div>
            <div className="text-xs sm:text-sm font-bold text-gray-800 mb-3">💀 ¿En qué etapa se caen?</div>
            {lossByPreviousStage.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin datos de etapa aún.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {lossByPreviousStage.map((s) => (
                  <div key={s.stage}>
                    <div className="flex justify-between items-baseline mb-1 text-xs gap-2">
                      <span className="text-gray-700 truncate">{s.label}</span>
                      <span className="text-gray-400 tabular-nums">{s.count}</span>
                    </div>
                    <Bar value={s.count} max={maxStage} color="#f97316" track="#fff7ed" />
                    {s.topReasonLabel && (
                      <div className="text-[10px] text-gray-400 italic mt-0.5">↳ sobre todo por {s.topReasonLabel}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Insight de embudo */}
        {stagedTotal > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-600">
            {dominantBucket === 'cierre' ? (
              <span>
                📉 <strong>{dominantShare}%</strong> de las pérdidas ocurren tarde (interesados o cotizados). El
                problema está en el <strong>cierre</strong>, no en la prospección — cuida precio, seguimiento y
                objeciones en la recta final.
              </span>
            ) : dominantBucket === 'agotado' ? (
              <span>
                📉 <strong>{dominantShare}%</strong> de las pérdidas ocurren en el <strong>Último Intento</strong> —
                leads que perseguiste hasta agotar el seguimiento y aun así no cerraron. Insistir más no es la
                solución: el problema está <strong>arriba, en la calificación</strong> — apunta a mejores leads y a
                una apertura que enganche, para no gastar toda la secuencia en quien no iba a comprar.
              </span>
            ) : dominantBucket === 'seguimiento' ? (
              <span>
                📉 <strong>{dominantShare}%</strong> de las pérdidas ocurren a mitad del <strong>seguimiento</strong> —
                leads que dejaste de perseguir antes de tiempo. Aún hay margen: suma toques, varía canal y horario, y
                combina WhatsApp con llamada antes de darlos por perdidos.
              </span>
            ) : (
              <span>
                📉 La mayoría de las pérdidas son <strong>tempranas</strong> (antes de establecer contacto real). El
                cuello de botella está en <strong>prospección y primer contacto</strong> — mejora a quién prospectas y
                el mensaje de apertura.
              </span>
            )}
          </div>
        )}

        {/* Recomendaciones accionables */}
        {topTips.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs sm:text-sm font-bold text-gray-800 mb-2">💡 Qué hacer</div>
            <div className="flex flex-col gap-2">
              {topTips.map((r) => (
                <div key={r.reason} className="flex gap-2 text-xs">
                  <span className="text-gray-800 font-medium whitespace-nowrap">{r.label}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-gray-600">{REASON_TIPS[r.reason]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nudge de calidad de datos: si muchos perdidos no tienen razón, los insights valen poco */}
        {unsetShare >= 0.3 && (
          <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            ⚠️ El {Math.round(unsetShare * 100)}% de los leads perdidos no tiene un motivo registrado. Pide al equipo
            marcar la razón al mover una card a <strong>Perdido</strong> — así estos insights se vuelven mucho más
            útiles.
          </div>
        )}
      </div>
      )}
    </div>
  );
}
