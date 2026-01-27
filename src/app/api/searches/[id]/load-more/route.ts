import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { searchLocalBusinesses } from '@/lib/serpapi';
import { analyzeBusinessServices } from '@/lib/openai';
import { scrapeWebsiteForContacts, searchKeywordsInContent } from '@/lib/scraper';

/* eslint-disable @typescript-eslint/no-explicit-any */

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Obtener la búsqueda existente
    const { data: search, error: searchError } = await supabase
      .from('searches')
      .select('*')
      .eq('id', id)
      .single();

    if (searchError || !search) {
      return NextResponse.json({ error: 'Búsqueda no encontrada' }, { status: 404 });
    }

    // 2. Contar negocios actuales para saber el offset
    const { count: currentCount } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('search_id', id);

    const startOffset = currentCount || 0;

    // 3. Buscar más negocios con paginación
    const newResults = await searchLocalBusinesses(
      search.business_type,
      search.city,
      startOffset
    );

    if (newResults.length === 0) {
      return NextResponse.json({
        message: 'No se encontraron más negocios',
        added: 0,
        total: currentCount,
      });
    }

    // 4. Obtener IDs existentes para evitar duplicados
    const { data: existingBusinesses } = await supabase
      .from('businesses')
      .select('external_id')
      .eq('search_id', id);

    const existingIds = new Set(existingBusinesses?.map((b) => b.external_id) || []);

    // Filtrar duplicados
    const uniqueResults = newResults.filter(
      (r) => !existingIds.has(r.place_id)
    );

    if (uniqueResults.length === 0) {
      return NextResponse.json({
        message: 'Todos los negocios encontrados ya existen',
        added: 0,
        total: currentCount,
      });
    }

    const requiredServices = search.required_services || [];
    let savedCount = 0;
    let matchingCount = 0;

    // 5. Procesar y guardar nuevos negocios
    for (const result of uniqueResults) {
      // Scraping del sitio web
      let websiteContent: string | null = null;
      let websiteKeywordMatches: { service: string; found: boolean; keywords: string[] }[] = [];
      let scrapedEmails: string[] = [];
      let scrapedPhones: string[] = [];

      if (result.website) {
        try {
          const scrapedData = await scrapeWebsiteForContacts(result.website);
          websiteContent = scrapedData.content;
          scrapedEmails = scrapedData.emails;
          scrapedPhones = scrapedData.phones;

          if (websiteContent) {
            websiteKeywordMatches = searchKeywordsInContent(websiteContent, requiredServices);
          }
        } catch (error) {
          console.error(`Error scraping ${result.website}:`, error);
        }
      }

      const servicesFoundInWebsite = websiteKeywordMatches
        .filter((m) => m.found)
        .map((m) => m.service);

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
          result.type || null,
          requiredServices
        );

        for (const webService of servicesFoundInWebsite) {
          const alreadyDetected = analysis.detected_services.some(
            (ds) =>
              ds.toLowerCase().includes(webService.toLowerCase()) ||
              webService.toLowerCase().includes(ds.toLowerCase())
          );
          if (!alreadyDetected) {
            analysis.detected_services.push(webService);
            analysis.evidence += ` [${webService} encontrado en sitio web]`;
          }
        }
      } catch (error) {
        console.error('OpenAI analysis error:', error);
        analysis = {
          detected_services: servicesFoundInWebsite,
          confidence: servicesFoundInWebsite.length > 0 ? 0.7 : 0,
          evidence:
            servicesFoundInWebsite.length > 0
              ? `Servicios encontrados en sitio web: ${servicesFoundInWebsite.join(', ')}`
              : 'No se pudo analizar',
        };
      }

      // Calcular match
      let matchPercentage: number;
      let matchesRequirements: boolean;

      if (requiredServices.length > 0) {
        const matchCount = countMatchingServices(analysis.detected_services, requiredServices);
        matchPercentage = matchCount / requiredServices.length;
        matchesRequirements = matchPercentage >= 0.5;
      } else {
        matchPercentage = analysis.detected_services.length > 0 ? analysis.confidence : 0;
        matchesRequirements = analysis.detected_services.length > 0 && analysis.confidence >= 0.4;
      }

      // Decision makers
      let decisionMakers = null;
      if (scrapedEmails.length > 0) {
        decisionMakers = scrapedEmails.map((email, idx) => ({
          email,
          firstName: null,
          lastName: null,
          fullName: null,
          position: null,
          seniority: null,
          department: null,
          confidence: 80,
          linkedin: null,
          phone: scrapedPhones[idx] || null,
        }));
      } else if (scrapedPhones.length > 0) {
        decisionMakers = scrapedPhones.map((phone) => ({
          email: null,
          firstName: null,
          lastName: null,
          fullName: null,
          position: null,
          seniority: null,
          department: null,
          confidence: 70,
          linkedin: null,
          phone,
        }));
      }

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
          decision_makers: decisionMakers,
          business_type: result.type || null,
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

      // Small delay
      await new Promise((r) => setTimeout(r, 300));
    }

    // 6. Actualizar totales de la búsqueda
    const newTotal = (search.total_results || 0) + savedCount;
    const newMatching = (search.matching_results || 0) + matchingCount;

    await supabase
      .from('searches')
      .update({
        total_results: newTotal,
        matching_results: newMatching,
      })
      .eq('id', id);

    return NextResponse.json({
      message: `Se agregaron ${savedCount} negocios nuevos`,
      added: savedCount,
      matching: matchingCount,
      total: newTotal,
      loadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Load more error:', error);
    return NextResponse.json({ error: 'Error al cargar más resultados' }, { status: 500 });
  }
}
