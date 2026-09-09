'use client';

import { useState } from 'react';
import {
  fillTemplate,
  SEND_WINDOW,
  TIER_A,
  TIER_B,
  TIER_C,
  PRIMERA_RECOMPRA,
  SECOND_TOUCH,
  type FillVars,
} from '@/lib/reactivation-messages';
import type { ReactClient } from '@/lib/reactivation';

// Panel de guiones/mensajes dentro de la ficha. Copia el texto FINAL (ya con el
// nombre puesto), nunca la plantilla con {empresa}.
export default function MessagesPanel({
  client,
  contacto,
  brand,
  descuento,
  locked,
}: {
  client: ReactClient;
  contacto: string;
  brand: string;
  descuento: number;
  locked: boolean; // Tier A + Verificar sin confirmar → guion bloqueado
}) {
  if (client.is_control) return null; // Control: no se muestran mensajes.

  const vars: FillVars = { empresa: client.company, contacto, marca: brand, descuento };
  const fill = (t: string) => fillTemplate(t, vars);
  const tier = client.tier;
  const isPrimeraRecompra = !tier && client.list_type === 'primera_recompra';
  // 2do toque (llamada) aplica al flujo WhatsApp: Tier B/C y primera recompra
  const waFlow = tier === 'B' || tier === 'C' || isPrimeraRecompra;
  const showSecondTouch = client.status === 'toque1'; // 1er toque enviado / no respondió

  // Link directo de WhatsApp con el texto ya cargado (abre el chat del cliente).
  const wa = (text: string): string | null =>
    client.phone_norm ? `https://wa.me/${client.phone_norm}?text=${encodeURIComponent(text)}` : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-900">1. Manda el mensaje 💬</span>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Descuento {descuento}%</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Envío {SEND_WINDOW}</span>
        </div>
      </div>

      {locked ? (
        <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          Confirma la verificación (arriba) para habilitar el guion.
        </p>
      ) : tier === 'B' ? (
        <CopyBlock label="1er toque · WhatsApp" text={fill(TIER_B.firstTouch)} waHref={wa(fill(TIER_B.firstTouch))} />
      ) : tier === 'C' ? (
        <div className="space-y-2">
          <CopyBlock label="1er toque · WhatsApp" text={fill(TIER_C.firstTouch)} waHref={wa(fill(TIER_C.firstTouch))} />
          <CopyBlock label="Alternativa suave (sin quemar el %)" text={fill(TIER_C.soft)} waHref={wa(fill(TIER_C.soft))} />
        </div>
      ) : tier === 'A' ? (
        <TierAGuide fill={fill} />
      ) : isPrimeraRecompra ? (
        <div className="space-y-2">
          <CopyBlock label="1er toque · primera recompra" text={fill(PRIMERA_RECOMPRA.firstTouch)} waHref={wa(fill(PRIMERA_RECOMPRA.firstTouch))} />
          <CopyBlock label="Alternativa suave (sin quemar el %)" text={fill(PRIMERA_RECOMPRA.soft)} waHref={wa(fill(PRIMERA_RECOMPRA.soft))} />
        </div>
      ) : client.list_type === 'excluir' ? (
        <p className="text-sm text-gray-500">Segmento excluido — revisar antes de contactar (reclamo / pidió hace poco).</p>
      ) : (
        <p className="text-sm text-gray-400">Sin plantilla para este segmento.</p>
      )}

      {/* 2do toque (WhatsApp: Tier B/C y primera recompra) — guion de llamada de los 7 días */}
      {!locked && waFlow && showSecondTouch && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 mb-2">
            📞 {SECOND_TOUCH.hint}
          </p>
          <CopyBlock label="2do toque · llamada (7 días)" text={fill(SECOND_TOUCH.script)} />
          <p className="text-xs text-gray-400 mt-1">{SECOND_TOUCH.close}</p>
        </div>
      )}
    </div>
  );
}

// Bloque de texto final + botón Copiar (con feedback) + link directo de WhatsApp.
function CopyBlock({ label, text, waHref }: { label: string; text: string; waHref?: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // Fallback para contextos donde clipboard API está bloqueada (iframes, http).
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{label}</span>
        <div className="flex items-center gap-1.5">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            >
              💬 Abrir WhatsApp
            </a>
          )}
          <button
            onClick={copy}
            className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
              copied ? 'bg-emerald-100 text-emerald-700' : 'bg-[#0890F1] text-white hover:bg-[#0770C5]'
            }`}
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}

// Guion de llamada Tier A: por pasos, para leer/guiar (no se pega).
function TierAGuide({ fill }: { fill: (t: string) => string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 italic">{TIER_A.intro}</p>

      {TIER_A.steps.map((s) => (
        <div key={s.n} className="border-l-2 border-[#0890F1]/40 pl-3">
          <p className="text-xs uppercase tracking-wide text-[#0890F1] font-semibold">{s.n} · {s.title}</p>
          <p className="text-sm font-medium text-gray-900">{s.subtitle}</p>

          {s.quote && (
            s.copy ? (
              <div className="mt-1.5"><CopyBlock label="Apertura" text={fill(s.quote)} /></div>
            ) : (
              <p className="mt-1 text-sm text-gray-700 italic">“{fill(s.quote)}”</p>
            )
          )}
          {s.note && <p className="mt-1 text-xs text-gray-500">{fill(s.note)}</p>}
          {s.paths && (
            <div className="mt-1.5 space-y-1">
              {s.paths.map((p) => (
                <p key={p.k} className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-800">{p.k}:</span> {fill(p.t)}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1.5">Objeciones · respuestas rápidas</p>
        <div className="space-y-1">
          {TIER_A.objeciones.map((o) => (
            <p key={o.k} className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{o.k}:</span> {fill(o.t)}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
