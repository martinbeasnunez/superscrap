import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { searchLocalBusinesses } from '@/lib/serpapi';
import { analyzeBusinessServices } from '@/lib/openai';
import { scrapeWebsiteDeep, searchKeywordsInContent } from '@/lib/scraper';

// Distritos prioritarios de Lima
const PRIORITY_DISTRICTS = [
  'miraflores',
  'san isidro',
  'surco',
  'santiago de surco',
  'barranco',
  'san borja',
  'san miguel',
];

function getDistrictPriority(address: string | null): number {
  if (!address) return 99;
  const lowerAddress = address.toLowerCase();

  for (let i = 0; i < PRIORITY_DISTRICTS.length; i++) {
    if (lowerAddress.includes(PRIORITY_DISTRICTS[i])) {
      return i;
    }
  }
  return 99;
}

// Función mejorada para comparar servicios
function countMatchingServices(
  detectedServices: string[],
  requiredServices: string[]
): number {
  let count = 0;
  const detected = detectedServices.map((s) => s.toLowerCase());

  for (const required of requiredServices) {
    const reqLower = required.toLowerCase();
    const found = detected.some(
      (d) =>
        d.includes(reqLower) ||
        reqLower.includes(d) ||
        (reqLower === 'spa' && (d.includes('bienestar') || d.includes('relax'))) ||
        (reqLower === 'sauna' && d.includes('vapor')) ||
        (reqLower === 'masajes' && (d.includes('masaje') || d.includes('massage'))) ||
        (reqLower.includes('entrenamiento') && (d.includes('personal') || d.includes('trainer') || d.includes('coaching'))) ||
        (reqLower === 'toallas' && (d.includes('toalla') || d.includes('towel') || d.includes('amenities')))
    );
    if (found) count++;
  }
  return count;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessType, city, requiredServices } = body;

    if (!businessType || !city || !requiredServices?.length) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }

    // 1. Crear registro de búsqueda
    const { data: search, error: searchError } = await supabase
      .from('searches')
      .insert({
        business_type: businessType,
        city,
        required_services: requiredServices,
        status: 'processing',
      })
      .select()
      .single();

    if (searchError) {
      console.error('Error creating search:', searchError);
      return NextResponse.json(
        { error: 'Error al crear búsqueda' },
        { status: 500 }
      );
    }

    // 2. Buscar negocios con SerpAPI
    let localResults;
    try {
      localResults = await searchLocalBusinesses(businessType, city);
      console.log(`SerpAPI returned ${localResults.length} results`);
    } catch (error) {
      console.error('SerpAPI error:', error);
      await supabase
        .from('searches')
        .update({ status: 'failed' })
        .eq('id', search.id);
      return NextResponse.json(
        { error: 'Error al buscar negocios' },
        { status: 500 }
      );
    }

    if (!localResults.length) {
      await supabase
        .from('searches')
        .update({
          status: 'completed',
          total_results: 0,
          matching_results: 0,
          completed_at: new Date().toISOString(),
        })
        .eq('id', search.id);

      return NextResponse.json({
        searchId: search.id,
        message: 'No se encontraron negocios',
        totalResults: 0,
        matchingResults: 0,
      });
    }

    // Ordenar por distrito prioritario
    localResults.sort((a, b) => {
      return getDistrictPriority(a.address) - getDistrictPriority(b.address);
    });

    // 3. Guardar negocios y analizar
    let matchingCount = 0;
    let savedCount = 0;

    for (const result of localResults) {
      // Intentar scraping del sitio web para más contexto
      let websiteContent: string | null = null;
      let websiteKeywordMatches: { service: string; found: boolean; keywords: string[] }[] = [];

      if (result.website) {
        try {
          websiteContent = await scrapeWebsiteDeep(result.website);
          if (websiteContent) {
            websiteKeywordMatches = searchKeywordsInContent(websiteContent, requiredServices);
            console.log(`Website scrape for ${result.title}:`, websiteKeywordMatches.filter(m => m.found));
          }
        } catch (error) {
          console.error(`Error scraping ${result.website}:`, error);
        }
      }

      // Servicios encontrados directamente en el sitio web
      const servicesFoundInWebsite = websiteKeywordMatches
        .filter(m => m.found)
        .map(m => m.service);

      // Preparar contexto enriquecido para OpenAI
      const enrichedDescription = [
        result.description || '',
        websiteContent ? `\n\nContenido del sitio web: ${websiteContent.substring(0, 500)}` : '',
        servicesFoundInWebsite.length > 0
          ? `\n\nServicios encontrados en su web: ${servicesFoundInWebsite.join(', ')}`
          : '',
      ].join('');

      // Analizar con OpenAI
      let analysis;
      try {
        analysis = await analyzeBusinessServices(
          result.title,
          enrichedDescription,
          result.type,
          requiredServices
        );

        // Agregar servicios encontrados en web que OpenAI no detectó
        for (const webService of servicesFoundInWebsite) {
          const alreadyDetected = analysis.detected_services.some(
            ds => ds.toLowerCase().includes(webService.toLowerCase()) ||
                  webService.toLowerCase().includes(ds.toLowerCase())
          );
          if (!alreadyDetected) {
            analysis.detected_services.push(webService);
            analysis.evidence += ` [${webService} encontrado en sitio web]`;
          }
        }

        console.log(`Analysis for ${result.title}:`, analysis.detected_services);
      } catch (error) {
        console.error('OpenAI analysis error:', error);
        // Si falla OpenAI, usar al menos los servicios del scraping
        analysis = {
          detected_services: servicesFoundInWebsite,
          confidence: servicesFoundInWebsite.length > 0 ? 0.7 : 0,
          evidence: servicesFoundInWebsite.length > 0
            ? `Servicios encontrados en sitio web: ${servicesFoundInWebsite.join(', ')}`
            : 'No se pudo analizar',
        };
      }

      const matchCount = countMatchingServices(
        analysis.detected_services,
        requiredServices
      );
      const matchPercentage = matchCount / requiredServices.length;
      const matchesRequirements = matchPercentage >= 0.5;

      // Guardar negocio
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert({
          search_id: search.id,
          external_id: result.place_id,
          name: result.title,
          address: result.address,
          phone: result.phone,
          rating: result.rating,
          reviews_count: result.reviews,
          description: result.description,
          website: result.website,
          thumbnail_url: result.thumbnail,
          coordinates: result.gps_coordinates
            ? {
                lat: result.gps_coordinates.latitude,
                lng: result.gps_coordinates.longitude,
              }
            : null,
        })
        .select()
        .single();

      if (businessError) {
        console.error('Error inserting business:', businessError);
        continue;
      }

      savedCount++;

      if (matchesRequirements) {
        matchingCount++;
      }

      await supabase.from('service_analyses').insert({
        business_id: business.id,
        detected_services: analysis.detected_services,
        confidence_score: analysis.confidence,
        evidence: analysis.evidence,
        matches_requirements: matchesRequirements,
        match_percentage: matchPercentage,
      });

      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 300));
    }

    // 4. Actualizar búsqueda con resultados
    await supabase
      .from('searches')
      .update({
        status: 'completed',
        total_results: savedCount,
        matching_results: matchingCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', search.id);

    return NextResponse.json({
      searchId: search.id,
      message: 'Búsqueda completada',
      totalResults: savedCount,
      matchingResults: matchingCount,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
