import { PotentialScore, PotentialTier } from '@/types';

// ===================== INDUSTRY DETECTION =====================

export type IndustryCategory =
  | 'hotel_luxury'     // 5 estrellas, resort
  | 'hotel_mid'        // 4 estrellas, boutique
  | 'hotel_budget'     // 3 estrellas, hostal
  | 'hospital'         // hospital, clinica grande
  | 'clinic'           // clinica, centro medico
  | 'club'             // country club, golf, tennis
  | 'spa_premium'      // hotel spa, premium
  | 'spa_basic'        // spa, masajes, sauna
  | 'gym_premium'      // cadena, premium, crossfit grande
  | 'gym_basic'        // gym pequeno
  | 'pilates'          // estudio de pilates, reformer
  | 'restaurant_gourmet' // gourmet, autor, steakhouse
  | 'restaurant_mid'   // cevicheria, standard
  | 'security'         // empresa de seguridad
  | 'cleaning'         // empresa de limpieza
  | 'industrial'       // fabrica, planta, laboratorio
  | 'events'           // salon de eventos, catering
  | 'residence'        // casa de reposo, geriatrica
  | 'university'       // universidad, instituto
  | 'cooperative'      // cooperativa
  | 'real_estate'      // inmobiliaria
  | 'other';

export function detectIndustry(businessType: string | null, name: string): IndustryCategory {
  const type = (businessType || '').toLowerCase();
  const nameLower = name.toLowerCase();
  const combined = `${type} ${nameLower}`;

  // Hotels - check star rating first
  if (combined.includes('5 estrellas') || combined.includes('resort') || combined.includes('cinco estrellas'))
    return 'hotel_luxury';
  if (combined.includes('4 estrellas') || combined.includes('cuatro estrellas'))
    return 'hotel_mid';
  if (combined.includes('3 estrellas') || combined.includes('hostal') || combined.includes('tres estrellas') || combined.includes('apart-hotel') || combined.includes('apart hotel'))
    return 'hotel_budget';
  if (combined.includes('boutique') && combined.includes('hotel'))
    return 'hotel_mid';
  if (combined.includes('hotel'))
    return 'hotel_mid'; // Default hotel without star rating

  // Health
  if (combined.includes('hospital'))
    return 'hospital';
  if (combined.includes('clinic') || combined.includes('clínica') || combined.includes('centro medico') || combined.includes('centro médico') || combined.includes('policlinic') || combined.includes('policlínic') || combined.includes('estética') || combined.includes('estetica') || combined.includes('dental') || combined.includes('dermatolog'))
    return 'clinic';

  // Clubs
  if (combined.includes('country club') || combined.includes('club de golf') || combined.includes('golf club') || combined.includes('club de tenis') || combined.includes('tennis club') || combined.includes('club deportivo') || combined.includes('sports club'))
    return 'club';

  // Spas - check premium first
  if ((combined.includes('spa') && (combined.includes('premium') || combined.includes('luxury') || combined.includes('hotel'))))
    return 'spa_premium';
  if (combined.includes('spa') || combined.includes('masaje') || combined.includes('massage') || combined.includes('sauna') || combined.includes('day spa'))
    return 'spa_basic';

  // Pilates - check before gyms so estudios de pilates no caen en gym_basic
  if (combined.includes('pilates') || combined.includes('reformer'))
    return 'pilates';

  // Gyms
  if ((combined.includes('gym') || combined.includes('gimnasio')) && (combined.includes('premium') || combined.includes('cadena')))
    return 'gym_premium';
  if (combined.includes('crossfit') || combined.includes('fitness'))
    return 'gym_premium';
  if (combined.includes('gym') || combined.includes('gimnasio'))
    return 'gym_basic';

  // Restaurants
  if (combined.includes('gourmet') || combined.includes('de autor') || combined.includes('steakhouse') || combined.includes('japones') || combined.includes('japonés') || combined.includes('italiano') || combined.includes('nikkei'))
    return 'restaurant_gourmet';
  if (combined.includes('restaurante') || combined.includes('restaurant') || combined.includes('cevich') || combined.includes('comida'))
    return 'restaurant_mid';

  // Security
  if (combined.includes('seguridad') || combined.includes('vigilancia') || combined.includes('resguardo'))
    return 'security';

  // Cleaning
  if (combined.includes('limpieza') || combined.includes('facility') || combined.includes('aseo') || combined.includes('cleaning'))
    return 'cleaning';

  // Industrial
  if (combined.includes('fabrica') || combined.includes('fábrica') || combined.includes('planta') || combined.includes('laboratorio') || combined.includes('farmac') || combined.includes('industria') || combined.includes('minera') || combined.includes('petrolera') || combined.includes('manufactur'))
    return 'industrial';

  // Events
  if (combined.includes('evento') || combined.includes('convenciones') || combined.includes('catering') || combined.includes('banquete'))
    return 'events';

  // Residences
  if (combined.includes('reposo') || combined.includes('geriatric') || combined.includes('geriátric') || combined.includes('anciano') || combined.includes('residencia'))
    return 'residence';

  // Universities
  if (combined.includes('universidad') || combined.includes('university') || combined.includes('instituto') || combined.includes('educativ'))
    return 'university';

  // Cooperatives
  if (combined.includes('cooperativa') || combined.includes('cooperative') || combined.includes('coopac'))
    return 'cooperative';

  // Real estate
  if (combined.includes('inmobiliaria') || combined.includes('inmobiliario') || combined.includes('real estate') || combined.includes('bienes raices') || combined.includes('bienes raíces'))
    return 'real_estate';

  return 'other';
}

// ===================== PREMIUM DISTRICTS =====================

const PREMIUM_DISTRICTS = [
  'miraflores', 'san isidro', 'barranco', 'la molina',
  'san borja', 'surco', 'santiago de surco'
];

function isPremiumDistrict(address: string | null): boolean {
  if (!address) return false;
  const lower = address.toLowerCase();
  return PREMIUM_DISTRICTS.some(d => lower.includes(d));
}

// ===================== SIZE INDICATORS =====================

function detectSizeIndicators(name: string): { points: number; signal: string } {
  const upper = name.toUpperCase();

  if (upper.includes('CORP') || upper.includes('GROUP') || upper.includes('GRUPO'))
    return { points: 25, signal: 'Corp/Group en nombre (+25)' };
  if (upper.includes(' SA ') || upper.includes(' S.A.') || upper.includes(' S.A '))
    return { points: 20, signal: 'SA en nombre (+20)' };
  if (upper.includes('LABORATORIOS') || upper.includes('INDUSTRIAS') || upper.includes('CORPORACION') || upper.includes('CORPORACIÓN'))
    return { points: 20, signal: 'Corporación/Industrias (+20)' };
  if (upper.includes(' SAC') || upper.includes(' S.A.C'))
    return { points: 15, signal: 'SAC en nombre (+15)' };
  if (upper.includes(' SRL') || upper.includes(' S.R.L'))
    return { points: 10, signal: 'SRL en nombre (+10)' };
  if (upper.includes(' EIRL') || upper.includes(' E.I.R.L'))
    return { points: 5, signal: 'EIRL en nombre (+5)' };

  return { points: 0, signal: '' };
}

// ===================== SCORING MATRIX =====================

interface ScoringInput {
  name: string;
  businessType: string | null;
  rating: number | null;
  reviewsCount: number | null;
  address: string | null;
}

const INDUSTRY_SCORES: Record<IndustryCategory, { base: number; label: string }> = {
  hotel_luxury:        { base: 45, label: 'Hotel 5 estrellas' },
  hotel_mid:           { base: 30, label: 'Hotel 4 estrellas' },
  hotel_budget:        { base: 15, label: 'Hotel 3 estrellas / Hostal' },
  hospital:            { base: 40, label: 'Hospital' },
  clinic:              { base: 20, label: 'Clínica / Centro médico' },
  club:                { base: 35, label: 'Country club / Club deportivo' },
  spa_premium:         { base: 25, label: 'Spa premium' },
  spa_basic:           { base: 12, label: 'Spa / Masajes' },
  gym_premium:         { base: 25, label: 'Gimnasio premium / Cadena' },
  gym_basic:           { base: 10, label: 'Gimnasio pequeño' },
  pilates:             { base: 12, label: 'Estudio de Pilates' },
  restaurant_gourmet:  { base: 25, label: 'Restaurante gourmet' },
  restaurant_mid:      { base: 12, label: 'Restaurante' },
  security:            { base: 30, label: 'Empresa de seguridad' },
  cleaning:            { base: 25, label: 'Empresa de limpieza' },
  industrial:          { base: 35, label: 'Industrial / Fábrica' },
  events:              { base: 20, label: 'Eventos / Catering' },
  residence:           { base: 20, label: 'Residencia / Casa de reposo' },
  university:          { base: 30, label: 'Universidad / Instituto' },
  cooperative:         { base: 20, label: 'Cooperativa' },
  real_estate:         { base: 20, label: 'Inmobiliaria' },
  other:               { base: 10, label: 'Otro tipo de negocio' },
};

export function calculatePotentialScore(input: ScoringInput): PotentialScore {
  const industry = detectIndustry(input.businessType, input.name);
  const signals: string[] = [];
  let score = 0;

  // ---- INDUSTRY BASE SCORE ----
  const industryInfo = INDUSTRY_SCORES[industry];
  score += industryInfo.base;
  signals.push(`${industryInfo.label} (+${industryInfo.base})`);

  // ---- REVIEWS AS SIZE PROXY ----
  if (input.reviewsCount !== null && input.reviewsCount > 0) {
    if (input.reviewsCount >= 500) {
      score += 25;
      signals.push(`${input.reviewsCount} reseñas - gran volumen (+25)`);
    } else if (input.reviewsCount >= 200) {
      score += 18;
      signals.push(`${input.reviewsCount} reseñas - alto tráfico (+18)`);
    } else if (input.reviewsCount >= 100) {
      score += 12;
      signals.push(`${input.reviewsCount} reseñas - buen tráfico (+12)`);
    } else if (input.reviewsCount >= 50) {
      score += 8;
      signals.push(`${input.reviewsCount} reseñas - tráfico moderado (+8)`);
    } else if (input.reviewsCount >= 20) {
      score += 4;
      signals.push(`${input.reviewsCount} reseñas (+4)`);
    }
  }

  // ---- RATING QUALITY SIGNAL ----
  if (input.rating !== null && input.rating > 0) {
    if (input.rating >= 4.5) {
      score += 5;
      signals.push(`Rating ${input.rating} - premium (+5)`);
    } else if (input.rating >= 4.0) {
      score += 3;
      signals.push(`Rating ${input.rating} (+3)`);
    } else if (input.rating < 3.5) {
      score -= 5;
      signals.push(`Rating bajo ${input.rating} (-5)`);
    }
  }

  // ---- PREMIUM DISTRICT ----
  if (isPremiumDistrict(input.address)) {
    score += 10;
    signals.push('Distrito premium (+10)');
  }

  // ---- COMPANY SIZE FROM NAME ----
  const sizeInfo = detectSizeIndicators(input.name);
  if (sizeInfo.points > 0) {
    score += sizeInfo.points;
    signals.push(sizeInfo.signal);
  }

  // ---- CLAMP SCORE ----
  score = Math.max(0, Math.min(100, score));

  // ---- REVENUE ESTIMATION (facturación mensual según tamaño/score) ----
  const revenue = estimateRevenue(score);

  // ---- DETERMINE TIER ----
  // Regla de negocio (Martín, GM): orca = potencial de S/2,500/mes o más.
  // Se decide por la facturación estimada (su punto medio), no por un score abstracto.
  const revenueMid = (revenue.min + revenue.max) / 2;
  let tier: PotentialTier;
  if (revenueMid >= 2500) {
    tier = 'orca';
  } else if (score >= 20) {
    tier = 'delfin';
  } else {
    tier = 'unknown';
  }

  return {
    score,
    tier,
    revenue,
    signals,
    industry: industryInfo.label,
  };
}

// Facturación mensual estimada de lavandería según el tamaño/calidad del negocio
// (score). Independiente del tier — el tier se deriva DESPUÉS con el umbral de
// S/2,500. El piso de orca cae alrededor de score 38.
function estimateRevenue(
  score: number,
): { min: number; max: number; label: string } {
  if (score >= 78) return { min: 8000, max: 15000, label: 'S/8,000 - S/15,000' };
  if (score >= 65) return { min: 5000, max: 10000, label: 'S/5,000 - S/10,000' };
  if (score >= 55) return { min: 4000, max: 7000,  label: 'S/4,000 - S/7,000' };
  if (score >= 45) return { min: 2800, max: 5000,  label: 'S/2,800 - S/5,000' };
  if (score >= 38) return { min: 2500, max: 4000,  label: 'S/2,500 - S/4,000' };
  if (score >= 30) return { min: 1500, max: 2600,  label: 'S/1,500 - S/2,600' };
  if (score >= 20) return { min: 800,  max: 1800,  label: 'S/800 - S/1,800' };
  return { min: 0, max: 600, label: 'S/0 - S/600' };
}
