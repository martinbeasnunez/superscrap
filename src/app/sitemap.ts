import { MetadataRoute } from 'next';
import { getAllIndustries } from '@/lib/landing-config';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://getlavado.com';
  const industries = getAllIndustries();

  // Landing pages por industria
  const landingPages = industries.map((industry) => ({
    url: `${baseUrl}/landing/${industry.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  return [
    // Página principal
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    // Landing pages
    ...landingPages,
  ];
}
