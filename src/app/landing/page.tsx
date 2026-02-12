import { Metadata } from 'next';
import Link from 'next/link';
import { getAllIndustries } from '@/lib/landing-config';

export const metadata: Metadata = {
  title: 'Lavandería Industrial por Industria | GetLavado',
  description: 'Servicios de lavandería industrial especializados por industria: hoteles, restaurantes, clínicas, gimnasios, spas y más. +800 empresas confían en nosotros.',
  keywords: ['lavandería industrial', 'lavandería empresas', 'lavandería hoteles', 'lavandería restaurantes', 'lavandería clínicas'],
  openGraph: {
    title: 'Lavandería Industrial por Industria | GetLavado',
    description: 'Servicios de lavandería industrial especializados por industria. Ahorra hasta 40%.',
    url: 'https://getlavado.com/landing',
    siteName: 'GetLavado',
    locale: 'es_PE',
    type: 'website',
  },
};

const industryEmojis: Record<string, string> = {
  hoteles: '🏨',
  restaurantes: '🍽️',
  clinicas: '🏥',
  gimnasios: '💪',
  spas: '🧘',
  'empresas-seguridad': '🛡️',
  edificios: '🏢',
};

export default function LandingsIndex() {
  const industries = getAllIndustries();

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Hero */}
      <div className="bg-[#1C2026] text-white py-12 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-medium mb-6 sm:mb-8">
            <span className="text-[#0890F1]">★</span>
            <span>+800 empresas confían en nosotros</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Lavandería Industrial <span className="text-[#0890F1]">Especializada</span>
          </h1>
          <p className="text-base sm:text-xl text-white/80 max-w-2xl mx-auto">
            Cada industria tiene necesidades únicas. Por eso ofrecemos soluciones específicas
            para cada tipo de negocio.
          </p>
        </div>
      </div>

      {/* Grid de industrias */}
      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {industries.map((industry) => (
            <Link
              key={industry.slug}
              href={`/landing/${industry.slug}`}
              className="group bg-white rounded-3xl shadow-lg overflow-hidden hover:shadow-2xl transition-all hover:-translate-y-1 border-2 border-gray-100 hover:border-[#0890F1]"
            >
              {/* Image */}
              <div className="h-48 relative overflow-hidden">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform group-hover:scale-110"
                  style={{ backgroundImage: `url('${industry.heroImage}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <span className="text-4xl">{industryEmojis[industry.slug] || '🧺'}</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h2 className="text-xl font-bold text-[#1C2026] mb-2 group-hover:text-[#0890F1] transition-colors">
                  {industry.namePlural}
                </h2>
                <p className="text-gray-500 text-sm mb-4">
                  {industry.textiles.join(', ')}
                </p>

                {/* Benefits preview */}
                <div className="space-y-2 mb-4">
                  {industry.benefits.slice(0, 2).map((benefit, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-[#0890F1] font-bold">✓</span>
                      {benefit}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#72D7CF]">
                    Ahorra hasta {industry.caseStudy.savings}
                  </span>
                  <span className="text-[#0890F1] font-bold text-sm group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    Ver más
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-[#1C2026] py-12 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
            ¿Tu industria no está listada?
          </h2>
          <p className="text-white/80 text-base sm:text-lg mb-8 sm:mb-10">
            Trabajamos con todo tipo de empresas que manejan textiles.
            Contáctanos para una cotización personalizada.
          </p>
          <a
            href="https://wa.me/51928113653?text=Hola!%20Quiero%20cotizar%20lavandería%20industrial%20para%20mi%20empresa"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 sm:gap-3 bg-[#72D7CF] hover:bg-[#5CC4BB] text-white font-bold py-4 px-8 sm:py-5 sm:px-10 rounded-full transition-all shadow-lg text-sm sm:text-base"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Cotizar por WhatsApp
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black py-10">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-white font-bold text-lg mb-2">GetLavado</p>
          <p className="text-gray-400">Lima, Perú | +51 928 113 653 | info@getlavado.com</p>
        </div>
      </div>
    </div>
  );
}
