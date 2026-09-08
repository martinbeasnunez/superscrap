-- ============================================================
-- Migration 013: Reactivación B2B (Misión 2)
-- ============================================================
-- Módulo de reactivación de clientes empresa que dejaron de pedir.
-- Fuente única de verdad dentro de ORBIT (antes vivía en Excel suelto).
-- Re-importable cada mes sin duplicar: match por teléfono (phone_norm).
--
-- CORRER A MANO en Supabase Dashboard → SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS reactivation_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identidad / datos del cliente (se actualizan en cada import)
  company           TEXT NOT NULL,
  phone             TEXT,
  phone_norm        TEXT UNIQUE,          -- solo dígitos; llave de deduplicación
  last_order_date   DATE,
  days_inactive     INT,
  total_orders      INT,
  tier              TEXT CHECK (tier IN ('A','B','C')),
  segment           TEXT,                 -- texto crudo "Tier / Segmento"
  priority          TEXT CHECK (priority IN ('alta','media','fria')),
  owner             TEXT,                 -- Fernanda / Joaquín
  is_control        BOOLEAN DEFAULT FALSE, -- grupo de control: NO se contacta
  needs_verify      BOOLEAN DEFAULT FALSE, -- Tier A a revisar antes de escribir
  list_type         TEXT DEFAULT 'reactivacion'
                      CHECK (list_type IN ('reactivacion','primera_recompra','excluir')),

  -- Progreso de campaña (NO se pisa al re-importar)
  touch1_date       DATE,
  touch1_channel    TEXT CHECK (touch1_channel IN ('whatsapp','call')),
  touch2_date       DATE,
  touch2_channel    TEXT CHECK (touch2_channel IN ('whatsapp','call')),
  responded         BOOLEAN,
  reserved          BOOLEAN,
  discount_pct      INT DEFAULT 10,        -- sugerido 10%, tope 15%
  status            TEXT DEFAULT 'pendiente'
                      CHECK (status IN ('pendiente','toque1','respondio','reservo','no_reservo')),
  notes             TEXT,

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reactivation_list_type ON reactivation_clients(list_type);
CREATE INDEX IF NOT EXISTS idx_reactivation_status    ON reactivation_clients(status);
CREATE INDEX IF NOT EXISTS idx_reactivation_owner     ON reactivation_clients(owner);

-- RLS: mismo patrón permisivo que el resto de tablas (la app usa anon key).
ALTER TABLE reactivation_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for reactivation_clients" ON reactivation_clients
  FOR ALL USING (true) WITH CHECK (true);
