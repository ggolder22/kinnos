-- ============================================================
-- KINNOS — Planificaciones de materias
-- ============================================================

CREATE TABLE IF NOT EXISTS subject_plannings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id   uuid        NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  subject_id     uuid        NOT NULL REFERENCES subjects(id)   ON DELETE CASCADE,
  anio_academico integer     NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  fundamentacion text,
  objetivos      text,
  contenidos     text,
  metodologia    text,
  evaluacion     text,
  bibliografia   text,
  cronograma     text,
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(professor_id, subject_id, anio_academico)
);

ALTER TABLE subject_plannings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_plannings" ON subject_plannings;
CREATE POLICY "anon_select_plannings" ON subject_plannings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_plannings" ON subject_plannings;
CREATE POLICY "anon_insert_plannings" ON subject_plannings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_plannings" ON subject_plannings;
CREATE POLICY "anon_update_plannings" ON subject_plannings
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "anon_delete_plannings" ON subject_plannings;
CREATE POLICY "anon_delete_plannings" ON subject_plannings
  FOR DELETE USING (true);
