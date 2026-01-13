import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Endpoint temporal para asignar contactos huérfanos a un usuario
export async function POST() {
  try {
    // Buscar el usuario martin@getlavado.com
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('email', 'martin@getlavado.com')
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Actualizar todos los businesses con contact_status pero sin contacted_by
    const { data: updated, error: updateError } = await supabase
      .from('businesses')
      .update({ contacted_by: user.id })
      .not('contact_status', 'is', null)
      .is('contacted_by', null)
      .select('id, name, contact_status');

    if (updateError) {
      console.error('Error updating:', updateError);
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Se asignaron ${updated?.length || 0} contactos a ${user.name}`,
      updated: updated?.map(b => ({ name: b.name, status: b.contact_status })),
    });
  } catch (error) {
    console.error('Fix orphan contacts error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
