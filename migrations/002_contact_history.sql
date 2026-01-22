-- Migración: Tabla de historial de contactos para tracking de follow-ups
-- Ejecutar en Supabase Dashboard > SQL Editor

-- Tabla de historial de contactos
CREATE TABLE IF NOT EXISTS contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('whatsapp', 'email', 'call')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para contact_history
CREATE INDEX IF NOT EXISTS idx_contact_history_business ON contact_history(business_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_user ON contact_history(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_created ON contact_history(created_at DESC);

-- Habilitar RLS para contact_history
ALTER TABLE contact_history ENABLE ROW LEVEL SECURITY;

-- Política permisiva para desarrollo
CREATE POLICY "Allow all for contact_history" ON contact_history FOR ALL USING (true) WITH CHECK (true);
