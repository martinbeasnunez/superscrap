'use client';

import Link from 'next/link';

// Tab strip compartido entre Pipeline (/seguimiento) y Reactivación (/reactivacion).
// Se ve como un tab dentro del Pipeline, pero cada lado es su propia ruta
// (así el highlight del sidebar funciona limpio).
export default function SectionTabs({ active }: { active: 'pipeline' | 'reactivacion' }) {
  const base = 'text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors';
  const on = 'bg-[#0890F1] text-white';
  const off = 'text-gray-600 hover:bg-gray-100';
  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm mb-4 w-fit">
      <Link href="/seguimiento" className={`${base} ${active === 'pipeline' ? on : off}`}>
        🎯 Pipeline
      </Link>
      <Link href="/reactivacion" className={`${base} ${active === 'reactivacion' ? on : off}`}>
        ♻️ Reactivación
      </Link>
    </div>
  );
}
