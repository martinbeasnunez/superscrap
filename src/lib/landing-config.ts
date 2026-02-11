// Configuración de landings por industria
// Cada industria tiene su propia landing optimizada para SEO y conversión

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
  heroImage: string;
  galleryImages: string[];
  processImage: string;
  textiles: string[];
  benefits: string[];
  painPoints: string[];
  stats: { value: string; label: string }[];
  testimonial: Testimonial;
  caseStudy: {
    before: string;
    after: string;
    savings: string;
    location: string;
  };
  faq: { question: string; answer: string }[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  formFields: {
    volumeLabel: string;
    volumeOptions: { value: string; label: string }[];
  };
}

// Logos de clientes (usamos logos genéricos por industria)
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
    heroImage: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2070&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=800&q=80',
    ],
    processImage: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=1200&q=80',
    textiles: ['Sábanas', 'Toallas', 'Batas', 'Uniformes'],
    benefits: [
      'Recojo y entrega diaria en tu hotel',
      'Capacidad para 5+ toneladas diarias',
      '8 años de experiencia hotelera',
      'Prueba 1 semana sin compromiso',
    ],
    painPoints: [
      'Sábanas manchadas que no salen',
      'Toallas que pierden suavidad',
      'Entregas impuntuales que afectan operación',
      'Costos internos muy altos',
    ],
    stats: [
      { value: '150+', label: 'Hoteles atendidos' },
      { value: '5 Ton', label: 'Capacidad diaria' },
      { value: '99.2%', label: 'Entregas a tiempo' },
      { value: '8 años', label: 'Experiencia' },
    ],
    testimonial: {
      name: 'Carlos Mendoza',
      role: 'Gerente de Operaciones',
      company: 'Hotel Boutique Miraflores',
      quote: 'Desde que trabajamos con GetLavado, nuestros huéspedes notan la diferencia. Las sábanas están impecables y siempre llegan a tiempo.',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/8,500/mes en lavandería interna',
      after: 'S/5,200/mes con GetLavado',
      savings: '39%',
      location: 'Hotel 3 estrellas en Miraflores',
    },
    faq: [
      {
        question: '¿Cuánto demora el servicio?',
        answer: 'Recogemos y entregamos el mismo día o al día siguiente, dependiendo del volumen. Para hoteles con alto tráfico, ofrecemos servicio diario.',
      },
      {
        question: '¿Pueden manejar el volumen de un hotel grande?',
        answer: 'Sí, nuestra planta procesa más de 5 toneladas diarias. Trabajamos con hoteles de hasta 200+ habitaciones sin problemas.',
      },
      {
        question: '¿Qué pasa si una sábana se daña?',
        answer: 'Tenemos política de reposición. Si algo se daña por nuestro proceso, lo reponemos sin costo adicional.',
      },
      {
        question: '¿Trabajan fines de semana?',
        answer: 'Sí, operamos de lunes a sábado, y domingos bajo demanda para hoteles con ocupación alta.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Hoteles en Lima | GetLavado',
      description: 'Servicio de lavandería industrial especializado en hoteles. Sábanas, toallas y uniformes impecables. Recojo y entrega. Ahorra hasta 40%. +800 hoteles confían en nosotros.',
      keywords: ['lavandería hoteles lima', 'lavandería industrial hoteles', 'servicio lavandería hotelera', 'limpieza textiles hoteles', 'lavado sábanas hoteles'],
    },
    formFields: {
      volumeLabel: 'Nº de Habitaciones',
      volumeOptions: [
        { value: '1-20', label: '1-20 habitaciones' },
        { value: '21-50', label: '21-50 habitaciones' },
        { value: '51-100', label: '51-100 habitaciones' },
        { value: '100+', label: 'Más de 100' },
      ],
    },
  },

  restaurantes: {
    slug: 'restaurantes',
    name: 'Restaurante',
    namePlural: 'Restaurantes',
    heroImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2070&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?auto=format&fit=crop&w=800&q=80',
    ],
    processImage: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=1200&q=80',
    textiles: ['Manteles', 'Servilletas', 'Uniformes de cocina', 'Delantales'],
    benefits: [
      'Manteles siempre blancos y planchados',
      'Recojo y entrega en tu local',
      'Servicio express para eventos',
      'Tratamiento especial para manchas de grasa',
    ],
    painPoints: [
      'Manchas de grasa que no salen',
      'Manteles amarillentos',
      'Uniformes con olor a cocina',
      'Entregas impuntuales',
    ],
    stats: [
      { value: '200+', label: 'Restaurantes' },
      { value: '95%', label: 'Manchas removidas' },
      { value: '24h', label: 'Servicio express' },
      { value: '0', label: 'Olor residual' },
    ],
    testimonial: {
      name: 'Patricia Vega',
      role: 'Dueña',
      company: 'Cevichería La Mar Brava',
      quote: 'Los manteles quedan perfectos, sin manchas de ají ni pescado. Mis clientes siempre comentan lo impecable de la mesa.',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/2,800/mes en lavandería local',
      after: 'S/1,900/mes con GetLavado',
      savings: '32%',
      location: 'Cevichería en San Isidro',
    },
    faq: [
      {
        question: '¿Pueden quitar manchas de grasa difíciles?',
        answer: 'Sí, usamos productos industriales especializados para manchas de grasa, vino y salsas. Tenemos 95% de éxito en manchas difíciles.',
      },
      {
        question: '¿Planchan los manteles?',
        answer: 'Sí, todos los manteles salen planchados y doblados, listos para usar. Sin costo adicional.',
      },
      {
        question: '¿Tienen servicio para eventos especiales?',
        answer: 'Sí, ofrecemos servicio express para eventos con entrega garantizada el mismo día.',
      },
      {
        question: '¿Cuántos manteles puedo enviar?',
        answer: 'No hay mínimo ni máximo. Nos adaptamos a tu volumen, desde 20 manteles hasta 500+ semanales.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Restaurantes en Lima | GetLavado',
      description: 'Lavandería especializada en restaurantes. Manteles impecables, servilletas perfectas, uniformes sin olor. Recojo y entrega. Ahorra hasta 35%.',
      keywords: ['lavandería restaurantes lima', 'lavado manteles restaurante', 'limpieza uniformes cocina', 'lavandería industrial gastronómica'],
    },
    formFields: {
      volumeLabel: 'Capacidad del local',
      volumeOptions: [
        { value: '1-30', label: '1-30 mesas' },
        { value: '31-60', label: '31-60 mesas' },
        { value: '61-100', label: '61-100 mesas' },
        { value: '100+', label: 'Más de 100 mesas' },
      ],
    },
  },

  clinicas: {
    slug: 'clinicas',
    name: 'Clínica',
    namePlural: 'Clínicas y Centros Médicos',
    heroImage: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=2070&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=800&q=80',
    ],
    processImage: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1200&q=80',
    textiles: ['Sábanas médicas', 'Batas', 'Uniformes', 'Campos quirúrgicos'],
    benefits: [
      'Desinfección certificada MINSA',
      'Protocolo para textiles contaminados',
      'Recojo hermético especializado',
      'Trazabilidad de cada pieza',
    ],
    painPoints: [
      'Manchas de sangre y fluidos',
      'Requisitos sanitarios estrictos',
      'Costos de esterilización altos',
      'Proveedores no certificados',
    ],
    stats: [
      { value: '50+', label: 'Clínicas' },
      { value: '100%', label: 'Desinfección' },
      { value: 'MINSA', label: 'Certificación' },
      { value: 'ISO', label: 'Calidad' },
    ],
    testimonial: {
      name: 'Dr. Roberto Sánchez',
      role: 'Director Médico',
      company: 'Clínica Estética Premium',
      quote: 'La certificación y trazabilidad que ofrecen nos da tranquilidad. Cumplimos todas las normas sin preocuparnos.',
      image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/4,500/mes con proveedor anterior',
      after: 'S/3,100/mes con GetLavado',
      savings: '31%',
      location: 'Clínica estética en San Borja',
    },
    faq: [
      {
        question: '¿Cumplen con normas sanitarias?',
        answer: 'Sí, nuestro proceso está certificado y cumple con las normas del MINSA para textiles médicos. Entregamos certificado de desinfección.',
      },
      {
        question: '¿Cómo manejan textiles contaminados?',
        answer: 'Tenemos protocolo especial con bolsas herméticas rojas, transporte separado y proceso de desinfección industrial.',
      },
      {
        question: '¿Pueden lavar campos quirúrgicos?',
        answer: 'Sí, lavamos y esterilizamos campos quirúrgicos, batas y todo tipo de textiles médicos.',
      },
      {
        question: '¿Tienen seguro?',
        answer: 'Sí, contamos con seguro de responsabilidad civil y certificados de calidad ISO.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Clínicas en Lima | GetLavado',
      description: 'Lavandería certificada para centros médicos. Desinfección industrial, cumplimiento MINSA, trazabilidad. Sábanas, batas y uniformes médicos.',
      keywords: ['lavandería clínicas lima', 'lavado textiles médicos', 'desinfección hospitalaria', 'lavandería hospitales perú'],
    },
    formFields: {
      volumeLabel: 'Tamaño de la clínica',
      volumeOptions: [
        { value: '1-10', label: '1-10 consultorios' },
        { value: '11-30', label: '11-30 consultorios' },
        { value: '31-50', label: '31-50 consultorios' },
        { value: '50+', label: 'Hospital / 50+ camas' },
      ],
    },
  },

  gimnasios: {
    slug: 'gimnasios',
    name: 'Gimnasio',
    namePlural: 'Gimnasios y Centros Fitness',
    heroImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=2070&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=800&q=80',
    ],
    processImage: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=1200&q=80',
    textiles: ['Toallas', 'Batas', 'Uniformes staff', 'Alfombras'],
    benefits: [
      'Eliminamos olor a sudor 100%',
      'Toallas siempre suaves y blancas',
      'Recojo diario disponible',
      'Precios especiales por volumen',
    ],
    painPoints: [
      'Toallas con olor persistente',
      'Desgaste rápido de textiles',
      'Alto volumen diario',
      'Clientes exigentes',
    ],
    stats: [
      { value: '80+', label: 'Gimnasios' },
      { value: '1000+', label: 'Toallas/día' },
      { value: '0%', label: 'Olor residual' },
      { value: '40%', label: 'Ahorro promedio' },
    ],
    testimonial: {
      name: 'Andrea Torres',
      role: 'Gerente General',
      company: 'FitLife Gym',
      quote: 'Nuestros socios notaron el cambio inmediatamente. Las toallas huelen increíble y están súper suaves.',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/4,200/mes en lavandería local',
      after: 'S/2,500/mes con GetLavado',
      savings: '40%',
      location: 'Gimnasio en Miraflores',
    },
    faq: [
      {
        question: '¿Pueden eliminar el olor a sudor?',
        answer: 'Sí, usamos proceso especial con ozono que elimina bacterias y olores al 100%. Las toallas quedan como nuevas.',
      },
      {
        question: '¿Ofrecen servicio diario?',
        answer: 'Sí, para gimnasios con alto tráfico ofrecemos recojo y entrega diaria sin costo adicional de logística.',
      },
      {
        question: '¿Cuántas toallas pueden procesar?',
        answer: 'Sin límite. Procesamos desde 50 hasta 1,000+ toallas diarias para cadenas de gimnasios.',
      },
      {
        question: '¿Las toallas mantienen la suavidad?',
        answer: 'Usamos suavizantes industriales que mantienen las toallas esponjosas por más tiempo que el lavado convencional.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Gimnasios en Lima | GetLavado',
      description: 'Lavandería especializada en gimnasios. Toallas sin olor, suaves y blancas. Servicio diario disponible. Ahorra hasta 40%.',
      keywords: ['lavandería gimnasios lima', 'lavado toallas gym', 'servicio lavandería fitness', 'limpieza textiles gimnasio'],
    },
    formFields: {
      volumeLabel: 'Tamaño del gimnasio',
      volumeOptions: [
        { value: 'pequeño', label: 'Boutique (hasta 100 socios)' },
        { value: 'mediano', label: 'Mediano (100-500 socios)' },
        { value: 'grande', label: 'Grande (500-1500 socios)' },
        { value: 'cadena', label: 'Cadena / Múltiples sedes' },
      ],
    },
  },

  spas: {
    slug: 'spas',
    name: 'Spa',
    namePlural: 'Spas y Centros de Bienestar',
    heroImage: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=2070&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?auto=format&fit=crop&w=800&q=80',
    ],
    processImage: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=1200&q=80',
    textiles: ['Toallas premium', 'Batas', 'Sábanas de camilla', 'Fundas'],
    benefits: [
      'Toallas extra suaves para spa',
      'Aroma neutro profesional',
      'Doblado especial presentación',
      'Tratamiento de aceites incluido',
    ],
    painPoints: [
      'Clientes muy exigentes',
      'Necesidad de suavidad extrema',
      'Manchas de aceites difíciles',
      'Presentación impecable requerida',
    ],
    stats: [
      { value: '40+', label: 'Spas premium' },
      { value: '5★', label: 'Calidad' },
      { value: '100%', label: 'Aceites removidos' },
      { value: 'Premium', label: 'Presentación' },
    ],
    testimonial: {
      name: 'Mónica Delgado',
      role: 'Directora',
      company: 'Zen Spa & Wellness',
      quote: 'La suavidad de las toallas es increíble. Nuestros clientes siempre comentan lo premium que se siente todo.',
      image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/3,200/mes lavando internamente',
      after: 'S/2,100/mes con GetLavado',
      savings: '34%',
      location: 'Spa en San Isidro',
    },
    faq: [
      {
        question: '¿Las toallas quedan realmente suaves?',
        answer: 'Usamos un proceso especial para spas con doble suavizante y secado controlado. Nuestros clientes dicen que sus usuarios notan la diferencia.',
      },
      {
        question: '¿Pueden quitar manchas de aceites?',
        answer: 'Sí, tenemos tratamiento pre-lavado especial para aceites de masaje, cera y productos cosméticos.',
      },
      {
        question: '¿Ofrecen doblado especial?',
        answer: 'Sí, ofrecemos doblado tipo hotel/spa con presentación premium sin costo adicional.',
      },
      {
        question: '¿Tienen experiencia con spas premium?',
        answer: 'Trabajamos con spas de hoteles 5 estrellas y centros de bienestar de alta gama en Lima.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Spas en Lima | GetLavado',
      description: 'Lavandería premium para spas. Toallas extra suaves, tratamiento de aceites, presentación impecable. La calidad que tus clientes merecen.',
      keywords: ['lavandería spas lima', 'lavado toallas spa', 'servicio lavandería wellness', 'textiles spa premium'],
    },
    formFields: {
      volumeLabel: 'Tamaño del spa',
      volumeOptions: [
        { value: 'pequeño', label: 'Boutique (1-3 cabinas)' },
        { value: 'mediano', label: 'Mediano (4-8 cabinas)' },
        { value: 'grande', label: 'Grande (9+ cabinas)' },
        { value: 'hotel', label: 'Spa de hotel' },
      ],
    },
  },

  'empresas-seguridad': {
    slug: 'empresas-seguridad',
    name: 'Empresa de Seguridad',
    namePlural: 'Empresas de Seguridad y Vigilancia',
    heroImage: 'https://images.unsplash.com/photo-1521791055366-0d553872125f?auto=format&fit=crop&w=2070&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1606761568499-6d2451b23c66?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    ],
    processImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
    textiles: ['Uniformes', 'Camisas', 'Pantalones', 'Chalecos'],
    benefits: [
      'Uniformes siempre presentables',
      'Planchado impecable incluido',
      'Entrega en múltiples sedes',
      'Reparaciones menores incluidas',
    ],
    painPoints: [
      'Personal en múltiples ubicaciones',
      'Uniformes que se ven gastados',
      'Alto costo de reposición',
      'Manchas de trabajo difíciles',
    ],
    stats: [
      { value: '30+', label: 'Empresas' },
      { value: '5000+', label: 'Uniformes/mes' },
      { value: 'Multi', label: 'Sedes' },
      { value: '100%', label: 'Planchado' },
    ],
    testimonial: {
      name: 'Jorge Ramírez',
      role: 'Gerente de Operaciones',
      company: 'Seguridad Total S.A.',
      quote: 'Manejan 200+ uniformes semanales en 5 sedes diferentes. Siempre puntuales y con calidad impecable.',
      image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/6,800/mes con lavandería fragmentada',
      after: 'S/4,200/mes centralizado con GetLavado',
      savings: '38%',
      location: 'Empresa de seguridad con 200+ agentes',
    },
    faq: [
      {
        question: '¿Pueden entregar en múltiples sedes?',
        answer: 'Sí, recogemos y entregamos en cada ubicación donde tengan personal. Coordinamos horarios por sede.',
      },
      {
        question: '¿El planchado está incluido?',
        answer: 'Sí, todos los uniformes van planchados y en gancho o doblados según prefieran.',
      },
      {
        question: '¿Manejan grandes volúmenes?',
        answer: 'Procesamos uniformes para empresas de 50 hasta 1,000+ empleados. Sin problema de capacidad.',
      },
      {
        question: '¿Pueden reparar uniformes?',
        answer: 'Sí, ofrecemos servicio de costura básica: botones, bastillas y reparaciones menores.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Empresas de Seguridad | GetLavado',
      description: 'Lavandería especializada en uniformes de seguridad. Planchado impecable, entrega en múltiples sedes. Más de 200 empresas confían en nosotros.',
      keywords: ['lavandería uniformes seguridad', 'lavado uniformes vigilancia', 'servicio lavandería empresas seguridad lima'],
    },
    formFields: {
      volumeLabel: 'Número de empleados',
      volumeOptions: [
        { value: '1-50', label: '1-50 empleados' },
        { value: '51-150', label: '51-150 empleados' },
        { value: '151-300', label: '151-300 empleados' },
        { value: '300+', label: 'Más de 300 empleados' },
      ],
    },
  },

  edificios: {
    slug: 'edificios',
    name: 'Edificio',
    namePlural: 'Edificios y Condominios',
    heroImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2070&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
    ],
    processImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
    textiles: ['Uniformes de personal', 'Cortinas áreas comunes', 'Alfombras', 'Manteles eventos'],
    benefits: [
      'Servicio integral áreas comunes',
      'Uniformes de todo el staff',
      'Retiro e instalación de cortinas',
      'Facturación a administración',
    ],
    painPoints: [
      'Personal con uniformes gastados',
      'Cortinas de lobby sucias',
      'Alfombras con manchas',
      'Múltiples proveedores',
    ],
    stats: [
      { value: '60+', label: 'Edificios' },
      { value: 'Todo', label: 'Incluido' },
      { value: 'RUC', label: 'Facturación' },
      { value: '33%', label: 'Ahorro' },
    ],
    testimonial: {
      name: 'Luis García',
      role: 'Administrador',
      company: 'Edificio Parque Central',
      quote: 'Un solo proveedor para todo: uniformes, cortinas, alfombras. Simplificó nuestra operación y ahorramos dinero.',
      image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80',
    },
    caseStudy: {
      before: 'S/1,800/mes con múltiples proveedores',
      after: 'S/1,200/mes todo centralizado',
      savings: '33%',
      location: 'Edificio residencial en San Isidro',
    },
    faq: [
      {
        question: '¿Lavan cortinas de áreas comunes?',
        answer: 'Sí, lavamos cortinas, alfombras, manteles de sala de eventos y todo textil de áreas comunes.',
      },
      {
        question: '¿Facturan a la administración?',
        answer: 'Sí, emitimos factura a nombre del edificio o la administradora. RUC empresarial.',
      },
      {
        question: '¿Con qué frecuencia recomiendan el servicio?',
        answer: 'Uniformes: semanal. Cortinas: mensual o bimensual. Alfombras: según tráfico.',
      },
      {
        question: '¿Pueden retirar e instalar cortinas?',
        answer: 'Sí, ofrecemos servicio completo de retiro e instalación de cortinas sin costo adicional.',
      },
    ],
    seo: {
      title: 'Lavandería Industrial para Edificios y Condominios | GetLavado',
      description: 'Servicio de lavandería para edificios residenciales y comerciales. Uniformes, cortinas, alfombras. Facturación a administración.',
      keywords: ['lavandería edificios lima', 'lavado uniformes conserje', 'limpieza cortinas edificio', 'servicio lavandería condominios'],
    },
    formFields: {
      volumeLabel: 'Tipo de edificio',
      volumeOptions: [
        { value: 'residencial-pequeño', label: 'Residencial (hasta 50 dptos)' },
        { value: 'residencial-grande', label: 'Residencial (50+ dptos)' },
        { value: 'oficinas', label: 'Edificio de oficinas' },
        { value: 'mixto', label: 'Uso mixto / Centro comercial' },
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
