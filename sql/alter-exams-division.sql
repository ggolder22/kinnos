-- ═══════════════════════════════════════════════════
--  División (A/B) por examen — Kinnos
--  Para materias compartidas entre dos divisiones que dan contenido
--  distinto (días/profesores diferentes): permite que un examen sea
--  exclusivo de una división, o de "Ambas" (como hasta ahora).
--  Columna nueva y NULLABLE: los exámenes ya cargados quedan en NULL
--  = "Ambas divisiones", el mismo comportamiento que tienen hoy.
-- ═══════════════════════════════════════════════════

ALTER TABLE exams ADD COLUMN IF NOT EXISTS division text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_division_check') THEN
    ALTER TABLE exams ADD CONSTRAINT exams_division_check CHECK (division IN ('A', 'B'));
  END IF;
END $$;
