'use client';

import { useState } from 'react';
import {
  fillTemplate,
  SEND_WINDOW,
  TIER_A,
  TIER_C,
  PRIMERA_RECOMPRA,
  SECOND_TOUCH,
  RECENCY_PITCH,
  RECENCY_META,
  recencyBucket,
  type FillVars,
} from '@/lib/reactivation-messages';
import type { ReactClient } from '@/lib/reactivation';

// Script/message panel inside the card. Copies the FINAL text (with the
// name already filled in), never the template with {empresa}.
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
  if (client.is_control) return null; // Control: no messages are shown.

  const vars: FillVars = { empresa: client.company, contacto, marca: brand, descuento };
  const fill = (t: string) => fillTemplate(t, vars);
  const tier = client.tier;
  const isPrimeraRecompra = !tier && client.list_type === 'primera_recompra';
  // Tone based on how long since they last ordered (only reactivation list B/C).
  const recency = recencyBucket(client.days_inactive);
  const recencyPitch = fill(RECENCY_PITCH[recency]);
  // 2nd touch (call) applies to the WhatsApp flow: Tier B/C and first repurchase
  const waFlow = tier === 'B' || tier === 'C' || isPrimeraRecompra;
  const showSecondTouch = client.status === 'toque1'; // 1st touch sent / no reply

  // Direct WhatsApp link with the text preloaded (opens the client's chat).
  const wa = (text: string): string | null =>
    client.phone_norm ? `https://wa.me/${client.phone_norm}?text=${encodeURIComponent(text)}` : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-900">1. Send the message 💬</span>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Discount {descuento}%</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Delivery {SEND_WINDOW}</span>
        </div>
      </div>

      {locked ? (
        <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          Confirm the verification (above) to enable the script.
        </p>
      ) : tier === 'B' ? (
        <div className="space-y-2">
          <RecencyNote recency={recency} />
          <CopyBlock label="1st message · WhatsApp" text={recencyPitch} waHref={wa(recencyPitch)} />
        </div>
      ) : tier === 'C' ? (
        <div className="space-y-2">
          <RecencyNote recency={recency} />
          <CopyBlock label="1st message · WhatsApp" text={recencyPitch} waHref={wa(recencyPitch)} />
          <CopyBlock label="Soft alternative (without burning the %)" text={fill(TIER_C.soft)} waHref={wa(fill(TIER_C.soft))} />
        </div>
      ) : tier === 'A' ? (
        <TierAGuide fill={fill} />
      ) : isPrimeraRecompra ? (
        <div className="space-y-2">
          <CopyBlock label="1st message · bought once" text={fill(PRIMERA_RECOMPRA.firstTouch)} waHref={wa(fill(PRIMERA_RECOMPRA.firstTouch))} />
          <CopyBlock label="Soft alternative (without burning the %)" text={fill(PRIMERA_RECOMPRA.soft)} waHref={wa(fill(PRIMERA_RECOMPRA.soft))} />
        </div>
      ) : client.list_type === 'excluir' ? (
        <p className="text-sm text-gray-500">Excluded segment — review before contacting (complaint / ordered recently).</p>
      ) : (
        <p className="text-sm text-gray-400">No template for this segment.</p>
      )}

      {/* 2nd touch (WhatsApp: Tier B/C and first repurchase) — 7-day call script */}
      {!locked && waFlow && showSecondTouch && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 mb-2">
            📞 {SECOND_TOUCH.hint}
          </p>
          <CopyBlock label="2nd round · call (7 days)" text={fill(SECOND_TOUCH.script)} />
          <p className="text-xs text-gray-400 mt-1">{SECOND_TOUCH.close}</p>
        </div>
      )}
    </div>
  );
}

// Tone note based on recency (why this message and not another).
function RecencyNote({ recency }: { recency: 'reciente' | 'medio' | 'viejo' }) {
  const meta = RECENCY_META[recency];
  const style = recency === 'reciente'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : recency === 'medio'
    ? 'bg-blue-50 text-blue-800 border-blue-200'
    : 'bg-amber-50 text-amber-800 border-amber-200';
  return (
    <div className={`text-xs rounded-lg border px-3 py-1.5 ${style}`}>
      <span className="font-semibold">{meta.label}.</span> {meta.hint}
    </div>
  );
}

// Final text block + Copy button (with feedback) + direct WhatsApp link.
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
      // Fallback for contexts where the clipboard API is blocked (iframes, http).
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
              💬 Open WhatsApp
            </a>
          )}
          <button
            onClick={copy}
            className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
              copied ? 'bg-emerald-100 text-emerald-700' : 'bg-[#0890F1] text-white hover:bg-[#0770C5]'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}

// Tier A call script: step by step, to read/guide (not pasted).
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
              <div className="mt-1.5"><CopyBlock label="Opening" text={fill(s.quote)} /></div>
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
        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1.5">Objections · quick responses</p>
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
