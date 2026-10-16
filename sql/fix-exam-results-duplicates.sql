-- ═══════════════════════════════════════════════════
--  Arregla el bug de exámenes enviados más de una vez
--  Causa: exam_results se creó originalmente (schema.sql) SIN el
--  UNIQUE(student_id, exam_id) que sí tiene exams-module.sql — pero como
--  la tabla ya existía, ese segundo CREATE TABLE IF NOT EXISTS nunca
--  llegó a aplicar el candado. Esto deja que, ante un doble clic o una
--  reconexión, se creen varias filas para el mismo alumno+examen.
-- ═══════════════════════════════════════════════════

-- 1. Por cada (student_id, exam_id) con más de una fila, nos quedamos con
--    la "mejor" (confirmada > enviada > en progreso; entre empates, la más
--    reciente) y borramos el resto — no se pierde ninguna nota ya cargada.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY student_id, exam_id
      ORDER BY
        CASE status WHEN 'confirmed' THEN 3 WHEN 'submitted' THEN 2 ELSE 1 END DESC,
        submitted_at DESC NULLS LAST,
        started_at DESC NULLS LAST
    ) AS rn
  FROM exam_results
)
DELETE FROM exam_results WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Ahora sí, el candado: un alumno no puede tener más de una fila por examen.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_results_student_exam_unique'
  ) THEN
    ALTER TABLE exam_results ADD CONSTRAINT exam_results_student_exam_unique UNIQUE (student_id, exam_id);
  END IF;
END $$;
