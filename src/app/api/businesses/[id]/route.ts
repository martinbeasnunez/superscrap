import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ContactAction, LeadStatus } from '@/types';

const validContactActions: ContactAction[] = ['whatsapp', 'email', 'call'];
const validLeadStatuses: LeadStatus[] = ['no_contact', 'prospect', 'discarded'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { contact_actions, lead_status, user_id } = body;

    // Validar contact_actions (array de acciones)
    if (contact_actions !== undefined) {
      if (!Array.isArray(contact_actions)) {
        return NextResponse.json(
          { error: 'contact_actions debe ser un array' },
          { status: 400 }
        );
      }
      for (const action of contact_actions) {
        if (!validContactActions.includes(action)) {
          return NextResponse.json(
            { error: `Acción de contacto inválida: ${action}` },
            { status: 400 }
          );
        }
      }
    }

    // Validar lead_status
    if (lead_status !== undefined && lead_status !== null) {
      if (!validLeadStatuses.includes(lead_status)) {
        return NextResponse.json(
          { error: 'Estado de lead inválido' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (contact_actions !== undefined) {
      updateData.contact_actions = contact_actions;
      updateData.contacted_at = contact_actions.length > 0 ? new Date().toISOString() : null;
      updateData.contacted_by = contact_actions.length > 0 && user_id ? user_id : null;
    }

    if (lead_status !== undefined) {
      updateData.lead_status = lead_status;
    }

    console.log('Updating business:', id, 'with data:', updateData);

    const { data, error } = await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
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
