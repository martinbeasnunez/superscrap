'use client';

import dynamic from 'next/dynamic';
import SectionTabs from '@/components/reactivation/SectionTabs';

// Reactivación B2B (Misión 2) — ruta propia en el menú, mismo tab strip que Pipeline.
const Reactivacion = dynamic(() => import('@/components/reactivation/Reactivacion'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-10 w-10 border-3 border-[#0890F1] border-t-transparent rounded-full" />
    </div>
  ),
});

export default function ReactivacionPage() {
  return (
    <div className="p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
      <div className="hidden lg:block mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Pipeline de Ventas</h1>
        <p className="text-gray-500 mt-0.5">Reactivación B2B · recuperar clientes que dejaron de pedir</p>
      </div>
      <SectionTabs active="reactivacion" />
      <Reactivacion />
    </div>
  );
}
