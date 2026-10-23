-- ═══════════════════════════════════════════════════
--  Año de materia = año del curso que la cursa (según el horario)
--
--  Marco Jurídico y Uso Racional de la Energía las cursa 2°A, pero
--  estaban cargadas como de 3°. Gestión de Proyectos la cursa 3°A,
--  pero estaba como de 2°. Por eso el dashboard de preceptores las
--  mostraba en la columna equivocada.
--
--  Solo cambia el año: no toca inscripciones, horarios, exámenes ni
--  asistencia (todo eso cuelga de la materia, no del año).
-- ═══════════════════════════════════════════════════

UPDATE subjects SET year = 2 WHERE id = '312442bf-956f-4e3c-9a52-0d35c5512446'; -- Marco Jurídico
UPDATE subjects SET year = 2 WHERE id = '4e898a79-feeb-43ee-b4de-5dbdb487cd86'; -- Uso Racional de la Energía
UPDATE subjects SET year = 3 WHERE id = '2e15cde5-faa4-4cd6-ab38-84901a52bf51'; -- Gestión de Proyectos

-- Verificación: materias de 2° y 3° con sus horarios
SELECT sub.year, sub.division, sub.name, sub.despliegue,
       string_agg(DISTINCT sch.anio || '°' || sch.division, ', ') AS cursa_segun_horario
FROM subjects sub
LEFT JOIN schedules sch ON sch.subject_id = sub.id
WHERE sub.year IN (2, 3)
GROUP BY sub.year, sub.division, sub.name, sub.despliegue
ORDER BY sub.year, sub.name;
