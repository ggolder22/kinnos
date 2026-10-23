-- ═══════════════════════════════════════════════════
--  Chequeo completo de integridad — Kinnos
--  SOLO LECTURA. Correr cada bloque por separado en el SQL Editor
--  de Supabase y mirar si devuelve filas (si no devuelve nada, está OK).
--  Pensado para correr cada tanto, sobre todo después de mover
--  alumnos de curso o cargar horarios nuevos.
-- ═══════════════════════════════════════════════════

-- ── 1. Alumnos duplicados por DNI ──
SELECT regexp_replace(dni, '\D', '', 'g') AS dni_normalizado, count(*) AS cuentas,
       string_agg(format('%s | id=%s', full_name, id), E'\n') AS detalle
FROM students GROUP BY 1 HAVING count(*) > 1;

-- ── 2. Alumnos sin año o división ──
SELECT full_name, dni, anio, division FROM students WHERE anio IS NULL OR division IS NULL;

-- ── 3. Materias sin división ──
SELECT name, year FROM subjects WHERE division IS NULL;

-- ── 4. Alumnos inscriptos en materia de OTRA división (mismo año) ──
SELECT st.full_name, st.dni, st.anio, st.division AS div_alumno, sub.name AS materia, sub.division AS div_materia
FROM student_subjects ss
JOIN students st ON st.id = ss.student_id
JOIN subjects sub ON sub.id = ss.subject_id
WHERE sub.division IS NOT NULL AND st.division IS NOT NULL
  AND st.anio = sub.year AND st.division <> sub.division;

-- ── 5. Alumnos inscriptos en materia de OTRO año (recursantes o error) ──
SELECT st.full_name, st.dni, st.anio AS anio_alumno, st.division AS div_alumno,
       sub.name AS materia, sub.year AS anio_materia, sub.division AS div_materia
FROM student_subjects ss
JOIN students st ON st.id = ss.student_id
JOIN subjects sub ON sub.id = ss.subject_id
WHERE st.anio IS NOT NULL AND sub.year IS NOT NULL AND st.anio <> sub.year
ORDER BY st.full_name;

-- ── 6. Resultados de examen en materia donde el alumno YA NO está inscripto (no los puede ver) ──
SELECT st.full_name, st.dni, sub.name AS materia, e.title AS examen, er.status
FROM exam_results er
JOIN students st ON st.id = er.student_id
JOIN exams e ON e.id = er.exam_id
JOIN subjects sub ON sub.id = e.subject_id
WHERE NOT EXISTS (SELECT 1 FROM student_subjects ss WHERE ss.student_id = er.student_id AND ss.subject_id = e.subject_id)
ORDER BY st.full_name;

-- ── 7. Resultados ocultos por división (examen.division ≠ alumno.division) ──
SELECT st.full_name, st.dni, st.division AS div_alumno, e.title, e.division AS div_examen, er.status
FROM exam_results er
JOIN students st ON st.id = er.student_id
JOIN exams e ON e.id = er.exam_id
WHERE e.division IS NOT NULL AND st.division IS NOT NULL AND e.division <> st.division;

-- ── 8. Entregas de TP en materia donde el alumno YA NO está inscripto ──
SELECT st.full_name, st.dni, sub.name AS materia, a.title AS tp, s.submitted_at
FROM assignment_submissions s
JOIN students st ON st.id = s.student_id
JOIN assignments a ON a.id = s.assignment_id
JOIN subjects sub ON sub.id = a.subject_id
WHERE NOT EXISTS (SELECT 1 FROM student_subjects ss WHERE ss.student_id = s.student_id AND ss.subject_id = a.subject_id);

-- ── 9. TPs desactivados que tienen entregas (el alumno ya no los ve) ──
SELECT sub.name AS materia, a.title AS tp, count(*) AS entregas_ocultas
FROM assignment_submissions s
JOIN assignments a ON a.id = s.assignment_id
JOIN subjects sub ON sub.id = a.subject_id
WHERE a.is_active = false
GROUP BY sub.name, a.title;

-- ── 10. Asistencia registrada en materia donde el alumno YA NO está inscripto ──
SELECT st.full_name, st.dni, sub.name AS materia, count(*) AS registros
FROM attendance_records ar
JOIN attendance_sessions ses ON ses.id = ar.session_id
JOIN students st ON st.id = ar.student_id
JOIN subjects sub ON sub.id = ses.subject_id
WHERE NOT EXISTS (SELECT 1 FROM student_subjects ss WHERE ss.student_id = ar.student_id AND ss.subject_id = ses.subject_id)
GROUP BY st.full_name, st.dni, sub.name;

-- ── 11. Materias CON alumnos inscriptos pero SIN ningún horario vinculado (asistencia no puede funcionar) ──
SELECT sub.name, sub.year, sub.division, count(DISTINCT ss.student_id) AS alumnos
FROM subjects sub
JOIN student_subjects ss ON ss.subject_id = sub.id
WHERE NOT EXISTS (SELECT 1 FROM schedules sch WHERE sch.subject_id = sub.id)
GROUP BY sub.id, sub.name, sub.year, sub.division
ORDER BY sub.year, sub.name;

-- ── 12. Bloques de horario sueltos (sin vincular a ninguna materia) ──
SELECT anio, division, subject_name, count(*) AS bloques
FROM schedules WHERE subject_id IS NULL AND NOT is_consulta
GROUP BY anio, division, subject_name ORDER BY anio, division;

-- ── 13. Materias cuyo horario mezcla las DOS divisiones (ventana de asistencia ambigua) ──
SELECT sub.name, sub.year, sub.division,
       count(sch.id) FILTER (WHERE sch.division = 'A') AS bloques_a,
       count(sch.id) FILTER (WHERE sch.division = 'B') AS bloques_b
FROM subjects sub JOIN schedules sch ON sch.subject_id = sub.id
GROUP BY sub.id, sub.name, sub.year, sub.division
HAVING count(DISTINCT sch.division) > 1;

-- ── 14. Materias sin código de inscripción ──
SELECT name, year, division FROM subjects WHERE join_code IS NULL;
