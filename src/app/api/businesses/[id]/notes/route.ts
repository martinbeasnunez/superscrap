import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Each call creates a NEW timestamped note in contact_history.
// Notes are never edited — Alejandro stacks observations chronologically.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { content, user_id } = await request.json();

    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'Nota vacía' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contact_history')
      .insert({
        business_id: id,
        action_type: 'note',
        notes: text,
        user_id: user_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating note:', error);
      return NextResponse.json({ error: 'No se pudo guardar la nota' }, { status: 500 });
    }

    return NextResponse.json({ note: data });
  } catch (error) {
    console.error('Note create error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
