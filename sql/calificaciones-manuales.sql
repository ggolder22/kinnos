-- ═══════════════════════════════════════════════════
--  Calificaciones manuales — Kinnos
--  Notas que el profesor carga directamente por materia (parcial en
--  papel, nota conceptual, etc.), sin pasar por el generador de
--  exámenes de la app. Independiente de `exams`/`exam_results`.
-- ═══════════════════════════════════════════════════

-- 1. Instancia de evaluación (ej: "Parcial 1", "Concepto 1er cuatrimestre")
CREATE TABLE IF NOT EXISTS manual_grade_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('numerica', 'conceptual')),
  fecha       date,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_grade_items_subject ON manual_grade_items(subject_id);

-- 2. Nota de un alumno en una instancia
CREATE TABLE IF NOT EXISTS manual_grades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         uuid NOT NULL REFERENCES manual_grade_items(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score           numeric(4,1),  -- 0 a 10, para tipo 'numerica'
  concepto        text,          -- ej: "Muy Bueno", para tipo 'conceptual'
  observaciones   text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_manual_grades_student ON manual_grades(student_id);

-- ── RLS (mismo esquema que el resto de los módulos) ──
ALTER TABLE manual_grade_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_grades      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_manual_grade_items" ON manual_grade_items;
CREATE POLICY "anon_all_manual_grade_items"
  ON manual_grade_items FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_manual_grades" ON manual_grades;
CREATE POLICY "anon_all_manual_grades"
  ON manual_grades FOR ALL TO anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
