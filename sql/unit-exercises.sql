-- ============================================================
-- KINNOS — Ejercicios por unidad
-- ============================================================

CREATE TABLE IF NOT EXISTS unit_exercises (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id           uuid        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  order_num         integer     NOT NULL,
  type              text        NOT NULL CHECK (type IN ('solve', 'find_error')),
  statement         text        NOT NULL,
  answer            text,
  answer_numeric    numeric,
  tolerance         numeric     DEFAULT 0.05,
  has_error         boolean     DEFAULT false,
  error_explanation text,
  solution_steps    jsonb,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE unit_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_exercises" ON unit_exercises;
CREATE POLICY "anon_select_exercises" ON unit_exercises
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_exercises" ON unit_exercises;
CREATE POLICY "anon_insert_exercises" ON unit_exercises
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_exercises" ON unit_exercises;
CREATE POLICY "anon_update_exercises" ON unit_exercises
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "anon_delete_exercises" ON unit_exercises;
CREATE POLICY "anon_delete_exercises" ON unit_exercises
  FOR DELETE USING (true);
