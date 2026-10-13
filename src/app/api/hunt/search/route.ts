import { NextRequest, NextResponse } from 'next/server';
import { searchLocalBusinesses } from '@/lib/serpapi';
import { scrapeWebsiteForContacts } from '@/lib/scraper';
import { calculatePotentialScore } from '@/lib/scoring';
import { districtOf, findInIndex, isMobilePhone, loadDedupIndex } from '@/lib/hunt';

export const maxDuration = 300;

// POST /api/hunt/search  { rubro, zona, pages? }
// El "cazador": corre UNA apuesta (rubro × zona) en Google Maps, descarta lo que ya está
// en ORBIT, puntúa con el motor de orcas y scrapea la web de las que pasan el corte.
// NO guarda nada: devuelve candidatos para que el calificador elija. Solo lo que el
// calificador apruebe entra a la base (POST /api/hunt/save).

const MAX_PAGES = 2;      // 20 resultados por página de SerpAPI
const SCRAPE_TOP = 12;    // a cuántas orcas se les scrapea la web
const SCRAPE_PARALLEL = 4;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rubro = String(body.rubro || '').trim();
    const zona = String(body.zona || '').trim();
    const pages = Math.min(MAX_PAGES, Math.max(1, Number(body.pages) || 1));
    if (!rubro || !zona) {
      return NextResponse.json({ error: 'Faltan rubro y zona' }, { status: 400 });
    }

    const results = [];
    for (let p = 0; p < pages; p++) {
      const page = await searchLocalBusinesses(rubro, zona, p * 20);
      results.push(...page);
      if (page.length < 20) break;
    }

    const index = await loadDedupIndex();
    const seen = new Set<string>();
    let duplicates = 0;

    const scored = [];
    for (const r of results) {
      const key = r.place_id || `${r.title}|${r.address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (findInIndex(index, { place_id: r.place_id, phone: r.phone, name: r.title, address: r.address })) {
        duplicates++;
        continue;
      }
      const potential = calculatePotentialScore({
        name: r.title,
        businessType: r.type || rubro,
        rating: r.rating || null,
        reviewsCount: r.reviews || null,
        address: r.address || null,
      });
      scored.push({
        place_id: r.place_id || null,
        name: r.title,
        type: r.type || null,
        address: r.address || null,
        distrito: districtOf(r.address),
        phone: r.phone || null,
        phoneIsMobile: isMobilePhone(r.phone),
        website: r.website || null,
        rating: r.rating ?? null,
        reviews: r.reviews ?? null,
        description: r.description || null,
        thumbnail: r.thumbnail || null,
        coordinates: r.gps_coordinates
          ? { lat: r.gps_coordinates.latitude, lng: r.gps_coordinates.longitude }
          : null,
        score: potential.score,
        tier: potential.tier,
        revMin: potential.revenue.min,
        revMax: potential.revenue.max,
        signals: potential.signals,
        emails: [] as string[],
        phones: [] as string[],
        websiteExcerpt: null as string | null,
      });
    }
    scored.sort((a, b) => b.score - a.score);

    // Web de las orcas: correos, teléfonos y un extracto para que el calificador juzgue.
    const toScrape = scored.filter((c) => c.tier === 'orca' && c.website).slice(0, SCRAPE_TOP);
    for (let i = 0; i < toScrape.length; i += SCRAPE_PARALLEL) {
      await Promise.all(
        toScrape.slice(i, i + SCRAPE_PARALLEL).map(async (c) => {
          try {
            const scraped = await scrapeWebsiteForContacts(c.website!);
            c.emails = scraped.emails;
            c.phones = scraped.phones;
            c.websiteExcerpt = scraped.content ? scraped.content.replace(/\s+/g, ' ').trim().slice(0, 900) : null;
          } catch {
            // web caída o bloqueada: el candidato sigue, sin extracto
          }
        }),
      );
    }

    const orcas = scored.filter((c) => c.tier === 'orca');
    // Los que no llegan a orca por el score automático (pocas reseñas, etc.). Van resumidos:
    // el calificador puede rescatar uno si tiene evidencia de tamaño real (revenue_override).
    const bajoCorte = scored.filter((c) => c.tier !== 'orca');

    return NextResponse.json({
      apuesta: { rubro, zona },
      stats: {
        found: results.length,
        duplicates,
        orcas: orcas.length,
        below_orca: bajoCorte.length,
      },
      candidatos: orcas,
      bajoCorte,
    });
  } catch (error) {
    console.error('Hunt search error:', error);
    return NextResponse.json({ error: 'Error al cazar' }, { status: 500 });
  }
}
