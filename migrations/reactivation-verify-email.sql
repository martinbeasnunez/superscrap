-- ============================================================
-- Migration 015: Reactivación B2B — verificación Tier A + correo
-- ============================================================
-- #3 Handoff Joaquín → Fernanda: la verificación de Tier A ahora se PERSISTE
--    (verified_at/verified_by), así cuando Joaquín confirma, Fernanda lo ve
--    habilitado en su sesión. Antes era un candado local que no cruzaba.
-- #1 email: canal alterno cuando el teléfono está viejo.
--
-- CORRER A MANO en Supabase Dashboard → SQL Editor.
-- ============================================================

ALTER TABLE reactivation_clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE reactivation_clients ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE reactivation_clients ADD COLUMN IF NOT EXISTS verified_by TEXT;
