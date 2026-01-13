export interface Search {
  id: string;
  business_type: string;
  city: string;
  required_services: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_results: number;
  matching_results: number;
  created_at: string;
  completed_at: string | null;
}

export interface DecisionMaker {
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  position: string | null;
  seniority: string | null;
  department: string | null;
  confidence: number;
  linkedin: string | null;
  phone: string | null;
}

export interface Business {
  id: string;
  search_id: string;
  external_id: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  rating: number | null;
  reviews_count: number | null;
  description: string | null;
  website: string | null;
  thumbnail_url: string | null;
  coordinates: { lat: number; lng: number } | null;
  contact_status: 'whatsapp' | 'called' | 'contacted' | null;
  contacted_at: string | null;
  decision_makers: DecisionMaker[] | null;
  created_at: string;
}

export interface ServiceAnalysis {
  id: string;
  business_id: string;
  detected_services: string[];
  confidence_score: number;
  evidence: string | null;
  matches_requirements: boolean;
  match_percentage: number;
  analyzed_at: string;
}

export interface BusinessWithAnalysis extends Business {
  analysis: ServiceAnalysis | null;
}

export interface SearchWithResults extends Search {
  businesses: BusinessWithAnalysis[];
}

export interface SerpAPILocalResult {
  position: number;
  title: string;
  place_id: string;
  data_id: string;
  data_cid: string;
  reviews_link: string;
  photos_link: string;
  gps_coordinates: { latitude: number; longitude: number };
  place_id_search: string;
  rating: number;
  reviews: number;
  price: string;
  type: string;
  types: string[];
  address: string;
  open_state: string;
  hours: string;
  operating_hours: Record<string, string>;
  phone: string;
  website: string;
  description: string;
  service_options: Record<string, boolean>;
  thumbnail: string;
}

export interface OpenAIAnalysisResponse {
  detected_services: string[];
  confidence: number;
  evidence: string;
}
