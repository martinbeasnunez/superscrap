import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Obtener búsqueda
    const { data: search, error: searchError } = await supabase
      .from('searches')
      .select('*')
      .eq('id', id)
      .single();

    if (searchError || !search) {
      return NextResponse.json(
        { error: 'Búsqueda no encontrada' },
        { status: 404 }
      );
    }

    // Obtener negocios con análisis
    const { data: businesses, error: businessesError } = await supabase
      .from('businesses')
      .select(
        `
        *,
        service_analyses (*)
      `
      )
      .eq('search_id', id)
      .order('rating', { ascending: false });

    if (businessesError) {
      console.error('Error fetching businesses:', businessesError);
      return NextResponse.json(
        { error: 'Error al obtener negocios' },
        { status: 500 }
      );
    }

    // Formatear respuesta
    const businessesWithAnalysis = businesses.map((b) => ({
      ...b,
      analysis: b.service_analyses?.[0] || null,
      service_analyses: undefined,
    }));

    // Ordenar por match_percentage (los que más coinciden primero)
    businessesWithAnalysis.sort((a, b) => {
      const matchA = a.analysis?.match_percentage || 0;
      const matchB = b.analysis?.match_percentage || 0;
      return matchB - matchA;
    });

    return NextResponse.json({
      search,
      businesses: businessesWithAnalysis,
    });
  } catch (error) {
    console.error('Search detail error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
