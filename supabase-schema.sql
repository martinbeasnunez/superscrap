-- SuperScrap Database Schema
-- Ejecutar este SQL en Supabase Dashboard > SQL Editor

-- Tabla de búsquedas
CREATE TABLE searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type TEXT NOT NULL,
  city TEXT NOT NULL,
  required_services TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_results INTEGER DEFAULT 0,
  matching_results INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Tabla de negocios encontrados
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES searches(id) ON DELETE CASCADE,
  external_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  rating DECIMAL(2,1),
  reviews_count INTEGER,
  description TEXT,
  website TEXT,
  thumbnail_url TEXT,
  coordinates JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de análisis de servicios
CREATE TABLE service_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  detected_services TEXT[],
  confidence_score DECIMAL(3,2),
  evidence TEXT,
  matches_requirements BOOLEAN DEFAULT FALSE,
  match_percentage DECIMAL(3,2),
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX idx_searches_status ON searches(status);
CREATE INDEX idx_searches_created ON searches(created_at DESC);
CREATE INDEX idx_businesses_search ON businesses(search_id);
CREATE INDEX idx_analyses_business ON service_analyses(business_id);

-- Habilitar RLS (Row Level Security) - Opcional pero recomendado
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_analyses ENABLE ROW LEVEL SECURITY;

-- Tabla de historial de contactos (para tracking de follow-ups)
CREATE TABLE contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('whatsapp', 'email', 'call')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para contact_history
CREATE INDEX idx_contact_history_business ON contact_history(business_id);
CREATE INDEX idx_contact_history_user ON contact_history(user_id);
CREATE INDEX idx_contact_history_created ON contact_history(created_at DESC);

-- Habilitar RLS para contact_history
ALTER TABLE contact_history ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para desarrollo (acceso público con anon key)
CREATE POLICY "Allow all for searches" ON searches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for businesses" ON businesses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_analyses" ON service_analyses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for contact_history" ON contact_history FOR ALL USING (true) WITH CHECK (true);
