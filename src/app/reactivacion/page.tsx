'use client';

import dynamic from 'next/dynamic';

// B2B Reactivation (Mission 2) — its own section in the general menu.
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
        <h1 className="text-2xl font-bold text-gray-900">♻️ Win back customers</h1>
        <p className="text-gray-500 mt-0.5">Business customers who stopped ordering — bring them back</p>
      </div>
      <Reactivacion />
    </div>
  );
}
