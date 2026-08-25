-- ═══════════════════════════════════════════════════
--  División (A/B) por materia — Kinnos
--  Columna nueva, NULLABLE: no toca ni borra nada de lo que ya existe.
--  Todas las materias actuales quedan en NULL = "Ambas divisiones"
--  (exactamente el comportamiento que tienen hoy, sin restricción).
-- ═══════════════════════════════════════════════════

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS division text;

-- Solo valida el valor si se carga algo (NULL sigue siendo válido = sin restricción)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subjects_division_check'
  ) THEN
    ALTER TABLE subjects ADD CONSTRAINT subjects_division_check CHECK (division IN ('A', 'B'));
  END IF;
END $$;
