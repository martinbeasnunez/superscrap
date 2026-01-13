import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: searches, error } = await supabase
      .from('searches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching searches:', error);
      return NextResponse.json(
        { error: 'Error al obtener búsquedas' },
        { status: 500 }
      );
    }

    return NextResponse.json({ searches });
  } catch (error) {
    console.error('Searches error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
