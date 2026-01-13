import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Obtener búsquedas con el nombre del usuario que las creó
    const { data: searches, error } = await supabase
      .from('searches')
      .select(`
        *,
        users (
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching searches:', error);
      return NextResponse.json(
        { error: 'Error al obtener búsquedas' },
        { status: 500 }
      );
    }

    // Formatear para incluir created_by
    const formattedSearches = searches?.map(search => ({
      ...search,
      created_by: search.users?.name || 'Usuario desconocido',
      created_by_email: search.users?.email || null,
    }));

    return NextResponse.json({ searches: formattedSearches });
  } catch (error) {
    console.error('Searches error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
