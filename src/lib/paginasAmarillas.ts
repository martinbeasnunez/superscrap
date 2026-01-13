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

// Parsear resultados de la búsqueda
function parseSearchResults(html: string): PaginasAmarillasResult[] {
  const results: PaginasAmarillasResult[] = [];

  // Buscar bloques de empresas usando regex
  // Cada empresa está en un div con clase específica
  const businessBlocks = html.match(/<article[^>]*class="[^"]*business[^"]*"[^>]*>[\s\S]*?<\/article>/gi) || [];

  // Si no encontramos con article, intentar con div
  const altBlocks = businessBlocks.length === 0
    ? html.match(/<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?(?=<div[^>]*class="[^"]*result|$)/gi) || []
    : businessBlocks;

  // Extraer datos de cada bloque usando patrones comunes
  const namePattern = /<h2[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/h2>/gi;
  const phonePattern = /(?:tel:|phone:|teléfono:|telefono:)?\s*(\+?51[\s.-]?\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3,4}|\d{3}[\s.-]?\d{3}[\s.-]?\d{3,4})/gi;
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const addressPattern = /(?:dirección|direccion|address):\s*([^<]+)/gi;
  const urlPattern = /href="(\/empresas\/[^"]+)"/gi;

  // Método alternativo: buscar elementos específicos en todo el HTML
  const allNames: string[] = [];
  const allPhones: string[] = [];
  const allEmails: string[] = [];
  const allUrls: string[] = [];

  // Extraer nombres de empresas
  let match;
  const h2Pattern = /<h2[^>]*>[\s\S]*?<a[^>]*href="(\/empresas\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
  while ((match = h2Pattern.exec(html)) !== null) {
    allUrls.push(match[1]);
    allNames.push(match[2].trim());
  }

  // Extraer teléfonos
  const phoneMatches = html.match(/(?:\d{3}[\s.-]?\d{3}[\s.-]?\d{3,4})/g) || [];
  allPhones.push(...phoneMatches);

  // Extraer emails
  const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const filteredEmails = emailMatches.filter(e =>
    !e.includes('paginasamarillas') &&
    !e.includes('example') &&
    !e.includes('sentry')
  );
  allEmails.push(...filteredEmails);

  // Extraer direcciones
  const addressMatches: string[] = [];
  const addrPattern = /<p[^>]*class="[^"]*address[^"]*"[^>]*>([^<]+)<\/p>/gi;
  while ((match = addrPattern.exec(html)) !== null) {
    addressMatches.push(match[1].trim());
  }

  // Combinar datos
  for (let i = 0; i < Math.min(allNames.length, 20); i++) {
    const result: PaginasAmarillasResult = {
      name: allNames[i] || '',
      phone: allPhones[i] || null,
      email: filteredEmails[i] || null,
      address: addressMatches[i] || null,
      description: null,
      website: null,
      category: null,
      profileUrl: allUrls[i] ? `${BASE_URL}${allUrls[i]}` : '',
    };

    if (result.name) {
      results.push(result);
    }
  }

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
