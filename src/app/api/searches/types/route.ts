import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Obtener todos los business_type únicos de las búsquedas
    const { data: searches, error } = await supabase
      .from('searches')
      .select('business_type, city')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching search types:', error);
      return NextResponse.json({ error: 'Error al obtener tipos' }, { status: 500 });
    }

    // Crear set de tipos buscados (normalizado a minúsculas para comparación)
    const searchedTypes = new Set<string>();
    const searchedCombinations = new Set<string>();

    searches?.forEach((s) => {
      const normalizedType = s.business_type.toLowerCase().trim();
      searchedTypes.add(normalizedType);
      searchedCombinations.add(`${normalizedType}|${s.city.toLowerCase().trim()}`);
    });

    return NextResponse.json({
      searchedTypes: Array.from(searchedTypes),
      searchedCombinations: Array.from(searchedCombinations),
      totalSearches: searches?.length || 0,
    });
  } catch (error) {
    console.error('Search types error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
