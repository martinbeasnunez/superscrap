'use client';

// URL de la app Crossup (proyecto aparte, deploy propio).
// Se puede sobreescribir con NEXT_PUBLIC_CROSSUP_URL si cambia el dominio.
const CROSSUP_URL =
  process.env.NEXT_PUBLIC_CROSSUP_URL || 'https://crossup-rho.vercel.app';

export default function CrossupPage() {
  return (
    <div className="h-[calc(100dvh-3.5rem)] lg:h-screen w-full">
      <iframe
        src={CROSSUP_URL}
        title="Crossup"
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
