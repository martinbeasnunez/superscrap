import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/kapso';

export async function POST(request: NextRequest) {
  try {
    const { businessId, phone, message, isAutoFollowUp = false, userId } = await request.json();

    if (!businessId || !phone || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Send via Kapso
    const result = await sendWhatsAppMessage(phone, message);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send message' },
        { status: 500 }
      );
    }

    // Log to contact_history
    const actionType = isAutoFollowUp ? 'auto_whatsapp' : 'whatsapp';
    await supabase.from('contact_history').insert({
      business_id: businessId,
      user_id: userId || null,
      action_type: actionType,
      notes: message,
    });

    // Update business contact status
    const { data: business } = await supabase
      .from('businesses')
      .select('contact_actions, sales_stage')
      .eq('id', businessId)
      .single();

    const currentActions = business?.contact_actions || [];
    const isFirstContact = currentActions.length === 0;
    const newActions = currentActions.includes('whatsapp') ? currentActions : [...currentActions, 'whatsapp'];

    const updateData: Record<string, unknown> = {
      contact_actions: newActions,
      contacted_at: new Date().toISOString(),
    };

    if (isFirstContact && (!business?.sales_stage || business?.sales_stage === 'nuevo')) {
      updateData.sales_stage = 'contactado';
    }

    if (isAutoFollowUp) {
      updateData.auto_followup_last_sent = new Date().toISOString();
    }

    await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', businessId);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
