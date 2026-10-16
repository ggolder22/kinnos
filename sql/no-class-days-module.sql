-- ═══════════════════════════════════════════════════
--  Calendario de días sin clase — Kinnos
--  Un día cargado acá (feriado, corte de servicio, etc.) bloquea la
--  ventana de asistencia de TODA la institución, en TODAS las materias,
--  ese día. Lo carga el preceptor — con anticipación (feriados) o el
--  mismo día (algo imprevisto).
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS no_class_days (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE NOT NULL,
  day_date       date NOT NULL,
  reason         text,              -- ej: "Corte de agua de red", "Feriado nacional"
  created_by     uuid REFERENCES preceptors(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(institution_id, day_date)
);

CREATE INDEX IF NOT EXISTS idx_no_class_days_institution ON no_class_days(institution_id, day_date);

ALTER TABLE no_class_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_no_class_days" ON no_class_days;
CREATE POLICY "anon_all_no_class_days"
  ON no_class_days FOR ALL TO anon USING (true) WITH CHECK (true);
