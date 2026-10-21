-- ═══════════════════════════════════════════════════
--  Corrige inscripción cruzada: alumnos de 1°A anotados por error
--  en las materias de 1°B (porque hasta hace poco esas eran las
--  únicas versiones que existían en Kinnos).
--
--  Afecta: 24 alumnos en "Informática Aplicada" (1°B) y 4 en
--  "Prácticas Profesionalizantes I" (1°B) que en realidad son de 1°A.
--
--  PARTE 1 — los pasa a la materia correcta de 1°A (recién creada).
--  PARTE 2 — borra los registros de asistencia "ausente"/"justificada"
--  que generaron por error en la materia de 1°B (no reflejan una
--  ausencia real: nunca fue su clase, su horario es otro).
--
--  No toca a ningún alumno de 1°B ni sus registros.
-- ═══════════════════════════════════════════════════

-- ───────────── PARTE 1: mover inscripción a la materia de 1°A ─────────────

UPDATE student_subjects
SET subject_id = '0cac6fad-e42c-4805-8ec6-7bf0bed20fe1' -- Informática Aplicada (1°A)
WHERE subject_id = 'e2f6d6f8-dd66-4968-8fc9-d884cf8bf2a3' -- Informática Aplicada (1°B)
AND student_id IN (SELECT id FROM students WHERE division = 'A' AND anio = 1);

UPDATE student_subjects
SET subject_id = 'fd3979f6-a7ad-4bd6-acaf-8982ca60035e' -- Prácticas Profesionalizantes I (1°A)
WHERE subject_id = '438a93b4-86e2-4d13-bc20-b9296a29fa39' -- Prácticas Profesionalizantes I (1°B)
AND student_id IN (SELECT id FROM students WHERE division = 'A' AND anio = 1);

-- ───────────── PARTE 2: borrar los registros de asistencia erróneos ─────────────

DELETE FROM attendance_records ar
USING attendance_sessions ses
WHERE ar.session_id = ses.id
AND ses.subject_id IN (
  'e2f6d6f8-dd66-4968-8fc9-d884cf8bf2a3', -- Informática Aplicada (1°B)
  '438a93b4-86e2-4d13-bc20-b9296a29fa39', -- Prácticas Profesionalizantes I (1°B)
  'c057ddeb-fe41-4871-8563-19c604d404e0'  -- Energía Solar Térmica (1°B), por las dudas
)
AND ar.student_id IN (SELECT id FROM students WHERE division = 'A' AND anio = 1);
