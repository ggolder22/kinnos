-- ═══════════════════════════════════════════════════
--  Vincular el cronograma (schedules) con las materias reales (subjects)
--  Necesario para poder calcular la ventana de asistencia a partir
--  del horario de cada materia.
-- ═══════════════════════════════════════════════════

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_subject ON schedules(subject_id);

-- Vínculo automático "best effort": mismo año + mismo nombre de materia
-- (sin importar mayúsculas ni espacios). Solo completa los que están sin vincular,
-- nunca pisa un vínculo ya hecho a mano.
UPDATE schedules s SET subject_id = sub.id
FROM subjects sub
WHERE s.subject_id IS NULL
  AND s.anio = sub.year
  AND lower(trim(s.subject_name)) = lower(trim(sub.name));

-- Los que no matchearon (nombres distintos, tildes, etc.) se vinculan a mano
-- desde el panel del profesor → pestaña Asistencia → "Horario".
