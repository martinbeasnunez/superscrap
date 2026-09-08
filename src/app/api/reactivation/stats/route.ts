import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/reactivation/stats
// KPI real: tasa de reactivación del grupo Contactado vs el grupo Control.
// Solo cuenta la lista de reactivación (no primera recompra ni excluidos).
export async function GET() {
  const { data, error } = await supabase
    .from('reactivation_clients')
    .select('is_control, status, responded, reserved, touch1_date')
    .eq('list_type', 'reactivacion');

  if (error) {
    console.error('reactivation stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const control = rows.filter((r) => r.is_control);
  const contacted = rows.filter((r) => !r.is_control);

  // "Reactivado" = volvió a reservar.
  const reactivated = (arr: typeof rows) => arr.filter((r) => r.reserved === true).length;
  const worked = (arr: typeof rows) => arr.filter((r) => r.touch1_date).length; // ya se tocó

  const contactedReact = reactivated(contacted);
  const controlReact = reactivated(control);
  const rate = (n: number, d: number) => (d > 0 ? n / d : 0);

  const contactedRate = rate(contactedReact, contacted.length);
  const controlRate = rate(controlReact, control.length);

  return NextResponse.json({
    total: rows.length,
    contacted: {
      count: contacted.length,
      worked: worked(contacted),
      reactivated: contactedReact,
      notReactivated: contacted.length - contactedReact,
      rate: contactedRate,
    },
    control: {
      count: control.length,
      reactivated: controlReact,
      rate: controlRate,
    },
    // El diferencial es el KPI real (uplift atribuible a la campaña).
    uplift: contactedRate - controlRate,
    pending: contacted.filter((r) => r.status === 'pendiente').length,
  });
}

export const dynamic = 'force-dynamic';
