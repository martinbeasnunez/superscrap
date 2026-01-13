// Scraper mejorado para extraer texto de sitios web
export async function scrapeWebsite(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

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
      return null;
    }

    const html = await response.text();

    // Extraer texto más inteligentemente
    let textContent = html
      // Remover scripts y styles
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      // Convertir algunos tags a espacios para mejor legibilidad
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      // Remover todos los otros tags
      .replace(/<[^>]+>/g, ' ')
      // Decodificar entidades HTML comunes
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Limpiar espacios
      .replace(/\s+/g, ' ')
      .trim();

    // Aumentar límite para capturar más contenido relevante
    return textContent.substring(0, 4000);
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

// Buscar menciones específicas de servicios en el contenido con contexto
export function findServiceMentions(
  content: string,
  services: string[]
): { service: string; found: boolean; context: string }[] {
  const contentLower = content.toLowerCase();
  const results: { service: string; found: boolean; context: string }[] = [];

  for (const service of services) {
    const serviceLower = service.toLowerCase();
    const keywords = SERVICE_KEYWORDS[serviceLower] || [serviceLower];
    let found = false;
    let context = '';

    for (const keyword of keywords) {
      const index = contentLower.indexOf(keyword.toLowerCase());
      if (index !== -1) {
        found = true;
        const start = Math.max(0, index - 100);
        const end = Math.min(content.length, index + keyword.length + 100);
        context = content.substring(start, end).trim();
        break;
      }
    }

    results.push({ service, found, context: found ? `...${context}...` : '' });
  }

  return results;
}

// Palabras clave expandidas para cada servicio
export const SERVICE_KEYWORDS: Record<string, string[]> = {
  // Ropa de cama y hospedaje
  'ropa de cama': [
    'ropa de cama', 'sábanas', 'sabanas', 'frazadas', 'cobijas', 'mantas',
    'almohadas', 'edredón', 'edredon', 'colchón', 'colchon', 'blankets',
    'bed linen', 'bedding', 'sheets', 'bungalow', 'hospedaje', 'alojamiento',
    'habitación', 'habitacion', 'cabaña', 'cabana', 'dormitorio'
  ],
  // Toallas
  toallas: [
    'toalla', 'toallas', 'towel', 'towels', 'amenities', 'servicio de toallas',
    'toallas incluidas', 'toallas gratis', 'toallas de baño', 'toallas de piscina'
  ],
  // Sauna
  sauna: [
    'sauna', 'vapor', 'steam room', 'baño turco', 'baño de vapor',
    'finnish sauna', 'sauna seco', 'sauna húmedo'
  ],
  // Spa y bienestar
  spa: [
    'spa', 'wellness', 'bienestar', 'relajación', 'relajacion', 'tratamientos',
    'centro de bienestar', 'área spa', 'zona spa', 'day spa'
  ],
  // Masajes
  masajes: [
    'masaje', 'masajes', 'massage', 'masoterapia', 'terapia manual',
    'quiromasaje', 'masaje relajante', 'masaje deportivo', 'reflexología'
  ],
  // Entrenamiento
  'entrenamiento personalizado': [
    'personal trainer', 'entrenador personal', 'entrenamiento personalizado',
    'coaching', 'pt', 'trainer', 'entrenador', 'clases personalizadas'
  ],
  // Piscina
  piscina: [
    'piscina', 'pool', 'natación', 'natacion', 'swimming', 'alberca',
    'piscina temperada', 'piscina olímpica', 'piscina climatizada'
  ],
  // Jacuzzi
  jacuzzi: [
    'jacuzzi', 'hot tub', 'hidromasaje', 'whirlpool', 'tina caliente',
    'bañera de hidromasaje'
  ],
  // Gimnasio
  gimnasio: [
    'gimnasio', 'gym', 'fitness', 'sala de máquinas', 'área de pesas',
    'cardio', 'musculación', 'entrenamiento'
  ],
  // Restaurante
  restaurante: [
    'restaurante', 'restaurant', 'comedor', 'cafetería', 'cafeteria',
    'buffet', 'snack bar', 'bar', 'cocina'
  ],
  // Estacionamiento
  estacionamiento: [
    'estacionamiento', 'parking', 'parqueo', 'cochera', 'garaje'
  ],
};

export function searchKeywordsInContent(
  content: string,
  requiredServices: string[]
): { service: string; found: boolean; keywords: string[]; context: string }[] {
  const contentLower = content.toLowerCase();
  const results: { service: string; found: boolean; keywords: string[]; context: string }[] = [];

  for (const service of requiredServices) {
    const serviceLower = service.toLowerCase();
    const keywords = SERVICE_KEYWORDS[serviceLower] || [serviceLower];
    const foundKeywords: string[] = [];
    let context = '';

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const index = contentLower.indexOf(keywordLower);
      if (index !== -1) {
        foundKeywords.push(keyword);
        // Capturar contexto de la primera coincidencia
        if (!context) {
          const start = Math.max(0, index - 80);
          const end = Math.min(content.length, index + keywordLower.length + 80);
          context = content.substring(start, end).trim();
        }
      }
    }

    results.push({
      service,
      found: foundKeywords.length > 0,
      keywords: foundKeywords,
      context: foundKeywords.length > 0 ? `...${context}...` : '',
    });
  }

  return results;
}

// Función para intentar scraping de múltiples páginas del sitio
export async function scrapeWebsiteDeep(baseUrl: string): Promise<string | null> {
  // Primero intentar la página principal
  let content = await scrapeWebsite(baseUrl);

  // Intentar páginas comunes de servicios
  const commonPaths = [
    '/servicios',
    '/services',
    '/amenidades',
    '/amenities',
    '/instalaciones',
    '/facilities',
    '/nosotros',
    '/about',
    '/hospedaje',
    '/alojamiento',
    '/bungalows',
  ];

  try {
    const url = new URL(baseUrl);
    const baseOrigin = url.origin;

    // Intentar 2-3 páginas adicionales
    for (const path of commonPaths.slice(0, 3)) {
      try {
        const pageContent = await scrapeWebsite(`${baseOrigin}${path}`);
        if (pageContent && pageContent.length > 200) {
          content = (content || '') + '\n\n' + pageContent;
        }
      } catch {
        // Ignorar errores de páginas que no existen
      }
    }
  } catch {
    // URL inválida, usar solo contenido principal
  }

  // Limitar contenido total
  return content ? content.substring(0, 6000) : null;
}
