-- ============================================================
-- Migration 016: Reactivación B2B — "Reconectar el [fecha]"
-- ============================================================
-- La mayoría de clientes dice "el próximo mes". Guardamos ESA fecha para
-- volver a contactarlos cuando toca, y que aparezcan solos en "Para hoy".
-- CORRER A MANO en Supabase Dashboard → SQL Editor.
-- ============================================================
ALTER TABLE reactivation_clients ADD COLUMN IF NOT EXISTS recontact_date DATE;
CREATE INDEX IF NOT EXISTS idx_reactivation_recontact ON reactivation_clients(recontact_date) WHERE recontact_date IS NOT NULL;
