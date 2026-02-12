'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Locale = 'es' | 'en';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'es',
  setLocale: () => {},
  t: (key: string) => key,
});

// Traducciones generales (UI chrome, botones, etc.)
const translations: Record<Locale, Record<string, string>> = {
  es: {
    // Landing common
    'landing.trust_badge': '+800 empresas confían en nosotros',
    'landing.hero_subtitle': 'Cada industria tiene necesidades únicas. Por eso ofrecemos soluciones específicas para cada tipo de negocio.',
    'landing.hero_title_1': 'Lavandería Industrial',
    'landing.hero_title_2': 'Especializada',
    'landing.cta_not_listed_title': '¿Tu industria no está listada?',
    'landing.cta_not_listed_desc': 'Trabajamos con todo tipo de empresas que manejan textiles. Contáctanos para una cotización personalizada.',
    'landing.cta_whatsapp': 'Cotizar por WhatsApp',
    'landing.footer_location': 'Lima, Perú | +51 928 113 653 | info@getlavado.com',
    'landing.see_more': 'Ver más',
    'landing.save_up_to': 'Ahorra hasta',

    // Industry landing common
    'industry.form_title': 'Solicita tu Cotización',
    'industry.form_subtitle': 'Sin compromiso',
    'industry.form_business_name': 'Nombre del',
    'industry.form_your_name': 'Tu Nombre',
    'industry.form_phone': 'Teléfono',
    'industry.form_email': 'Email',
    'industry.form_frequency': 'Frecuencia',
    'industry.form_frequency_daily': 'Diaria',
    'industry.form_frequency_3x': '3 veces/semana',
    'industry.form_frequency_2x': '2 veces/semana',
    'industry.form_frequency_weekly': 'Semanal',
    'industry.form_select': 'Seleccionar',
    'industry.form_current_provider': '¿Actualmente tienen proveedor de lavandería?',
    'industry.form_no_internal': 'No / Interno',
    'industry.form_yes_have': 'Sí, tenemos uno',
    'industry.form_submit': 'SOLICITAR COTIZACIÓN GRATIS',
    'industry.form_sending': 'Enviando...',
    'industry.form_disclaimer': 'Sin compromiso • Respuesta rápida',
    'industry.form_error': 'Hubo un error al enviar. Por favor intenta de nuevo.',

    'industry.success_title': '¡Solicitud Recibida!',
    'industry.success_desc': 'Nuestro equipo te contactará pronto con una cotización personalizada.',
    'industry.success_whatsapp': 'Escríbenos por WhatsApp',

    'industry.hero_prefix': 'Lavandería Industrial para',
    'industry.hero_suffix_1': 'impecables. Recojo y entrega en tu local.',
    'industry.hero_suffix_2': 'Ahorra hasta 40%',
    'industry.hero_suffix_3': 'vs hacerlo internamente.',

    'industry.gallery_title': 'Calidad que se ve y se siente',
    'industry.gallery_desc_prefix': 'Textiles impecables, siempre a tiempo. Así trabajamos para',

    'industry.testimonial_section': 'Testimonio',

    'industry.case_study_title': 'Caso Real: Ahorro de',
    'industry.case_study_before': 'Antes',
    'industry.case_study_after': 'Ahora',

    'industry.process_title': 'Así de fácil funciona',
    'industry.process_desc': 'Tú solo apilas los textiles. Nosotros hacemos el resto.',
    'industry.process_step1_title': 'Recogemos',
    'industry.process_step1_desc': 'Pasamos por tu local en el horario que prefieras. Sin que muevas un dedo.',
    'industry.process_step2_title': 'Procesamos',
    'industry.process_step2_desc': 'Lavado industrial, secado controlado y doblado profesional.',
    'industry.process_step3_title': 'Entregamos',
    'industry.process_step3_desc': 'Textiles impecables, listos para usar. Siempre a tiempo.',
    'industry.process_cta': 'PROBAR 1 SEMANA GRATIS',

    'industry.pain_title': '¿Te suena familiar?',
    'industry.pain_desc_prefix': 'Problemas comunes que resolvemos para',
    'industry.pain_solution': '→ Nosotros lo solucionamos',

    'industry.faq_title': 'Preguntas Frecuentes',

    'industry.final_cta_title': '¿Listo para ahorrar hasta 40%?',
    'industry.final_cta_desc': 'Únete a +800 empresas que ya confían en GetLavado',
    'industry.final_cta_button': 'SOLICITAR COTIZACIÓN GRATIS',
    'industry.final_cta_whatsapp': 'WhatsApp',
    'industry.final_cta_disclaimer': 'Sin compromiso • Respuesta rápida • Prueba gratis',
  },

  en: {
    // Landing common
    'landing.trust_badge': '800+ companies trust us',
    'landing.hero_subtitle': 'Every industry has unique needs. That\'s why we offer specific solutions for each type of business.',
    'landing.hero_title_1': 'Specialized',
    'landing.hero_title_2': 'Industrial Laundry',
    'landing.cta_not_listed_title': 'Your industry not listed?',
    'landing.cta_not_listed_desc': 'We work with all types of businesses that handle textiles. Contact us for a custom quote.',
    'landing.cta_whatsapp': 'Get a Quote on WhatsApp',
    'landing.footer_location': 'Lima, Peru | +51 928 113 653 | info@getlavado.com',
    'landing.see_more': 'Learn more',
    'landing.save_up_to': 'Save up to',

    // Industry landing common
    'industry.form_title': 'Request a Quote',
    'industry.form_subtitle': 'No commitment',
    'industry.form_business_name': 'Name of',
    'industry.form_your_name': 'Your Name',
    'industry.form_phone': 'Phone',
    'industry.form_email': 'Email',
    'industry.form_frequency': 'Frequency',
    'industry.form_frequency_daily': 'Daily',
    'industry.form_frequency_3x': '3 times/week',
    'industry.form_frequency_2x': '2 times/week',
    'industry.form_frequency_weekly': 'Weekly',
    'industry.form_select': 'Select',
    'industry.form_current_provider': 'Do you currently have a laundry provider?',
    'industry.form_no_internal': 'No / In-house',
    'industry.form_yes_have': 'Yes, we have one',
    'industry.form_submit': 'REQUEST FREE QUOTE',
    'industry.form_sending': 'Sending...',
    'industry.form_disclaimer': 'No commitment • Quick response',
    'industry.form_error': 'There was an error. Please try again.',

    'industry.success_title': 'Request Received!',
    'industry.success_desc': 'Our team will contact you shortly with a custom quote.',
    'industry.success_whatsapp': 'Message us on WhatsApp',

    'industry.hero_prefix': 'Industrial Laundry for',
    'industry.hero_suffix_1': 'spotless. Pickup and delivery at your location.',
    'industry.hero_suffix_2': 'Save up to 40%',
    'industry.hero_suffix_3': 'vs doing it in-house.',

    'industry.gallery_title': 'Quality you can see and feel',
    'industry.gallery_desc_prefix': 'Spotless textiles, always on time. This is how we work for',

    'industry.testimonial_section': 'Testimonial',

    'industry.case_study_title': 'Real Case: Savings of',
    'industry.case_study_before': 'Before',
    'industry.case_study_after': 'Now',

    'industry.process_title': 'It\'s this easy',
    'industry.process_desc': 'You just stack the textiles. We do the rest.',
    'industry.process_step1_title': 'We Pick Up',
    'industry.process_step1_desc': 'We come to your location at your preferred time. No effort needed.',
    'industry.process_step2_title': 'We Process',
    'industry.process_step2_desc': 'Industrial washing, controlled drying, and professional folding.',
    'industry.process_step3_title': 'We Deliver',
    'industry.process_step3_desc': 'Spotless textiles, ready to use. Always on time.',
    'industry.process_cta': 'TRY 1 WEEK FREE',

    'industry.pain_title': 'Sound familiar?',
    'industry.pain_desc_prefix': 'Common problems we solve for',
    'industry.pain_solution': '→ We solve this',

    'industry.faq_title': 'Frequently Asked Questions',

    'industry.final_cta_title': 'Ready to save up to 40%?',
    'industry.final_cta_desc': 'Join 800+ companies that already trust GetLavado',
    'industry.final_cta_button': 'REQUEST FREE QUOTE',
    'industry.final_cta_whatsapp': 'WhatsApp',
    'industry.final_cta_disclaimer': 'No commitment • Quick response • Free trial',
  },
};

function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined') return 'es';

  // Check localStorage first
  const saved = localStorage.getItem('superscrap_locale');
  if (saved === 'en' || saved === 'es') return saved;

  // Detect from browser
  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'es';
  return browserLang.startsWith('en') ? 'en' : 'es';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('es');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(detectBrowserLocale());
    setMounted(true);
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('superscrap_locale', newLocale);
  };

  const t = (key: string): string => {
    return translations[locale]?.[key] || translations['es']?.[key] || key;
  };

  // Prevent hydration mismatch - render Spanish by default on server
  if (!mounted) {
    return (
      <I18nContext.Provider value={{ locale: 'es', setLocale, t: (key) => translations['es']?.[key] || key }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

// Language selector component
export function LanguageSelector({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={() => setLocale('es')}
        className={`px-2 py-1 rounded text-sm font-medium transition-all ${
          locale === 'es'
            ? 'bg-white/20 text-white'
            : 'text-white/60 hover:text-white/80'
        }`}
      >
        ES
      </button>
      <span className="text-white/40">|</span>
      <button
        onClick={() => setLocale('en')}
        className={`px-2 py-1 rounded text-sm font-medium transition-all ${
          locale === 'en'
            ? 'bg-white/20 text-white'
            : 'text-white/60 hover:text-white/80'
        }`}
      >
        EN
      </button>
    </div>
  );
}
