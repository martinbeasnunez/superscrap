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

-- ============================================================
-- Migration 003: Orca/Delfin Potential Scoring
-- ============================================================
ALTER TABLE service_analyses
  ADD COLUMN potential_score INTEGER,
  ADD COLUMN potential_tier TEXT CHECK (potential_tier IN ('orca', 'delfin', 'unknown')),
  ADD COLUMN estimated_revenue_min INTEGER,
  ADD COLUMN estimated_revenue_max INTEGER,
  ADD COLUMN potential_signals TEXT[];

CREATE INDEX idx_analyses_tier ON service_analyses(potential_tier);

-- ============================================================
-- Migration 004: Enable RLS on users table (security fix)
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for users" ON users FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Migration 005: ORBIT v2 - Dedup, DM focus, Auto followup
-- ============================================================

-- Dedup: unique index on external_id (exclude paginas amarillas synthetic IDs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_external_id_unique
  ON businesses(external_id) WHERE external_id IS NOT NULL AND external_id NOT LIKE 'pa-%';

-- Dedup: phone index for fast lookup
CREATE INDEX IF NOT EXISTS idx_businesses_phone ON businesses(phone) WHERE phone IS NOT NULL;

-- Email template tracking
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS last_email_template_id TEXT;

-- Primary decision maker index
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS primary_dm_index INTEGER DEFAULT NULL;

-- Auto follow-up via Kapso
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS auto_followup_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS auto_followup_last_sent TIMESTAMPTZ;

-- Extend contact_history action types for auto WhatsApp + replies
ALTER TABLE contact_history DROP CONSTRAINT IF EXISTS contact_history_action_type_check;
ALTER TABLE contact_history ADD CONSTRAINT contact_history_action_type_check
  CHECK (action_type IN ('whatsapp', 'email', 'call', 'ai_call', 'stage_change', 'auto_whatsapp', 'whatsapp_reply'));

-- Free-text notes per lead (why lost, additional comments, internal context)
-- Visible in the lead detail modal, edited inline.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS notes TEXT;
