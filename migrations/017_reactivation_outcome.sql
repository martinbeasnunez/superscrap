-- Migration 017: Reactivación B2B — resultado (vivo / octubre / muerto)
ALTER TABLE reactivation_clients ADD COLUMN IF NOT EXISTS outcome TEXT
  CHECK (outcome IN ('vivo','octubre','muerto'));
CREATE INDEX IF NOT EXISTS idx_reactivation_outcome ON reactivation_clients(outcome) WHERE outcome IS NOT NULL;
