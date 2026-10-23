-- ═══════════════════════════════════════════════════
--  DIAGNÓSTICO de años / divisiones / horarios — Kinnos
--  SOLO LECTURA: no modifica nada. Correr cada bloque por separado
--  en el SQL Editor de Supabase y mirar el resultado.
-- ═══════════════════════════════════════════════════

-- ───── D1. Alumnos duplicados por DNI (mismo número con/sin puntos o espacios) ─────
-- Si aparece algo acá: el alumno tiene DOS cuentas. Según cómo escriba el DNI
-- al entrar, ve una (con todo su historial) o la otra (vacía).
SELECT regexp_replace(dni, '\D', '', 'g') AS dni_normalizado,
       count(*) AS cuentas,
       string_agg(format('%s | dni="%s" | %s°%s | id=%s', full_name, dni, anio, coalesce(division,'-'), id), E'\n') AS detalle
FROM students
GROUP BY 1
HAVING count(*) > 1;

-- ───── D2. Cuántos alumnos hay por año/división (para ver huecos: sin año, sin división) ─────
SELECT anio, coalesce(division, '(sin división)') AS division, count(*)
FROM students
GROUP BY anio, division
ORDER BY anio NULLS FIRST, division NULLS FIRST;

-- ───── D3. Alumnos inscriptos en una materia de OTRA división (mismo año) ─────
SELECT st.full_name, st.dni, st.anio, st.division AS div_alumno,
       sub.name AS materia, sub.year, sub.division AS div_materia
FROM student_subjects ss
JOIN students st ON st.id = ss.student_id
JOIN subjects sub ON sub.id = ss.subject_id
WHERE sub.division IS NOT NULL
  AND st.division IS NOT NULL
  AND st.anio = sub.year
  AND st.division <> sub.division
ORDER BY sub.name, st.full_name;

-- ───── D4. Exámenes RENDIDOS en materias donde el alumno YA NO está inscripto ─────
-- (el alumno no los puede ver: la pantalla de exámenes sale de la materia en la que está inscripto)
SELECT st.full_name, st.dni, st.anio, st.division, sub.name AS materia, sub.division AS div_materia,
       e.title AS examen, er.status, er.taken_at
FROM exam_results er
JOIN students st ON st.id = er.student_id
JOIN exams e     ON e.id = er.exam_id
JOIN subjects sub ON sub.id = e.subject_id
WHERE NOT EXISTS (
  SELECT 1 FROM student_subjects ss WHERE ss.student_id = er.student_id AND ss.subject_id = e.subject_id
)
ORDER BY st.full_name, sub.name;

-- ───── D5. Exámenes RENDIDOS que la pantalla oculta por división ─────
-- (examen marcado para una división, alumno marcado con otra)
SELECT st.full_name, st.dni, st.division AS div_alumno, e.title, e.division AS div_examen, er.status
FROM exam_results er
JOIN students st ON st.id = er.student_id
JOIN exams e     ON e.id = er.exam_id
WHERE e.division IS NOT NULL AND st.division IS NOT NULL AND e.division <> st.division
ORDER BY st.full_name;

-- ───── D6. Entregas de TP en materias donde el alumno YA NO está inscripto ─────
SELECT st.full_name, st.dni, st.anio, st.division, sub.name AS materia, a.title AS tp, a.is_active, s.submitted_at
FROM assignment_submissions s
JOIN students st   ON st.id = s.student_id
JOIN assignments a ON a.id = s.assignment_id
JOIN subjects sub  ON sub.id = a.subject_id
WHERE NOT EXISTS (
  SELECT 1 FROM student_subjects ss WHERE ss.student_id = s.student_id AND ss.subject_id = a.subject_id
)
ORDER BY st.full_name, sub.name;

-- ───── D7. Entregas de TP ocultas porque el profesor desactivó el TP ─────
SELECT sub.name AS materia, a.title AS tp, count(*) AS entregas_ocultas
FROM assignment_submissions s
JOIN assignments a ON a.id = s.assignment_id
JOIN subjects sub  ON sub.id = a.subject_id
WHERE a.is_active = false
GROUP BY sub.name, a.title;

-- ───── D8. Asistencia registrada en materias donde el alumno YA NO está inscripto ─────
SELECT st.full_name, st.dni, st.anio, st.division, sub.name AS materia, count(*) AS registros
FROM attendance_records ar
JOIN attendance_sessions ses ON ses.id = ar.session_id
JOIN students st  ON st.id = ar.student_id
JOIN subjects sub ON sub.id = ses.subject_id
WHERE NOT EXISTS (
  SELECT 1 FROM student_subjects ss WHERE ss.student_id = ar.student_id AND ss.subject_id = ses.subject_id
)
GROUP BY st.full_name, st.dni, st.anio, st.division, sub.name
ORDER BY st.full_name;

-- ───── D9. Qué horarios usa cada materia para la ventana de asistencia ─────
-- Si una materia tiene horarios vinculados (subject_id) de UNA sola división,
-- la otra división nunca va a ver la ventana en su día/hora real.
SELECT sub.name AS materia, sub.year, coalesce(sub.division, 'Ambas') AS div_materia,
       count(sch.id) FILTER (WHERE sch.division = 'A') AS bloques_A,
       count(sch.id) FILTER (WHERE sch.division = 'B') AS bloques_B,
       count(sch.id) AS bloques_vinculados
FROM subjects sub
LEFT JOIN schedules sch ON sch.subject_id = sub.id
GROUP BY sub.id, sub.name, sub.year, sub.division
ORDER BY sub.year, sub.name, sub.division NULLS FIRST;

-- ───── D10. Bloques de horario SIN vincular a ninguna materia ─────
SELECT anio, division, subject_name, count(*) AS bloques
FROM schedules
WHERE subject_id IS NULL AND NOT is_consulta
GROUP BY anio, division, subject_name
ORDER BY anio, division, subject_name;
