// Configuración de landings por industria
// Cada industria tiene su propia landing optimizada para SEO y conversión
// Soporte bilingüe ES/EN

export interface Testimonial {
  name: string;
  role: string;
  company: string;
  quote: string;
  image: string;
}

export interface IndustryConfig {
  slug: string;
  name: string;
  namePlural: string;
  nameEn: string;
  namePluralEn: string;
  heroImage: string;
  galleryImages: string[];
  processImage: string;
  textiles: string[];
  textilesEn: string[];
  benefits: string[];
  benefitsEn: string[];
  painPoints: string[];
  painPointsEn: string[];
  stats: { value: string; label: string; labelEn: string }[];
  testimonial: Testimonial & { roleEn: string; quoteEn: string };
  caseStudy: {
    before: string;
    after: string;
    savings: string;
    location: string;
    beforeEn: string;
    afterEn: string;
    locationEn: string;
  };
  faq: { question: string; answer: string; questionEn: string; answerEn: string }[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  formFields: {
    volumeLabel: string;
    volumeLabelEn: string;
    volumeOptions: { value: string; label: string; labelEn: string }[];
  };
}

// Helper to get localized field
export function getLocalized(config: IndustryConfig, locale: 'es' | 'en') {
  return {
    name: locale === 'en' ? config.nameEn : config.name,
    namePlural: locale === 'en' ? config.namePluralEn : config.namePlural,
    textiles: locale === 'en' ? config.textilesEn : config.textiles,
    benefits: locale === 'en' ? config.benefitsEn : config.benefits,
    painPoints: locale === 'en' ? config.painPointsEn : config.painPoints,
    stats: config.stats.map(s => ({ value: s.value, label: locale === 'en' ? s.labelEn : s.label })),
    testimonial: {
      ...config.testimonial,
      role: locale === 'en' ? config.testimonial.roleEn : config.testimonial.role,
      quote: locale === 'en' ? config.testimonial.quoteEn : config.testimonial.quote,
    },
    caseStudy: {
      ...config.caseStudy,
      before: locale === 'en' ? config.caseStudy.beforeEn : config.caseStudy.before,
      after: locale === 'en' ? config.caseStudy.afterEn : config.caseStudy.after,
      location: locale === 'en' ? config.caseStudy.locationEn : config.caseStudy.location,
    },
    faq: config.faq.map(f => ({
      question: locale === 'en' ? f.questionEn : f.question,
      answer: locale === 'en' ? f.answerEn : f.answer,
    })),
    formFields: {
      volumeLabel: locale === 'en' ? config.formFields.volumeLabelEn : config.formFields.volumeLabel,
      volumeOptions: config.formFields.volumeOptions.map(o => ({
        value: o.value,
        label: locale === 'en' ? o.labelEn : o.label,
      })),
    },
  };
}

// Logos de clientes
export const CLIENT_LOGOS = [
  'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&h=80&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1599305446868-59e861c19d3c?w=200&h=80&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1599305446956-079a7e4cfa6a?w=200&h=80&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1599305447147-71b1f08e9caa?w=200&h=80&fit=crop&auto=format',
];

export const INDUSTRIES: Record<string, IndustryConfig> = {
  hoteles: {
    slug: 'hoteles',
    name: 'Hotel',
    namePlural: 'Hoteles',
    nameEn: 'Hotel',
    namePluralEn: 'Hotels',
    heroImage: '/images/landings/hoteles-hero.webp',
    galleryImages: [
      '/images/landings/hoteles-gallery-1.webp',
      '/images/landings/hoteles-gallery-2.webp',
      '/images/landings/hoteles-gallery-3.webp',
    ],
    processImage: '/images/landings/hoteles-hero.webp',
    textiles: ['Sábanas', 'Toallas', 'Batas', 'Uniformes'],
    textilesEn: ['Sheets', 'Towels', 'Robes', 'Uniforms'],
    benefits: [
      'Recojo y entrega diaria en tu hotel',
      'Capacidad para 5+ toneladas diarias',
      '8 años de experiencia hotelera',
      'Prueba 1 semana sin compromiso',
    ],
    benefitsEn: [
      'Daily pickup and delivery at your hotel',
      'Capacity for 5+ tons daily',
      '8 years of hotel experience',
      'Try 1 week with no commitment',
    ],
    painPoints: [
      'Sábanas manchadas que no salen',
      'Toallas que pierden suavidad',
      'Entregas impuntuales que afectan operación',
      'Costos internos muy altos',
    ],
    painPointsEn: [
      'Stained sheets that won\'t come clean',
      'Towels losing their softness',
      'Late deliveries affecting operations',
      'Very high in-house costs',
    ],
    stats: [
      { value: '150+', label: 'Hoteles atendidos', labelEn: 'Hotels served' },
      { value: '5 Ton', label: 'Capacidad diaria', labelEn: 'Daily capacity' },
      { value: '99.2%', label: 'Entregas a tiempo', labelEn: 'On-time delivery' },
      { value: '8 años', label: 'Experiencia', labelEn: 'Experience' },
    ],
    testimonial: {
      name: 'Carlos Mendoza',
      role: 'Gerente de Operaciones',
      roleEn: 'Operations Manager',
      company: 'Hotel Boutique Miraflores',
      quote: 'Desde que trabajamos con GetLavado, nuestros huéspedes notan la diferencia. Las sábanas están impecables y siempre llegan a tiempo.',
      quoteEn: 'Since working with GetLavado, our guests notice the difference. The sheets are spotless and always arrive on time.',
      image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/8,500/mes en lavandería interna',
      after: 'S/5,200/mes con GetLavado',
      savings: '39%',
      location: 'Hotel 3 estrellas en Miraflores',
      beforeEn: 'S/8,500/mo in-house laundry',
      afterEn: 'S/5,200/mo with GetLavado',
      locationEn: '3-star hotel in Miraflores',
    },
    faq: [
      {
        question: '¿Cuánto demora el servicio?',
        answer: 'Recogemos y entregamos el mismo día o al día siguiente, dependiendo del volumen. Para hoteles con alto tráfico, ofrecemos servicio diario.',
        questionEn: 'How long does the service take?',
        answerEn: 'We pick up and deliver same day or next day, depending on volume. For high-traffic hotels, we offer daily service.',
      },
      {
        question: '¿Pueden manejar el volumen de un hotel grande?',
        answer: 'Sí, nuestra planta procesa más de 5 toneladas diarias. Trabajamos con hoteles de hasta 200+ habitaciones sin problemas.',
        questionEn: 'Can you handle the volume of a large hotel?',
        answerEn: 'Yes, our facility processes over 5 tons daily. We work with hotels of 200+ rooms without issues.',
      },
      {
        question: '¿Qué pasa si una sábana se daña?',
        answer: 'Tenemos política de reposición. Si algo se daña por nuestro proceso, lo reponemos sin costo adicional.',
        questionEn: 'What happens if a sheet is damaged?',
        answerEn: 'We have a replacement policy. If anything is damaged by our process, we replace it at no extra cost.',
      },
      {
        question: '¿Trabajan fines de semana?',
        answer: 'Sí, operamos de lunes a sábado, y domingos bajo demanda para hoteles con ocupación alta.',
        questionEn: 'Do you work weekends?',
        answerEn: 'Yes, we operate Monday to Saturday, and Sundays on demand for high-occupancy hotels.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Hoteles en Lima | GetLavado',
      description: 'Servicio de lavandería industrial especializado en hoteles. Sábanas, toallas y uniformes impecables. Recojo y entrega. Ahorra hasta 40%. +800 hoteles confían en nosotros.',
      keywords: ['lavandería hoteles lima', 'lavandería industrial hoteles', 'servicio lavandería hotelera', 'limpieza textiles hoteles', 'lavado sábanas hoteles'],
    },
    formFields: {
      volumeLabel: 'Nº de Habitaciones',
      volumeLabelEn: 'Number of Rooms',
      volumeOptions: [
        { value: '1-20', label: '1-20 habitaciones', labelEn: '1-20 rooms' },
        { value: '21-50', label: '21-50 habitaciones', labelEn: '21-50 rooms' },
        { value: '51-100', label: '51-100 habitaciones', labelEn: '51-100 rooms' },
        { value: '100+', label: 'Más de 100', labelEn: 'More than 100' },
      ],
    },
  },

  restaurantes: {
    slug: 'restaurantes',
    name: 'Restaurante',
    namePlural: 'Restaurantes',
    nameEn: 'Restaurant',
    namePluralEn: 'Restaurants',
    heroImage: '/images/landings/restaurantes-hero.webp',
    galleryImages: [
      '/images/landings/restaurantes-gallery-1.webp',
      '/images/landings/restaurantes-gallery-2.webp',
      '/images/landings/restaurantes-gallery-3.webp',
    ],
    processImage: '/images/landings/restaurantes-hero.webp',
    textiles: ['Manteles', 'Servilletas', 'Uniformes de cocina', 'Delantales'],
    textilesEn: ['Tablecloths', 'Napkins', 'Kitchen uniforms', 'Aprons'],
    benefits: [
      'Manteles siempre blancos y planchados',
      'Recojo y entrega en tu local',
      'Servicio express para eventos',
      'Tratamiento especial para manchas de grasa',
    ],
    benefitsEn: [
      'Always white and pressed tablecloths',
      'Pickup and delivery at your location',
      'Express service for events',
      'Special treatment for grease stains',
    ],
    painPoints: [
      'Manchas de grasa que no salen',
      'Manteles amarillentos',
      'Uniformes con olor a cocina',
      'Entregas impuntuales',
    ],
    painPointsEn: [
      'Grease stains that won\'t come out',
      'Yellowed tablecloths',
      'Uniforms smelling like kitchen',
      'Late deliveries',
    ],
    stats: [
      { value: '200+', label: 'Restaurantes', labelEn: 'Restaurants' },
      { value: '95%', label: 'Manchas removidas', labelEn: 'Stains removed' },
      { value: '24h', label: 'Servicio express', labelEn: 'Express service' },
      { value: '0', label: 'Olor residual', labelEn: 'Residual odor' },
    ],
    testimonial: {
      name: 'Patricia Vega',
      role: 'Dueña',
      roleEn: 'Owner',
      company: 'Cevichería La Mar Brava',
      quote: 'Los manteles quedan perfectos, sin manchas de ají ni pescado. Mis clientes siempre comentan lo impecable de la mesa.',
      quoteEn: 'The tablecloths come out perfect, no chili or fish stains. My customers always comment on how spotless the tables look.',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/2,800/mes en lavandería local',
      after: 'S/1,900/mes con GetLavado',
      savings: '32%',
      location: 'Cevichería en San Isidro',
      beforeEn: 'S/2,800/mo at local laundry',
      afterEn: 'S/1,900/mo with GetLavado',
      locationEn: 'Cevichería in San Isidro',
    },
    faq: [
      {
        question: '¿Pueden quitar manchas de grasa difíciles?',
        answer: 'Sí, usamos productos industriales especializados para manchas de grasa, vino y salsas. Tenemos 95% de éxito en manchas difíciles.',
        questionEn: 'Can you remove tough grease stains?',
        answerEn: 'Yes, we use specialized industrial products for grease, wine and sauce stains. We have a 95% success rate on tough stains.',
      },
      {
        question: '¿Planchan los manteles?',
        answer: 'Sí, todos los manteles salen planchados y doblados, listos para usar. Sin costo adicional.',
        questionEn: 'Do you iron the tablecloths?',
        answerEn: 'Yes, all tablecloths come pressed and folded, ready to use. No extra cost.',
      },
      {
        question: '¿Tienen servicio para eventos especiales?',
        answer: 'Sí, ofrecemos servicio express para eventos con entrega garantizada el mismo día.',
        questionEn: 'Do you have service for special events?',
        answerEn: 'Yes, we offer express service for events with guaranteed same-day delivery.',
      },
      {
        question: '¿Cuántos manteles puedo enviar?',
        answer: 'No hay mínimo ni máximo. Nos adaptamos a tu volumen, desde 20 manteles hasta 500+ semanales.',
        questionEn: 'How many tablecloths can I send?',
        answerEn: 'No minimum or maximum. We adapt to your volume, from 20 to 500+ tablecloths per week.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Restaurantes en Lima | GetLavado',
      description: 'Lavandería especializada en restaurantes. Manteles impecables, servilletas perfectas, uniformes sin olor. Recojo y entrega. Ahorra hasta 35%.',
      keywords: ['lavandería restaurantes lima', 'lavado manteles restaurante', 'limpieza uniformes cocina', 'lavandería industrial gastronómica'],
    },
    formFields: {
      volumeLabel: 'Capacidad del local',
      volumeLabelEn: 'Restaurant capacity',
      volumeOptions: [
        { value: '1-30', label: '1-30 mesas', labelEn: '1-30 tables' },
        { value: '31-60', label: '31-60 mesas', labelEn: '31-60 tables' },
        { value: '61-100', label: '61-100 mesas', labelEn: '61-100 tables' },
        { value: '100+', label: 'Más de 100 mesas', labelEn: 'More than 100 tables' },
      ],
    },
  },

  clinicas: {
    slug: 'clinicas',
    name: 'Clínica',
    namePlural: 'Clínicas y Centros Médicos',
    nameEn: 'Clinic',
    namePluralEn: 'Clinics & Medical Centers',
    heroImage: '/images/landings/clinicas-hero.webp',
    galleryImages: [
      '/images/landings/clinicas-gallery-1.webp',
      '/images/landings/clinicas-gallery-2.webp',
      '/images/landings/clinicas-gallery-3.webp',
    ],
    processImage: '/images/landings/clinicas-hero.webp',
    textiles: ['Sábanas médicas', 'Batas', 'Uniformes', 'Campos quirúrgicos'],
    textilesEn: ['Medical sheets', 'Gowns', 'Uniforms', 'Surgical drapes'],
    benefits: [
      'Desinfección certificada MINSA',
      'Protocolo para textiles contaminados',
      'Recojo hermético especializado',
      'Trazabilidad de cada pieza',
    ],
    benefitsEn: [
      'MINSA certified disinfection',
      'Protocol for contaminated textiles',
      'Specialized sealed pickup',
      'Traceability for every piece',
    ],
    painPoints: [
      'Manchas de sangre y fluidos',
      'Requisitos sanitarios estrictos',
      'Costos de esterilización altos',
      'Proveedores no certificados',
    ],
    painPointsEn: [
      'Blood and fluid stains',
      'Strict sanitary requirements',
      'High sterilization costs',
      'Uncertified providers',
    ],
    stats: [
      { value: '50+', label: 'Clínicas', labelEn: 'Clinics' },
      { value: '100%', label: 'Desinfección', labelEn: 'Disinfection' },
      { value: 'MINSA', label: 'Certificación', labelEn: 'Certification' },
      { value: 'ISO', label: 'Calidad', labelEn: 'Quality' },
    ],
    testimonial: {
      name: 'Dr. Roberto Sánchez',
      role: 'Director Médico',
      roleEn: 'Medical Director',
      company: 'Clínica Estética Premium',
      quote: 'La certificación y trazabilidad que ofrecen nos da tranquilidad. Cumplimos todas las normas sin preocuparnos.',
      quoteEn: 'The certification and traceability they offer gives us peace of mind. We meet all standards without worrying.',
      image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/4,500/mes con proveedor anterior',
      after: 'S/3,100/mes con GetLavado',
      savings: '31%',
      location: 'Clínica estética en San Borja',
      beforeEn: 'S/4,500/mo with previous provider',
      afterEn: 'S/3,100/mo with GetLavado',
      locationEn: 'Aesthetic clinic in San Borja',
    },
    faq: [
      {
        question: '¿Cumplen con normas sanitarias?',
        answer: 'Sí, nuestro proceso está certificado y cumple con las normas del MINSA para textiles médicos. Entregamos certificado de desinfección.',
        questionEn: 'Do you comply with health regulations?',
        answerEn: 'Yes, our process is certified and complies with MINSA standards for medical textiles. We provide disinfection certificates.',
      },
      {
        question: '¿Cómo manejan textiles contaminados?',
        answer: 'Tenemos protocolo especial con bolsas herméticas rojas, transporte separado y proceso de desinfección industrial.',
        questionEn: 'How do you handle contaminated textiles?',
        answerEn: 'We have a special protocol with sealed red bags, separate transport, and industrial disinfection process.',
      },
      {
        question: '¿Pueden lavar campos quirúrgicos?',
        answer: 'Sí, lavamos y esterilizamos campos quirúrgicos, batas y todo tipo de textiles médicos.',
        questionEn: 'Can you wash surgical drapes?',
        answerEn: 'Yes, we wash and sterilize surgical drapes, gowns, and all types of medical textiles.',
      },
      {
        question: '¿Tienen seguro?',
        answer: 'Sí, contamos con seguro de responsabilidad civil y certificados de calidad ISO.',
        questionEn: 'Do you have insurance?',
        answerEn: 'Yes, we have civil liability insurance and ISO quality certificates.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Clínicas en Lima | GetLavado',
      description: 'Lavandería certificada para centros médicos. Desinfección industrial, cumplimiento MINSA, trazabilidad. Sábanas, batas y uniformes médicos.',
      keywords: ['lavandería clínicas lima', 'lavado textiles médicos', 'desinfección hospitalaria', 'lavandería hospitales perú'],
    },
    formFields: {
      volumeLabel: 'Tamaño de la clínica',
      volumeLabelEn: 'Clinic size',
      volumeOptions: [
        { value: '1-10', label: '1-10 consultorios', labelEn: '1-10 offices' },
        { value: '11-30', label: '11-30 consultorios', labelEn: '11-30 offices' },
        { value: '31-50', label: '31-50 consultorios', labelEn: '31-50 offices' },
        { value: '50+', label: 'Hospital / 50+ camas', labelEn: 'Hospital / 50+ beds' },
      ],
    },
  },

  gimnasios: {
    slug: 'gimnasios',
    name: 'Gimnasio',
    namePlural: 'Gimnasios y Centros Fitness',
    nameEn: 'Gym',
    namePluralEn: 'Gyms & Fitness Centers',
    heroImage: '/images/landings/gimnasios-hero.webp',
    galleryImages: [
      '/images/landings/gimnasios-gallery-1.webp',
      '/images/landings/gimnasios-gallery-2.webp',
      '/images/landings/gimnasios-gallery-3.webp',
    ],
    processImage: '/images/landings/gimnasios-hero.webp',
    textiles: ['Toallas', 'Batas', 'Uniformes staff', 'Alfombras'],
    textilesEn: ['Towels', 'Robes', 'Staff uniforms', 'Mats'],
    benefits: [
      'Eliminamos olor a sudor 100%',
      'Toallas siempre suaves y blancas',
      'Recojo diario disponible',
      'Precios especiales por volumen',
    ],
    benefitsEn: [
      '100% sweat odor elimination',
      'Always soft and white towels',
      'Daily pickup available',
      'Special volume pricing',
    ],
    painPoints: [
      'Toallas con olor persistente',
      'Desgaste rápido de textiles',
      'Alto volumen diario',
      'Clientes exigentes',
    ],
    painPointsEn: [
      'Towels with persistent odor',
      'Rapid textile wear',
      'High daily volume',
      'Demanding customers',
    ],
    stats: [
      { value: '80+', label: 'Gimnasios', labelEn: 'Gyms' },
      { value: '1000+', label: 'Toallas/día', labelEn: 'Towels/day' },
      { value: '0%', label: 'Olor residual', labelEn: 'Residual odor' },
      { value: '40%', label: 'Ahorro promedio', labelEn: 'Average savings' },
    ],
    testimonial: {
      name: 'Andrea Torres',
      role: 'Gerente General',
      roleEn: 'General Manager',
      company: 'FitLife Gym',
      quote: 'Nuestros socios notaron el cambio inmediatamente. Las toallas huelen increíble y están súper suaves.',
      quoteEn: 'Our members noticed the change immediately. The towels smell amazing and are super soft.',
      image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/4,200/mes en lavandería local',
      after: 'S/2,500/mes con GetLavado',
      savings: '40%',
      location: 'Gimnasio en Miraflores',
      beforeEn: 'S/4,200/mo at local laundry',
      afterEn: 'S/2,500/mo with GetLavado',
      locationEn: 'Gym in Miraflores',
    },
    faq: [
      {
        question: '¿Pueden eliminar el olor a sudor?',
        answer: 'Sí, usamos proceso especial con ozono que elimina bacterias y olores al 100%. Las toallas quedan como nuevas.',
        questionEn: 'Can you eliminate sweat odor?',
        answerEn: 'Yes, we use a special ozone process that eliminates bacteria and odors 100%. Towels come out like new.',
      },
      {
        question: '¿Ofrecen servicio diario?',
        answer: 'Sí, para gimnasios con alto tráfico ofrecemos recojo y entrega diaria sin costo adicional de logística.',
        questionEn: 'Do you offer daily service?',
        answerEn: 'Yes, for high-traffic gyms we offer daily pickup and delivery at no extra logistics cost.',
      },
      {
        question: '¿Cuántas toallas pueden procesar?',
        answer: 'Sin límite. Procesamos desde 50 hasta 1,000+ toallas diarias para cadenas de gimnasios.',
        questionEn: 'How many towels can you process?',
        answerEn: 'No limit. We process from 50 to 1,000+ towels daily for gym chains.',
      },
      {
        question: '¿Las toallas mantienen la suavidad?',
        answer: 'Usamos suavizantes industriales que mantienen las toallas esponjosas por más tiempo que el lavado convencional.',
        questionEn: 'Do the towels stay soft?',
        answerEn: 'We use industrial softeners that keep towels fluffy longer than conventional washing.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Gimnasios en Lima | GetLavado',
      description: 'Lavandería especializada en gimnasios. Toallas sin olor, suaves y blancas. Servicio diario disponible. Ahorra hasta 40%.',
      keywords: ['lavandería gimnasios lima', 'lavado toallas gym', 'servicio lavandería fitness', 'limpieza textiles gimnasio'],
    },
    formFields: {
      volumeLabel: 'Tamaño del gimnasio',
      volumeLabelEn: 'Gym size',
      volumeOptions: [
        { value: 'pequeño', label: 'Boutique (hasta 100 socios)', labelEn: 'Boutique (up to 100 members)' },
        { value: 'mediano', label: 'Mediano (100-500 socios)', labelEn: 'Medium (100-500 members)' },
        { value: 'grande', label: 'Grande (500-1500 socios)', labelEn: 'Large (500-1500 members)' },
        { value: 'cadena', label: 'Cadena / Múltiples sedes', labelEn: 'Chain / Multiple locations' },
      ],
    },
  },

  spas: {
    slug: 'spas',
    name: 'Spa',
    namePlural: 'Spas y Centros de Bienestar',
    nameEn: 'Spa',
    namePluralEn: 'Spas & Wellness Centers',
    heroImage: '/images/landings/spas-hero.webp',
    galleryImages: [
      '/images/landings/spas-gallery-1.webp',
      '/images/landings/spas-gallery-2.webp',
      '/images/landings/spas-gallery-3.webp',
    ],
    processImage: '/images/landings/spas-hero.webp',
    textiles: ['Toallas premium', 'Batas', 'Sábanas de camilla', 'Fundas'],
    textilesEn: ['Premium towels', 'Robes', 'Table sheets', 'Covers'],
    benefits: [
      'Toallas extra suaves para spa',
      'Aroma neutro profesional',
      'Doblado especial presentación',
      'Tratamiento de aceites incluido',
    ],
    benefitsEn: [
      'Extra soft towels for spa',
      'Professional neutral scent',
      'Special presentation folding',
      'Oil treatment included',
    ],
    painPoints: [
      'Clientes muy exigentes',
      'Necesidad de suavidad extrema',
      'Manchas de aceites difíciles',
      'Presentación impecable requerida',
    ],
    painPointsEn: [
      'Very demanding clients',
      'Need for extreme softness',
      'Difficult oil stains',
      'Spotless presentation required',
    ],
    stats: [
      { value: '40+', label: 'Spas premium', labelEn: 'Premium spas' },
      { value: '5★', label: 'Calidad', labelEn: 'Quality' },
      { value: '100%', label: 'Aceites removidos', labelEn: 'Oils removed' },
      { value: 'Premium', label: 'Presentación', labelEn: 'Presentation' },
    ],
    testimonial: {
      name: 'Mónica Delgado',
      role: 'Directora',
      roleEn: 'Director',
      company: 'Zen Spa & Wellness',
      quote: 'La suavidad de las toallas es increíble. Nuestros clientes siempre comentan lo premium que se siente todo.',
      quoteEn: 'The softness of the towels is incredible. Our clients always comment on how premium everything feels.',
      image: 'https://images.unsplash.com/photo-1598550874175-4d0ef436c909?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/3,200/mes lavando internamente',
      after: 'S/2,100/mes con GetLavado',
      savings: '34%',
      location: 'Spa en San Isidro',
      beforeEn: 'S/3,200/mo in-house washing',
      afterEn: 'S/2,100/mo with GetLavado',
      locationEn: 'Spa in San Isidro',
    },
    faq: [
      {
        question: '¿Las toallas quedan realmente suaves?',
        answer: 'Usamos un proceso especial para spas con doble suavizante y secado controlado. Nuestros clientes dicen que sus usuarios notan la diferencia.',
        questionEn: 'Are the towels really soft?',
        answerEn: 'We use a special process for spas with double softener and controlled drying. Our clients say their customers notice the difference.',
      },
      {
        question: '¿Pueden quitar manchas de aceites?',
        answer: 'Sí, tenemos tratamiento pre-lavado especial para aceites de masaje, cera y productos cosméticos.',
        questionEn: 'Can you remove oil stains?',
        answerEn: 'Yes, we have a special pre-wash treatment for massage oils, wax, and cosmetic products.',
      },
      {
        question: '¿Ofrecen doblado especial?',
        answer: 'Sí, ofrecemos doblado tipo hotel/spa con presentación premium sin costo adicional.',
        questionEn: 'Do you offer special folding?',
        answerEn: 'Yes, we offer hotel/spa-style folding with premium presentation at no extra cost.',
      },
      {
        question: '¿Tienen experiencia con spas premium?',
        answer: 'Trabajamos con spas de hoteles 5 estrellas y centros de bienestar de alta gama en Lima.',
        questionEn: 'Do you have experience with premium spas?',
        answerEn: 'We work with 5-star hotel spas and high-end wellness centers in Lima.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Spas en Lima | GetLavado',
      description: 'Lavandería premium para spas. Toallas extra suaves, tratamiento de aceites, presentación impecable. La calidad que tus clientes merecen.',
      keywords: ['lavandería spas lima', 'lavado toallas spa', 'servicio lavandería wellness', 'textiles spa premium'],
    },
    formFields: {
      volumeLabel: 'Tamaño del spa',
      volumeLabelEn: 'Spa size',
      volumeOptions: [
        { value: 'pequeño', label: 'Boutique (1-3 cabinas)', labelEn: 'Boutique (1-3 rooms)' },
        { value: 'mediano', label: 'Mediano (4-8 cabinas)', labelEn: 'Medium (4-8 rooms)' },
        { value: 'grande', label: 'Grande (9+ cabinas)', labelEn: 'Large (9+ rooms)' },
        { value: 'hotel', label: 'Spa de hotel', labelEn: 'Hotel spa' },
      ],
    },
  },

  'empresas-seguridad': {
    slug: 'empresas-seguridad',
    name: 'Empresa de Seguridad',
    namePlural: 'Empresas de Seguridad y Vigilancia',
    nameEn: 'Security Company',
    namePluralEn: 'Security & Surveillance Companies',
    heroImage: '/images/landings/seguridad-hero.webp',
    galleryImages: [
      '/images/landings/seguridad-gallery-1.webp',
      '/images/landings/seguridad-gallery-2.webp',
      '/images/landings/seguridad-gallery-3.webp',
    ],
    processImage: '/images/landings/seguridad-hero.webp',
    textiles: ['Uniformes', 'Camisas', 'Pantalones', 'Chalecos'],
    textilesEn: ['Uniforms', 'Shirts', 'Pants', 'Vests'],
    benefits: [
      'Uniformes siempre presentables',
      'Planchado impecable incluido',
      'Entrega en múltiples sedes',
      'Reparaciones menores incluidas',
    ],
    benefitsEn: [
      'Always presentable uniforms',
      'Impeccable pressing included',
      'Delivery to multiple locations',
      'Minor repairs included',
    ],
    painPoints: [
      'Personal en múltiples ubicaciones',
      'Uniformes que se ven gastados',
      'Alto costo de reposición',
      'Manchas de trabajo difíciles',
    ],
    painPointsEn: [
      'Staff at multiple locations',
      'Worn-looking uniforms',
      'High replacement cost',
      'Tough work stains',
    ],
    stats: [
      { value: '30+', label: 'Empresas', labelEn: 'Companies' },
      { value: '5000+', label: 'Uniformes/mes', labelEn: 'Uniforms/month' },
      { value: 'Multi', label: 'Sedes', labelEn: 'Locations' },
      { value: '100%', label: 'Planchado', labelEn: 'Pressed' },
    ],
    testimonial: {
      name: 'Jorge Ramírez',
      role: 'Gerente de Operaciones',
      roleEn: 'Operations Manager',
      company: 'Seguridad Total S.A.',
      quote: 'Manejan 200+ uniformes semanales en 5 sedes diferentes. Siempre puntuales y con calidad impecable.',
      quoteEn: 'They handle 200+ uniforms weekly across 5 locations. Always on time with impeccable quality.',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/6,800/mes con lavandería fragmentada',
      after: 'S/4,200/mes centralizado con GetLavado',
      savings: '38%',
      location: 'Empresa de seguridad con 200+ agentes',
      beforeEn: 'S/6,800/mo with fragmented laundry',
      afterEn: 'S/4,200/mo centralized with GetLavado',
      locationEn: 'Security company with 200+ agents',
    },
    faq: [
      {
        question: '¿Pueden entregar en múltiples sedes?',
        answer: 'Sí, recogemos y entregamos en cada ubicación donde tengan personal. Coordinamos horarios por sede.',
        questionEn: 'Can you deliver to multiple locations?',
        answerEn: 'Yes, we pick up and deliver at each location where you have staff. We coordinate schedules per site.',
      },
      {
        question: '¿El planchado está incluido?',
        answer: 'Sí, todos los uniformes van planchados y en gancho o doblados según prefieran.',
        questionEn: 'Is pressing included?',
        answerEn: 'Yes, all uniforms come pressed and on hangers or folded as you prefer.',
      },
      {
        question: '¿Manejan grandes volúmenes?',
        answer: 'Procesamos uniformes para empresas de 50 hasta 1,000+ empleados. Sin problema de capacidad.',
        questionEn: 'Do you handle large volumes?',
        answerEn: 'We process uniforms for companies with 50 to 1,000+ employees. No capacity issues.',
      },
      {
        question: '¿Pueden reparar uniformes?',
        answer: 'Sí, ofrecemos servicio de costura básica: botones, bastillas y reparaciones menores.',
        questionEn: 'Can you repair uniforms?',
        answerEn: 'Yes, we offer basic sewing service: buttons, hems, and minor repairs.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Empresas de Seguridad | GetLavado',
      description: 'Lavandería especializada en uniformes de seguridad. Planchado impecable, entrega en múltiples sedes. Más de 200 empresas confían en nosotros.',
      keywords: ['lavandería uniformes seguridad', 'lavado uniformes vigilancia', 'servicio lavandería empresas seguridad lima'],
    },
    formFields: {
      volumeLabel: 'Número de empleados',
      volumeLabelEn: 'Number of employees',
      volumeOptions: [
        { value: '1-50', label: '1-50 empleados', labelEn: '1-50 employees' },
        { value: '51-150', label: '51-150 empleados', labelEn: '51-150 employees' },
        { value: '151-300', label: '151-300 empleados', labelEn: '151-300 employees' },
        { value: '300+', label: 'Más de 300 empleados', labelEn: 'More than 300 employees' },
      ],
    },
  },

  edificios: {
    slug: 'edificios',
    name: 'Edificio',
    namePlural: 'Edificios y Condominios',
    nameEn: 'Building',
    namePluralEn: 'Buildings & Condominiums',
    heroImage: '/images/landings/edificios-hero.webp',
    galleryImages: [
      '/images/landings/edificios-gallery-1.webp',
      '/images/landings/edificios-gallery-2.webp',
      '/images/landings/edificios-gallery-3.webp',
    ],
    processImage: '/images/landings/edificios-hero.webp',
    textiles: ['Uniformes de personal', 'Cortinas áreas comunes', 'Alfombras', 'Manteles eventos'],
    textilesEn: ['Staff uniforms', 'Common area curtains', 'Carpets', 'Event tablecloths'],
    benefits: [
      'Servicio integral áreas comunes',
      'Uniformes de todo el staff',
      'Retiro e instalación de cortinas',
      'Facturación a administración',
    ],
    benefitsEn: [
      'Comprehensive common area service',
      'All staff uniforms',
      'Curtain removal and installation',
      'Billing to management',
    ],
    painPoints: [
      'Personal con uniformes gastados',
      'Cortinas de lobby sucias',
      'Alfombras con manchas',
      'Múltiples proveedores',
    ],
    painPointsEn: [
      'Staff with worn uniforms',
      'Dirty lobby curtains',
      'Stained carpets',
      'Multiple providers',
    ],
    stats: [
      { value: '60+', label: 'Edificios', labelEn: 'Buildings' },
      { value: 'Todo', label: 'Incluido', labelEn: 'All included' },
      { value: 'RUC', label: 'Facturación', labelEn: 'Invoicing' },
      { value: '33%', label: 'Ahorro', labelEn: 'Savings' },
    ],
    testimonial: {
      name: 'Luis García',
      role: 'Administrador',
      roleEn: 'Building Manager',
      company: 'Edificio Parque Central',
      quote: 'Un solo proveedor para todo: uniformes, cortinas, alfombras. Simplificó nuestra operación y ahorramos dinero.',
      quoteEn: 'One provider for everything: uniforms, curtains, carpets. It simplified our operation and saved us money.',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/1,800/mes con múltiples proveedores',
      after: 'S/1,200/mes todo centralizado',
      savings: '33%',
      location: 'Edificio residencial en San Isidro',
      beforeEn: 'S/1,800/mo with multiple providers',
      afterEn: 'S/1,200/mo all centralized',
      locationEn: 'Residential building in San Isidro',
    },
    faq: [
      {
        question: '¿Lavan cortinas de áreas comunes?',
        answer: 'Sí, lavamos cortinas, alfombras, manteles de sala de eventos y todo textil de áreas comunes.',
        questionEn: 'Do you wash common area curtains?',
        answerEn: 'Yes, we wash curtains, carpets, event room tablecloths, and all common area textiles.',
      },
      {
        question: '¿Facturan a la administración?',
        answer: 'Sí, emitimos factura a nombre del edificio o la administradora. RUC empresarial.',
        questionEn: 'Do you invoice the management?',
        answerEn: 'Yes, we issue invoices to the building or management company. Business tax ID.',
      },
      {
        question: '¿Con qué frecuencia recomiendan el servicio?',
        answer: 'Uniformes: semanal. Cortinas: mensual o bimensual. Alfombras: según tráfico.',
        questionEn: 'How often do you recommend the service?',
        answerEn: 'Uniforms: weekly. Curtains: monthly or bimonthly. Carpets: based on traffic.',
      },
      {
        question: '¿Pueden retirar e instalar cortinas?',
        answer: 'Sí, ofrecemos servicio completo de retiro e instalación de cortinas sin costo adicional.',
        questionEn: 'Can you remove and install curtains?',
        answerEn: 'Yes, we offer complete curtain removal and installation service at no extra cost.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Edificios y Condominios | GetLavado',
      description: 'Servicio de lavandería para edificios residenciales y comerciales. Uniformes, cortinas, alfombras. Facturación a administración.',
      keywords: ['lavandería edificios lima', 'lavado uniformes conserje', 'limpieza cortinas edificio', 'servicio lavandería condominios'],
    },
    formFields: {
      volumeLabel: 'Tipo de edificio',
      volumeLabelEn: 'Building type',
      volumeOptions: [
        { value: 'residencial-pequeño', label: 'Residencial (hasta 50 dptos)', labelEn: 'Residential (up to 50 units)' },
        { value: 'residencial-grande', label: 'Residencial (50+ dptos)', labelEn: 'Residential (50+ units)' },
        { value: 'oficinas', label: 'Edificio de oficinas', labelEn: 'Office building' },
        { value: 'mixto', label: 'Uso mixto / Centro comercial', labelEn: 'Mixed use / Shopping center' },
      ],
    },
  },
};

// Obtener todas las industrias para el sitemap
export function getAllIndustries(): IndustryConfig[] {
  return Object.values(INDUSTRIES);
}

// Obtener industria por slug
export function getIndustryBySlug(slug: string): IndustryConfig | null {
  return INDUSTRIES[slug] || null;
}

// Verificar si un slug es válido
export function isValidIndustrySlug(slug: string): boolean {
  return slug in INDUSTRIES;
}
