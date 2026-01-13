import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { contact_status } = body;

    // Validar status
    const validStatuses = ['whatsapp', 'called', 'contacted', null];
    if (!validStatuses.includes(contact_status)) {
      return NextResponse.json(
        { error: 'Estado de contacto inválido' },
        { status: 400 }
      );
    }

    const updateData: { contact_status: string | null; contacted_at: string | null } = {
      contact_status,
      contacted_at: contact_status ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating business:', error);
      return NextResponse.json(
        { error: 'Error al actualizar negocio' },
        { status: 500 }
      );
    }

    return NextResponse.json({ business: data });
  } catch (error) {
    console.error('Business update error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
