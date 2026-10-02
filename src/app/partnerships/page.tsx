'use client';

// URL of the Partnerships app (separate project: partnertship-lh).
// Runs locally via launchd on localhost:3000 (always alive).
// Can be overridden with NEXT_PUBLIC_PARTNERSHIPS_URL if the domain changes.
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
