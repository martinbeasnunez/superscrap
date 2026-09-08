-- ============================================================
-- Migration 014: Reactivación B2B — contacto + marca por ficha
-- ============================================================
-- Fase 2: los guiones/mensajes viven en cada ficha. Necesitamos
--  - contact_name: nombre de la persona ({contacto} en las plantillas;
--    si está vacío se usa el nombre de la empresa).
--  - brand: la marca que se usa en los textos (default "Lavado"),
--    editable por si con ese cliente usan otro nombre.
--
-- CORRER A MANO en Supabase Dashboard → SQL Editor.
-- ============================================================

ALTER TABLE reactivation_clients ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE reactivation_clients ADD COLUMN IF NOT EXISTS brand TEXT;
