import { NextRequest, NextResponse } from 'next/server';
import { syncFromBO } from '@/lib/bo-sync';

// Sync automático de Reactivación contra el BO (api.apps.getlavado.com).
// Lo dispara el cron de Vercel (vercel.json) de madrugada, así ORBIT amanece
// con los días reales y los recuperados marcados — sin bajar reportes a mano.
// Ver src/lib/bo-sync.ts.
export const maxDuration = 120;

async function run(request: NextRequest) {
  // Si hay CRON_SECRET, Vercel lo manda como Bearer. Sin él queda abierto,
  // pero escribe datos → mejor setear CRON_SECRET en producción.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncFromBO();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('sync-bo error:', e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return run(request); }
export async function POST(request: NextRequest) { return run(request); }
