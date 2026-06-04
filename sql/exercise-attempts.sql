-- ============================================================
-- KINNOS — Registro de intentos de ejercicios por alumno
-- ============================================================

CREATE TABLE IF NOT EXISTS student_exercise_attempts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid        NOT NULL REFERENCES students(id)          ON DELETE CASCADE,
  exercise_id    uuid        NOT NULL REFERENCES unit_exercises(id)    ON DELETE CASCADE,
  is_correct     boolean,
  student_answer text,
  attempted_at   timestamptz DEFAULT now(),
  UNIQUE(student_id, exercise_id)   -- solo se guarda el primer intento
);

ALTER TABLE student_exercise_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_attempts" ON student_exercise_attempts;
CREATE POLICY "anon_select_attempts" ON student_exercise_attempts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_attempts" ON student_exercise_attempts;
CREATE POLICY "anon_insert_attempts" ON student_exercise_attempts
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_attempts" ON student_exercise_attempts;
CREATE POLICY "anon_update_attempts" ON student_exercise_attempts
  FOR UPDATE USING (true);
