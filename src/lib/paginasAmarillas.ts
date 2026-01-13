// Scraper para Páginas Amarillas Perú - directorios industriales

export interface PaginasAmarillasResult {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  website: string | null;
  category: string | null;
  profileUrl: string;
}

export interface PaginasAmarillasSearchResult {
  results: PaginasAmarillasResult[];
  totalResults: number;
  page: number;
}

const BASE_URL = 'https://www.paginasamarillas.com.pe';

// Scraper de Páginas Amarillas
export async function searchPaginasAmarillas(
  query: string,
  city: string = '',
  page: number = 1
): Promise<PaginasAmarillasSearchResult> {
  try {
    // Construir URL de búsqueda
    const searchQuery = city ? `${query} ${city}` : query;
    const encodedQuery = encodeURIComponent(searchQuery.toLowerCase().replace(/\s+/g, '-'));
    const url = page === 1
      ? `${BASE_URL}/servicios/${encodedQuery}`
      : `${BASE_URL}/servicios/${encodedQuery}/${page}`;

    console.log('Searching Paginas Amarillas:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Paginas Amarillas response not ok:', response.status);
      return { results: [], totalResults: 0, page };
    }

    const html = await response.text();

    // Parsear resultados del HTML
    const results = parseSearchResults(html);
    const totalResults = parseTotalResults(html);

    return {
      results,
      totalResults,
      page,
    };
  } catch (error) {
    console.error('Error searching Paginas Amarillas:', error);
    return { results: [], totalResults: 0, page };
  }
}

// Parsear resultados de la búsqueda - extrae datos de JSON-LD (schema.org)
function parseSearchResults(html: string): PaginasAmarillasResult[] {
  const results: PaginasAmarillasResult[] = [];

  // Extraer todos los bloques JSON-LD de tipo LocalBusiness
  const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdPattern.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);

      // Solo procesar LocalBusiness
      if (jsonData['@type'] === 'LocalBusiness' && jsonData.name) {
        const result: PaginasAmarillasResult = {
          name: jsonData.name || '',
          phone: jsonData.telephone || null,
          email: jsonData.email || null,
          address: jsonData.address || null,
          description: jsonData.description ? jsonData.description.substring(0, 500) : null,
          website: null,
          category: null,
          profileUrl: jsonData.url || '',
        };

        // Filtrar emails inválidos
        if (result.email && (
          result.email.includes('paginasamarillas') ||
          result.email.includes('example') ||
          result.email.includes('sentry')
        )) {
          result.email = null;
        }

        if (result.name) {
          results.push(result);
        }
      }
    } catch {
      // Ignorar JSON inválido
    }
  }

  console.log(`Parsed ${results.length} results from JSON-LD`);
  return results;
}

// Obtener total de resultados
function parseTotalResults(html: string): number {
  // Buscar patrón como "1,561 resultados"
  const match = html.match(/(\d+[,.]?\d*)\s*resultados/i);
  if (match) {
    return parseInt(match[1].replace(/[,.]/, ''), 10);
  }
  return 0;
}

// Obtener detalles de una empresa específica
export async function getBusinessDetails(profileUrl: string): Promise<PaginasAmarillasResult | null> {
  try {
    const url = profileUrl.startsWith('http') ? profileUrl : `${BASE_URL}${profileUrl}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Extraer datos del perfil
    const name = extractFromHtml(html, /<h1[^>]*>([^<]+)<\/h1>/i);
    const phone = extractFromHtml(html, /(?:tel:|teléfono:)\s*(\+?51[\s.-]?\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3,4}|\d{3}[\s.-]?\d{3}[\s.-]?\d{3,4})/i);
    const email = extractFromHtml(html, /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const address = extractFromHtml(html, /(?:dirección|direccion):\s*([^<]+)/i);
    const website = extractFromHtml(html, /href="(https?:\/\/(?!www\.paginasamarillas)[^"]+)"/i);
    const description = extractFromHtml(html, /<meta[^>]*name="description"[^>]*content="([^"]+)"/i);

    // Verificar email válido
    const validEmail = email &&
      !email.includes('paginasamarillas') &&
      !email.includes('example') ? email : null;

    return {
      name: name || '',
      phone,
      email: validEmail,
      address,
      description,
      website,
      category: null,
      profileUrl: url,
    };
  } catch (error) {
    console.error('Error getting business details:', error);
    return null;
  }
}

function extractFromHtml(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

// Búsqueda con scraping de detalles
export async function searchWithDetails(
  query: string,
  city: string = '',
  maxResults: number = 20
): Promise<PaginasAmarillasResult[]> {
  const searchResult = await searchPaginasAmarillas(query, city);
  const results: PaginasAmarillasResult[] = [];

  for (const item of searchResult.results.slice(0, maxResults)) {
    if (item.profileUrl) {
      // Obtener detalles completos
      const details = await getBusinessDetails(item.profileUrl);
      if (details) {
        results.push({
          ...item,
          ...details,
          name: details.name || item.name,
        });
      } else {
        results.push(item);
      }

      // Pequeña pausa para no saturar el servidor
      await new Promise(r => setTimeout(r, 500));
    } else {
      results.push(item);
    }
  }

  return results;
}
