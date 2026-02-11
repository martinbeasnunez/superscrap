import { type IndustryConfig } from '@/lib/landing-config';

interface JsonLdProps {
  config: IndustryConfig;
}

export default function JsonLd({ config }: JsonLdProps) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'GetLavado',
    description: 'Lavandería industrial para empresas en Perú. +800 clientes confían en nosotros.',
    url: 'https://getlavado.com',
    telephone: '+51928113653',
    email: 'info@getlavado.com',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lima',
      addressCountry: 'PE',
    },
    areaServed: {
      '@type': 'Country',
      name: 'Perú',
    },
    priceRange: '$$',
    image: 'https://getlavado.com/logo.png',
  };

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Lavandería Industrial para ${config.namePlural}`,
    description: config.seo.description,
    provider: {
      '@type': 'LocalBusiness',
      name: 'GetLavado',
    },
    areaServed: {
      '@type': 'Country',
      name: 'Perú',
    },
    serviceType: 'Lavandería Industrial',
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: 'PEN',
      },
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: config.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: 'https://getlavado.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Servicios',
        item: 'https://getlavado.com/landing',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: config.namePlural,
        item: `https://getlavado.com/landing/${config.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
