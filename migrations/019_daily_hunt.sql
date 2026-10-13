-- ============================================================
-- Migration 019: Caza diaria (flujo agéntico de leads) — CORRER A MANO
-- ============================================================
-- Cada mañana la rutina propone hasta 10 orcas nuevas para empezar a trabajar.
-- hunt_runs  = una corrida (qué apuestas eligió el estratega y qué rindieron).
-- hunt_leads = cada lead propuesto + su brief + la decisión humano/bot.
-- Los leads entran a `businesses` con auto_followup_enabled = FALSE: el bot NO
-- les escribe hasta que alguien elige "bot" en la lista "Today's hunt".
--
-- CORRER A MANO en Supabase Dashboard → SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS hunt_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_date DATE NOT NULL,
  objective TEXT NOT NULL DEFAULT 'orcas',
  quota INTEGER,
  -- [{ rubro, zona, why, found, duplicates, below_orca, saved }]
  theses JSONB,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hunt_runs_date ON hunt_runs(hunt_date DESC);

CREATE TABLE IF NOT EXISTS hunt_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES hunt_runs(id) ON DELETE SET NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  hunt_date DATE NOT NULL,
  rank INTEGER,
  -- La apuesta que lo generó ("hotel boutique × Barranco"): sirve para medir qué apuestas rinden.
  thesis TEXT,
  -- 'nuevo' = recién scrapeado · 'rescate' = orca que ya estaba en ORBIT sin trabajar
  origin TEXT NOT NULL DEFAULT 'nuevo' CHECK (origin IN ('nuevo', 'rescate')),
  why TEXT,
  decision_maker TEXT,
  angle TEXT,
  draft_message TEXT,
  suggested_route TEXT CHECK (suggested_route IN ('humano', 'bot')),
  -- NULL = pendiente de decidir
  decision TEXT CHECK (decision IN ('humano', 'bot', 'descartado')),
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  discard_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un negocio se propone una sola vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_hunt_leads_business ON hunt_leads(business_id);
CREATE INDEX IF NOT EXISTS idx_hunt_leads_date ON hunt_leads(hunt_date DESC);
CREATE INDEX IF NOT EXISTS idx_hunt_leads_pending ON hunt_leads(decision) WHERE decision IS NULL;

ALTER TABLE hunt_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for hunt_runs" ON hunt_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for hunt_leads" ON hunt_leads FOR ALL USING (true) WITH CHECK (true);
