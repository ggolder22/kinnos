-- ═══════════════════════════════════════════════════
--  Agrega el curso/división del alumno (Ej: "CENT N° 18 · 1° B")
--  Se usa para mostrarle automáticamente su horario semanal.
-- ═══════════════════════════════════════════════════

ALTER TABLE students ADD COLUMN IF NOT EXISTS curso text;
