import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { deriveStatus, type ReactChannel } from '@/lib/reactivation';

// GET /api/reactivation?list_type=reactivacion
// Devuelve la lista completa (o filtrada por tipo de lista).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const listType = searchParams.get('list_type');

  let query = supabase
    .from('reactivation_clients')
    .select('*')
    .order('days_inactive', { ascending: false, nullsFirst: false });

  if (listType) query = query.eq('list_type', listType);

  const { data, error } = await query;
  if (error) {
    console.error('reactivation GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ clients: data ?? [] });
}

// DELETE /api/reactivation?id=...  — borra una ficha (p.ej. filas de prueba)
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  const { error } = await supabase.from('reactivation_clients').delete().eq('id', id);
  if (error) {
    console.error('reactivation DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

const CHANNELS: ReactChannel[] = ['whatsapp', 'call'];

// PATCH /api/reactivation  { id, ...campos }
// Registra progreso de campaña con las reglas duras forzadas en servidor:
//  - Control: NO se le puede registrar ningún toque.
//  - No se puede marcar respondió/reservó sin fecha de 1er toque.
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    // Estado actual (para validar reglas contra lo que ya existe + lo que llega)
    const { data: current, error: curErr } = await supabase
      .from('reactivation_clients')
      .select('*')
      .eq('id', id)
      .single();
    if (curErr || !current) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    if (current.is_control) {
      return NextResponse.json(
        { error: 'Cliente en grupo de CONTROL: no se registran toques.' },
        { status: 409 }
      );
    }

    // Solo dejamos tocar estos campos de progreso.
    const patch: Record<string, unknown> = {};
    if ('touch1_date' in body) patch.touch1_date = body.touch1_date || null;
    if ('touch1_channel' in body) patch.touch1_channel = CHANNELS.includes(body.touch1_channel) ? body.touch1_channel : null;
    if ('touch2_date' in body) patch.touch2_date = body.touch2_date || null;
    if ('touch2_channel' in body) patch.touch2_channel = CHANNELS.includes(body.touch2_channel) ? body.touch2_channel : null;
    if ('responded' in body) patch.responded = body.responded;
    if ('reserved' in body) patch.reserved = body.reserved;
    if ('notes' in body) patch.notes = body.notes ?? null;
    if ('contact_name' in body) patch.contact_name = body.contact_name?.trim() || null;
    if ('brand' in body) patch.brand = body.brand?.trim() || null;
    if ('discount_pct' in body) {
      const d = Number(body.discount_pct);
      patch.discount_pct = Number.isFinite(d) ? Math.min(15, Math.max(0, Math.round(d))) : 10;
    }

    // Estado resultante tras aplicar el patch
    const merged = { ...current, ...patch };

    // Regla: no se puede marcar respondió/reservó sin fecha de 1er toque.
    const touchedT1 = merged.touch1_date;
    if ((merged.responded != null || merged.reserved != null) && !touchedT1) {
      return NextResponse.json(
        { error: 'Falta la fecha del 1er toque antes de marcar respondió/reservó.' },
        { status: 422 }
      );
    }
    // Regla: un toque sin fecha no es válido (canal sin fecha se limpia).
    if (patch.touch1_channel && !merged.touch1_date) {
      return NextResponse.json({ error: 'El 1er toque necesita fecha.' }, { status: 422 });
    }
    if (patch.touch2_channel && !merged.touch2_date) {
      return NextResponse.json({ error: 'El 2do toque necesita fecha.' }, { status: 422 });
    }

    patch.status = deriveStatus(merged);
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('reactivation_clients')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('reactivation PATCH error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ client: data });
  } catch (e) {
    console.error('reactivation PATCH exception:', e);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}
