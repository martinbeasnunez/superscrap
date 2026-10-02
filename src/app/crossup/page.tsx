'use client';

// URL of the Crossup app (separate project, its own deploy).
// Can be overridden with NEXT_PUBLIC_CROSSUP_URL if the domain changes.
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
