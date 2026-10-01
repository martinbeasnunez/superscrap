-- Migration 018: Reactivación B2B — resumen mensual (marcador por mes)
CREATE TABLE IF NOT EXISTS reactivation_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL UNIQUE,
  label TEXT NOT NULL,
  clients INT, control INT, contacted INT, contacted_wa INT, contacted_call INT,
  second_touch INT, untouched INT,
  recovered_real INT, recovered_marked INT, revenue_recovered NUMERIC, control_returned INT,
  verdict TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE reactivation_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all reactivation_monthly" ON reactivation_monthly FOR ALL USING (true) WITH CHECK (true);
