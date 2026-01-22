import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST - Registrar nueva acción de contacto
export async function POST(request: Request) {
  try {
    const { businessId, userId, actionType, notes } = await request.json();

    if (!businessId || !actionType) {
      return NextResponse.json(
        { error: 'businessId y actionType son requeridos' },
        { status: 400 }
      );
    }

    // Insertar en historial
    const { data: historyEntry, error: historyError } = await supabase
      .from('contact_history')
      .insert({
        business_id: businessId,
        user_id: userId || null,
        action_type: actionType,
        notes: notes || null,
      })
      .select()
      .single();

    if (historyError) {
      console.error('Error inserting contact history:', historyError);
      return NextResponse.json(
        { error: 'Error al registrar contacto' },
        { status: 500 }
      );
    }

    // Actualizar contact_actions en business (agregar si no existe)
    const { data: business } = await supabase
      .from('businesses')
      .select('contact_actions')
      .eq('id', businessId)
      .single();

    const currentActions = business?.contact_actions || [];
    if (!currentActions.includes(actionType)) {
      await supabase
        .from('businesses')
        .update({
          contact_actions: [...currentActions, actionType],
          contacted_at: new Date().toISOString(),
          contacted_by: userId || null,
        })
        .eq('id', businessId);
    }

    return NextResponse.json({ success: true, entry: historyEntry });
  } catch (error) {
    console.error('Contact history error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET - Obtener historial de un negocio
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { error: 'businessId es requerido' },
        { status: 400 }
      );
    }

    const { data: history, error } = await supabase
      .from('contact_history')
      .select(`
        *,
        users (
          name
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contact history:', error);
      return NextResponse.json(
        { error: 'Error al obtener historial' },
        { status: 500 }
      );
    }

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Contact history error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
