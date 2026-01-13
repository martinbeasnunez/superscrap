import { SerpAPILocalResult } from '@/types';

const SERPAPI_KEY = process.env.SERPAPI_KEY!;

interface SerpAPIResponse {
  local_results?: SerpAPILocalResult[];
  error?: string;
}

export async function searchLocalBusinesses(
  businessType: string,
  city: string
): Promise<SerpAPILocalResult[]> {
  const query = `${businessType} en ${city}`;

  const params = new URLSearchParams({
    api_key: SERPAPI_KEY,
    engine: 'google_maps',
    q: query,
    ll: '@-12.0464,-77.0428,12z', // Lima, Peru coordinates
    type: 'search',
    hl: 'es',
    gl: 'pe',
  });

  const response = await fetch(`https://serpapi.com/search.json?${params}`);

  if (!response.ok) {
    throw new Error(`SerpAPI error: ${response.statusText}`);
  }

  const data: SerpAPIResponse = await response.json();

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  return data.local_results || [];
}
