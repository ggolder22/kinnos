-- ═══════════════════════════════════════════════════
--  Curso del alumno, como año + división separados
--  (reemplaza al campo de texto libre "curso" de la primera versión)
--  Se usa para mostrarle automáticamente su horario semanal.
-- ═══════════════════════════════════════════════════

ALTER TABLE students ADD COLUMN IF NOT EXISTS anio     int;
ALTER TABLE students ADD COLUMN IF NOT EXISTS division text;

-- Migra alumnos que ya habían elegido su "curso" en la versión anterior (texto libre, ej: "CENT N° 18 · 1° B")
UPDATE students SET
  anio     = COALESCE(anio, (regexp_match(curso, '(\d+)°'))[1]::int),
  division = COALESCE(division, (regexp_match(curso, '°\s*([A-Za-z])'))[1])
WHERE anio IS NULL AND curso IS NOT NULL AND curso ~ '\d+°';
