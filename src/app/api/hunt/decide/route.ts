import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isMobilePhone, type HuntDecision } from '@/lib/hunt';

// POST /api/hunt/decide  { huntLeadId, decision, userId, reason?, contact? }
// La decisión por lead de la caza:
//  - humano     → el lead queda a nombre de quien lo toma; el bot NO le escribe.
//                 Con `contact` ({ channel, message }) además registra ese primer contacto
//                 en el historial y mueve el lead a 'contactado': un clic = hecho y anotado.
//  - bot        → se enciende el auto-followup: el cron (número ORBIT/Kapso) hace el primer
//                 contacto y la escalera de seguimientos. Solo celulares.
//  - descartado → no se trabaja; el motivo queda para que el estratega aprenda.

const DECISIONS: HuntDecision[] = ['humano', 'bot', 'descartado'];

// Canal del primer contacto → action_type del historial + etiqueta en la nota.
// "WhatsApp personal" es la marca que usa el parte para distinguirlo del número ORBIT.
const CONTACT_CHANNELS: Record<string, { actionType: string; tag: string }> = {
  whatsapp: { actionType: 'whatsapp', tag: '[WhatsApp personal]' },
  email: { actionType: 'email', tag: '[Correo]' },
  call: { actionType: 'call', tag: '[Llamada]' },
};

export async function POST(request: NextRequest) {
  try {
    const { huntLeadId, decision, userId, reason, contact } = await request.json();
    const channel = decision === 'humano' && contact?.channel ? CONTACT_CHANNELS[contact.channel] : null;

    if (!huntLeadId || !DECISIONS.includes(decision)) {
      return NextResponse.json({ error: 'Faltan huntLeadId o una decisión válida' }, { status: 400 });
    }
    if (decision === 'humano' && !userId) {
      return NextResponse.json({ error: 'Falta el usuario que toma el lead' }, { status: 400 });
    }

    const { data: huntLead, error } = await supabase
      .from('hunt_leads')
      .select('id, business_id, origin, angle, businesses ( phone, next_action, sales_stage, contact_actions )')
      .eq('id', huntLeadId)
      .maybeSingle();
    if (error || !huntLead) {
      return NextResponse.json({ error: 'Lead de caza no encontrado' }, { status: 404 });
    }
    const biz = (Array.isArray(huntLead.businesses) ? huntLead.businesses[0] : huntLead.businesses) as
      | { phone: string | null; next_action: string | null; sales_stage: string | null; contact_actions: string[] | null }
      | null;

    if (decision === 'bot' && !isMobilePhone(biz?.phone)) {
      return NextResponse.json(
        { error: 'El bot solo puede escribir a celulares; este lead tiene fijo o no tiene teléfono.' },
        { status: 422 },
      );
    }

    let bizUpdate: Record<string, unknown>;
    if (decision === 'humano') {
      bizUpdate = { contacted_by: userId, auto_followup_enabled: false };
      if (channel) {
        // Primer contacto hecho: queda anotado y el lead avanza (solo si seguía en 'nuevo').
        const actions = biz?.contact_actions || [];
        bizUpdate.contacted_at = new Date().toISOString();
        bizUpdate.contact_actions = actions.includes(channel.actionType) ? actions : [...actions, channel.actionType];
        if (!biz?.sales_stage || biz.sales_stage === 'nuevo') bizUpdate.sales_stage = 'contactado';
      } else if (!biz?.next_action && huntLead.angle) {
        // Guardado para después: deja el ángulo como "próxima acción" si aún no hay una.
        bizUpdate.next_action = `→ Primer contacto: ${huntLead.angle}`.slice(0, 280);
      }
    } else if (decision === 'bot') {
      bizUpdate = { contacted_by: null, auto_followup_enabled: true };
    } else {
      bizUpdate = { auto_followup_enabled: false };
      // Un lead recién cazado y descartado sale del pipeline; un rescate conserva su estado.
      if (huntLead.origin === 'nuevo') {
        bizUpdate.sales_stage = 'perdido';
        bizUpdate.lost_reason = 'otro';
      }
    }

    const { error: bizError } = await supabase.from('businesses').update(bizUpdate).eq('id', huntLead.business_id);
    if (bizError) throw bizError;

    if (channel) {
      const text = String(contact.message || '').trim();
      const { error: histError } = await supabase.from('contact_history').insert({
        business_id: huntLead.business_id,
        user_id: userId,
        action_type: channel.actionType,
        notes: `${channel.tag} ${text || 'Primer contacto (caza del día)'}`.slice(0, 2000),
      });
      if (histError) throw histError;
    }

    const { error: huntError } = await supabase
      .from('hunt_leads')
      .update({
        decision,
        decided_by: userId || null,
        decided_at: new Date().toISOString(),
        discard_reason: decision === 'descartado' ? (reason ? String(reason).slice(0, 280) : null) : null,
      })
      .eq('id', huntLeadId);
    if (huntError) throw huntError;

    return NextResponse.json({ ok: true, decision });
  } catch (error) {
    console.error('Hunt decide error:', error);
    return NextResponse.json({ error: 'Error al registrar la decisión' }, { status: 500 });
  }
}
