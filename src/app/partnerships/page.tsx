'use client';

// URL de la app Partnerships (proyecto aparte: partnertship-lh).
// Corre local con launchd en localhost:3000 (siempre vivo).
// Se puede sobreescribir con NEXT_PUBLIC_PARTNERSHIPS_URL si cambia el dominio.
const PARTNERSHIPS_URL =
  process.env.NEXT_PUBLIC_PARTNERSHIPS_URL || 'http://localhost:3000/pipeline';

export default function PartnershipsPage() {
  return (
    <div className="h-[calc(100dvh-3.5rem)] lg:h-screen w-full">
      <iframe
        src={PARTNERSHIPS_URL}
        title="Partnerships"
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
