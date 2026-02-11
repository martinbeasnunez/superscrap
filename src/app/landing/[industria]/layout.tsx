import type { Metadata } from 'next';
import { getIndustryBySlug, getAllIndustries } from '@/lib/landing-config';
import JsonLd from '@/components/landing/JsonLd';

interface LayoutProps {
  params: Promise<{ industria: string }>;
  children: React.ReactNode;
}

// Generar rutas estáticas para todas las industrias
export async function generateStaticParams() {
  const industries = getAllIndustries();
  return industries.map((industry) => ({
    industria: industry.slug,
  }));
}

// Generar metadata SEO dinámica
export async function generateMetadata({ params }: { params: Promise<{ industria: string }> }): Promise<Metadata> {
  const { industria } = await params;
  const config = getIndustryBySlug(industria);

  if (!config) {
    return {
      title: 'Página no encontrada | GetLavado',
    };
  }

  return {
    title: config.seo.title,
    description: config.seo.description,
    keywords: config.seo.keywords,
    openGraph: {
      title: config.seo.title,
      description: config.seo.description,
      url: `https://getlavado.com/landing/${config.slug}`,
      siteName: 'GetLavado',
      images: [
        {
          url: config.heroImage,
          width: 1200,
          height: 630,
          alt: `Lavandería industrial para ${config.namePlural}`,
        },
      ],
      locale: 'es_PE',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: config.seo.title,
      description: config.seo.description,
      images: [config.heroImage],
    },
    alternates: {
      canonical: `https://getlavado.com/landing/${config.slug}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default async function IndustryLayout({ params, children }: LayoutProps) {
  const { industria } = await params;
  const config = getIndustryBySlug(industria);

  if (!config) {
    return children;
  }

  return (
    <>
      <JsonLd config={config} />
      {children}
    </>
  );
}
