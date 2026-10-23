-- ═══════════════════════════════════════════════════
--  Prácticas Profesionalizantes por cuatrimestre — Kinnos
--
--  Secuencia real (confirmada por Germán, 22/10):
--    1°  → 2do cuatrimestre: PP I
--    2°A → 1er cuatrimestre: PP II  · 2do cuatrimestre: PP III
--    3°A → 1er cuatrimestre: PP IV  · 2do cuatrimestre: PP V
--
--  En Kinnos estaban como materias anuales y con otra numeración:
--  "Práctica Profesionalizante II" (2°A) tenía a la vez lo de PP II
--  (unidades, planificación y recuperatorio de junio) y el horario de
--  PP III; y "Práctica Profesionalizante III" (3°A, vacía) era en
--  realidad la PP V del horario.
--
--  PARTE 1 — 2°A: PP II queda en el 1er cuatrimestre con todo lo suyo;
--    se crea PP III (2do cuatrimestre) y se le pasa el horario, los
--    alumnos de 2°A y su asistencia del 16/10.
--  PARTE 2 — 3°A: la vacía pasa a llamarse PP V (2do cuatrimestre) y
--    se crea PP IV (1er cuatrimestre, vacía).
--
--  Todo en una transacción.
-- ═══════════════════════════════════════════════════

BEGIN;

-- ───────────── PARTE 1: 2°A ─────────────

UPDATE subjects SET despliegue = 'Cuatrimestre 1'
WHERE id = '38be8f5d-b804-459d-bf21-f5ce93fb7efa'; -- Práctica Profesionalizante II (2°A)

-- PP III con el mismo nombre que en el horario
INSERT INTO subjects (career_id, name, year, division, despliegue, campo_formacion, hs_semana, hs_total)
SELECT career_id, 'Prácticas Profesionalizantes III', 2, 'A', 'Cuatrimestre 2', campo_formacion, hs_semana, hs_total
FROM subjects WHERE id = '38be8f5d-b804-459d-bf21-f5ce93fb7efa'
AND NOT EXISTS (SELECT 1 FROM subjects WHERE year = 2 AND division = 'A' AND name = 'Prácticas Profesionalizantes III');

CREATE TEMP TABLE pp3 ON COMMIT DROP AS
SELECT id FROM subjects WHERE year = 2 AND division = 'A' AND name = 'Prácticas Profesionalizantes III';

-- El horario de PP III (lun/mar/jue/vie del cronograma de 2°A) pasa a la materia nueva
UPDATE schedules SET subject_id = (SELECT id FROM pp3)
WHERE subject_id = '38be8f5d-b804-459d-bf21-f5ce93fb7efa';

-- Los alumnos de 2°A anotados en PP II quedan también anotados en PP III
-- (siguen en PP II: es su historial del 1er cuatrimestre)
INSERT INTO student_subjects (student_id, subject_id)
SELECT ss.student_id, (SELECT id FROM pp3)
FROM student_subjects ss JOIN students st ON st.id = ss.student_id
WHERE ss.subject_id = '38be8f5d-b804-459d-bf21-f5ce93fb7efa' AND st.anio = 2 AND st.division = 'A'
ON CONFLICT DO NOTHING;

-- La asistencia del 2do cuatrimestre (16/10) de esos alumnos pasa a PP III.
-- La de alumnos de otros cursos queda en PP II (son casos pendientes de preceptoría).
INSERT INTO attendance_sessions (subject_id, session_date)
SELECT (SELECT id FROM pp3), session_date FROM attendance_sessions
WHERE subject_id = '38be8f5d-b804-459d-bf21-f5ce93fb7efa' AND session_date >= '2026-08-01'
ON CONFLICT (subject_id, session_date) DO NOTHING;

UPDATE attendance_records ar SET session_id = nueva.id
FROM attendance_sessions vieja, attendance_sessions nueva, students st
WHERE ar.session_id = vieja.id
  AND vieja.subject_id = '38be8f5d-b804-459d-bf21-f5ce93fb7efa' AND vieja.session_date >= '2026-08-01'
  AND nueva.subject_id = (SELECT id FROM pp3) AND nueva.session_date = vieja.session_date
  AND st.id = ar.student_id AND st.anio = 2 AND st.division = 'A';

-- ───────────── PARTE 2: 3°A ─────────────

UPDATE subjects SET name = 'Práctica Profesionalizante V', despliegue = 'Cuatrimestre 2'
WHERE id = '521f3114-c168-4c00-8760-94e117b8afeb'; -- era "Práctica Profesionalizante III" (vacía, ya tiene el horario de PP V)

INSERT INTO subjects (career_id, name, year, division, despliegue, campo_formacion, hs_semana, hs_total)
SELECT career_id, 'Práctica Profesionalizante IV', 3, 'A', 'Cuatrimestre 1', campo_formacion, hs_semana, hs_total
FROM subjects WHERE id = '521f3114-c168-4c00-8760-94e117b8afeb'
AND NOT EXISTS (SELECT 1 FROM subjects WHERE year = 3 AND division = 'A' AND name = 'Práctica Profesionalizante IV');

COMMIT;

-- ───────────── Verificación ─────────────
SELECT sub.year || '°' || sub.division AS curso, sub.name, sub.despliegue, sub.join_code,
       (SELECT count(*) FROM student_subjects ss WHERE ss.subject_id = sub.id) AS inscriptos,
       (SELECT count(DISTINCT sch.day) FROM schedules sch WHERE sch.subject_id = sub.id AND NOT sch.is_consulta) AS dias_de_clase,
       (SELECT count(*) FROM attendance_records ar JOIN attendance_sessions ses ON ses.id = ar.session_id WHERE ses.subject_id = sub.id) AS asistencias
FROM subjects sub
WHERE sub.name ILIKE 'Práctica%Profesionalizante%'
ORDER BY sub.year, sub.division, sub.despliegue, sub.name;
