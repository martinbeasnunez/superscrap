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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Obtener IDs de negocios para esta búsqueda
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('search_id', id);

    const businessIds = businesses?.map(b => b.id) || [];

    // Eliminar análisis de servicios
    if (businessIds.length > 0) {
      await supabase
        .from('service_analyses')
        .delete()
        .in('business_id', businessIds);
    }

    // Eliminar negocios
    await supabase
      .from('businesses')
      .delete()
      .eq('search_id', id);

    // Eliminar búsqueda
    const { error } = await supabase
      .from('searches')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting search:', error);
      return NextResponse.json(
        { error: 'Error al eliminar búsqueda' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete search error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
