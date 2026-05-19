import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ContactAction, LeadStatus, SalesStage } from '@/types';
import { sendWhatsAppMessage, sendWhatsAppTemplate } from '@/lib/kapso';

const validContactActions: ContactAction[] = ['whatsapp', 'email', 'call'];
const validLeadStatuses: LeadStatus[] = ['no_contact', 'prospect', 'discarded'];
const validSalesStages: SalesStage[] = ['nuevo', 'contactado', 'seguimiento_1', 'seguimiento_2', 'seguimiento_3', 'interesado', 'cotizado', 'cliente', 'perdido'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      contact_actions, lead_status, sales_stage, user_id, previous_stage,
      primary_dm_index, auto_followup_enabled, last_email_template_id,
      skip_auto_send, notes, source, lead_channel, lost_reason, is_focus,
    } = body;

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

    // Validar sales_stage
    if (sales_stage !== undefined && sales_stage !== null) {
      if (!validSalesStages.includes(sales_stage)) {
        return NextResponse.json(
          { error: 'Etapa de venta inválida' },
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

    if (sales_stage !== undefined) {
      updateData.sales_stage = sales_stage;
    }

    // v2 fields
    if (primary_dm_index !== undefined) {
      updateData.primary_dm_index = primary_dm_index;
    }
    if (auto_followup_enabled !== undefined) {
      updateData.auto_followup_enabled = auto_followup_enabled;
    }
    if (last_email_template_id !== undefined) {
      updateData.last_email_template_id = last_email_template_id;
    }
    if (notes !== undefined) {
      // Trim trailing whitespace, allow empty string to clear the field
      updateData.notes = typeof notes === 'string' ? notes.trim() || null : null;
    }
    if (source !== undefined) {
      if (source !== 'auto' && source !== 'manual') {
        return NextResponse.json({ error: 'source debe ser auto o manual' }, { status: 400 });
      }
      updateData.source = source;
    }
    if (lead_channel !== undefined) {
      const validChannels = [
        'comercial', 'google_seo', 'google_sem', 'laundryheap',
        'getlavado_b2c', 'getlavado_b2b', 'referido',
        'linkedin', 'eventos', 'otro',
      ] as const;
      if (lead_channel !== null && !validChannels.includes(lead_channel)) {
        return NextResponse.json({ error: 'lead_channel inválido' }, { status: 400 });
      }
      updateData.lead_channel = lead_channel;
    }
    if (lost_reason !== undefined) {
      const validReasons = [
        'precio', 'lavado_interno', 'tiene_proveedor', 'mal_timing',
        'no_interesado', 'no_contesta', 'no_decisor', 'otro',
      ] as const;
      if (lost_reason !== null && !validReasons.includes(lost_reason)) {
        return NextResponse.json({ error: 'lost_reason inválido' }, { status: 400 });
      }
      updateData.lost_reason = lost_reason;
    }
    if (is_focus !== undefined) {
      updateData.is_focus = !!is_focus;
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

    // Registrar cambio de stage en contact_history si hay previous_stage
    console.log('Stage change check:', { sales_stage, previous_stage, shouldRecord: sales_stage && previous_stage && sales_stage !== previous_stage });

    if (sales_stage && previous_stage && sales_stage !== previous_stage) {
      const stageNames: Record<string, string> = {
        'nuevo': 'Nuevos',
        'contactado': 'Contactado',
        'seguimiento_1': 'Seguimiento 1',
        'seguimiento_2': 'Seguimiento 2',
        'seguimiento_3': 'Último Intento',
        'interesado': 'Interesado',
        'cotizado': 'Cotizado',
        'cliente': 'Cliente',
        'perdido': 'Perdido'
      };

      const historyEntry = {
        business_id: id,
        action_type: 'stage_change',
        notes: `📋 Cambio de etapa: ${stageNames[previous_stage] || previous_stage} → ${stageNames[sales_stage] || sales_stage}`,
        created_at: new Date().toISOString(),
      };

      console.log('Inserting stage change history:', historyEntry);

      const { error: historyError } = await supabase.from('contact_history').insert(historyEntry);

      if (historyError) {
        console.error('Error inserting stage history:', historyError);
      } else {
        console.log('Stage history inserted successfully');
      }

      // Auto-send WhatsApp when moving to follow-up stages (skip if cron already sent)
      const autoSendStages = ['contactado', 'seguimiento_1', 'seguimiento_2', 'seguimiento_3', 'interesado', 'cotizado'];
      if (autoSendStages.includes(sales_stage) && data.phone && !skip_auto_send) {
        try {
          const { getWhatsAppPitchServer } = await import('@/lib/whatsapp-pitch');
          const contactCount = await supabase
            .from('contact_history')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', id)
            .in('action_type', ['whatsapp', 'auto_whatsapp', 'call', 'ai_call', 'email']);
          const count = contactCount.count || 0;
          const pitch = getWhatsAppPitchServer(data.name, data.business_type, sales_stage, count);
          // Try text first, fall back to template if outside 24h window
          let result = await sendWhatsAppMessage(data.phone, pitch);
          if (!result.success && (result.error?.includes('24-hour') || result.error?.includes('Re-engagement'))) {
            result = await sendWhatsAppTemplate(data.phone, data.name, sales_stage, data.address);
          }
          if (result.success) {
            await supabase.from('contact_history').insert({
              business_id: id,
              action_type: 'auto_whatsapp',
              notes: pitch,
            });
            // Update contact tracking
            const currentActions = data.contact_actions || [];
            const newActions = currentActions.includes('whatsapp') ? currentActions : [...currentActions, 'whatsapp'];
            await supabase.from('businesses').update({
              contact_actions: newActions,
              contacted_at: new Date().toISOString(),
            }).eq('id', id);
            console.log(`Auto-sent WhatsApp for stage change to ${sales_stage}`);
          } else {
            console.error('Auto WhatsApp send failed:', result.error);
          }
        } catch (err) {
          console.error('Auto WhatsApp error:', err);
        }
      }
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
