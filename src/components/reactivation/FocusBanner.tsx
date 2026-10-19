'use client';

// Franja de ESTRATEGIA: hace visible la jugada del mes — foco en los que sí
// vuelven (frescos + tibios), no rociar toda la lista. Nace del aprendizaje de
// setiembre: contactar a todos no movió la aguja; la plata está en la recencia.

export default function FocusBanner({
  fresh,
  warm,
  total,
  onFresh,
  onWarm,
}: {
  fresh: number;
  warm: number;
  total: number;
  onFresh: () => void;
  onWarm: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50/70 p-4">
      <div className="flex items-center gap-2">
        <span className="text-base">🎯</span>
        <span className="text-sm font-bold text-emerald-900">La jugada del mes: foco en los que SÍ vuelven</span>
      </div>
      <p className="text-xs text-emerald-800/90 mt-1">
        Setiembre probó que contactar a toda la lista no movió la aguja. La plata está en la recencia — trabaja estos dos:
      </p>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <button onClick={onFresh} className="text-left rounded-lg bg-white border border-emerald-300 px-3 py-2.5 hover:bg-emerald-100 transition-colors">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 leading-none">{fresh}</span>
            <span className="text-sm font-semibold text-gray-800">🌱 Frescos</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">se fueron hace poco — los de más chance</div>
        </button>
        <button onClick={onWarm} className="text-left rounded-lg bg-white border border-teal-300 px-3 py-2.5 hover:bg-teal-100 transition-colors">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal-600 leading-none">{warm}</span>
            <span className="text-sm font-semibold text-gray-800">🔄 Tibios</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">ya dijeron &quot;próximo mes&quot; — levantaron la mano</div>
        </button>
      </div>

      <p className="text-[11px] text-emerald-800/70 mt-2.5">
        El resto de la lista ({total}) es <b>baja prioridad</b> — no gastes el día rociando a todos.
      </p>
    </div>
  );
}
