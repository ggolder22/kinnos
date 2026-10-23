-- ═══════════════════════════════════════════════════
--  Divisiones definitivas — Kinnos
--
--  Regla nueva: NO existen materias compartidas. Cada materia es de un
--  solo curso (año + división). 1°A y 1°B son materias distintas, con
--  sus propios alumnos, horarios y profesores.
--
--  PARTE 0 — Funciones:
--    kinnos_reubicar_alumno(alumno): deja al alumno en las materias de
--    SU división y le muda todo su historial (exámenes, TPs, asistencia)
--    desde la materia "gemela" de la otra división. Se usa acá para el
--    arreglo masivo, y desde la app cada vez que el admin le cambia el
--    curso a un alumno — así no vuelve a pasar que alguien "pierda" lo suyo.
--  PARTE 1 — Electrotecnia: la original (con contenido y alumnos) es de 1°B;
--    la creada el 22/10 pasa a ser la de 1°A.
--  PARTE 2 — Las materias de 1° que figuraban como "Ambas": la original
--    queda para 1°B (es la que tiene sus alumnos y contenido) y se crea
--    la de 1°A, vacía.
--  PARTE 3 — División obligatoria en todas las materias.
--  PARTE 4 — Horarios: borra el horario de 1°B que estaba cargado dos
--    veces, saca vínculos horario↔materia de la división equivocada y
--    vincula cada bloque con la materia de su mismo año + división + nombre.
--    No cambia ningún día ni hora: se respeta el cronograma cargado.
--
--  Todo corre en una transacción: si algo falla, no queda nada a medias.
-- ═══════════════════════════════════════════════════

BEGIN;

-- ───────────── PARTE 0: funciones ─────────────

-- Renombra las claves de un objeto JSON (id de pregunta vieja → id de pregunta copiada)
CREATE OR REPLACE FUNCTION kinnos_remap_keys(j jsonb, m jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN j IS NULL OR jsonb_typeof(j) <> 'object' OR m IS NULL THEN j
    ELSE (SELECT coalesce(jsonb_object_agg(coalesce(m ->> k, k), v), '{}'::jsonb) FROM jsonb_each(j) AS t(k, v))
  END
$$;

-- Copia "histórico" de un examen (con sus preguntas) en otra materia.
-- Si ya existe una copia histórica de ese examen ahí, devuelve esa.
CREATE OR REPLACE FUNCTION kinnos_copia_examen(p_exam uuid, p_subject uuid)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  src exams%ROWTYPE;
  nuevo uuid;
BEGIN
  SELECT * INTO src FROM exams WHERE id = p_exam;

  SELECT id INTO nuevo FROM exams
  WHERE subject_id = p_subject AND starts_with(title, src.title || ' (histórico')
  ORDER BY created_at LIMIT 1;
  IF nuevo IS NOT NULL THEN RETURN nuevo; END IF;

  INSERT INTO exams (subject_id, title, is_active, time_limit, instructions, unit_ids, is_practice, pdf_url, division, created_at)
  VALUES (p_subject, src.title || ' (histórico)', false, src.time_limit, src.instructions, '[]'::jsonb,
          src.is_practice, src.pdf_url, NULL, src.created_at)
  RETURNING id INTO nuevo;

  INSERT INTO exam_questions (exam_id, question_text, type, options, correct_answer, points, order_num, image_url)
  SELECT nuevo, question_text, type, options, correct_answer, points, order_num, image_url
  FROM exam_questions WHERE exam_id = p_exam;

  RETURN nuevo;
END $$;

-- Copia de un TP en otra materia (inactiva: solo la ven los alumnos que
-- ya habían entregado; el profesor la puede activar si quiere).
CREATE OR REPLACE FUNCTION kinnos_copia_tp(p_tp uuid, p_subject uuid)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  src assignments%ROWTYPE;
  nuevo uuid;
BEGIN
  SELECT * INTO src FROM assignments WHERE id = p_tp;

  SELECT id INTO nuevo FROM assignments
  WHERE subject_id = p_subject AND title = src.title
  ORDER BY created_at LIMIT 1;
  IF nuevo IS NOT NULL THEN RETURN nuevo; END IF;

  INSERT INTO assignments (subject_id, title, description, pdf_url, due_date, is_active, created_at)
  VALUES (p_subject, src.title, src.description, src.pdf_url, src.due_date, false, src.created_at)
  RETURNING id INTO nuevo;
  RETURN nuevo;
END $$;

-- Deja al alumno en las materias de su año + división, y muda su historial.
-- Solo toca materias de SU año (un alumno de 2° que recursa una de 1° no se mueve).
-- Devuelve una línea de texto por cada cosa que hizo o que no pudo hacer.
CREATE OR REPLACE FUNCTION kinnos_reubicar_alumno(p_student uuid)
RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE
  st      students%ROWTYPE;
  origen  subjects%ROWTYPE;
  destino subjects%ROWTYPE;
  r       record;
  inscripto bool;
  e2 uuid; a2 uuid; ses2 uuid;
  qmap jsonb;
  n_ex int; n_tp int; n_as int;
BEGIN
  SELECT * INTO st FROM students WHERE id = p_student;
  IF st.id IS NULL OR st.anio IS NULL OR st.division IS NULL THEN RETURN; END IF;

  -- Materias de su año, de la OTRA división, en las que tiene inscripción o historial
  FOR origen IN
    SELECT s.* FROM subjects s
    WHERE s.year = st.anio AND s.division IS DISTINCT FROM st.division
      AND s.id IN (
        SELECT subject_id FROM student_subjects WHERE student_id = p_student
        UNION SELECT e.subject_id FROM exam_results x JOIN exams e ON e.id = x.exam_id WHERE x.student_id = p_student
        UNION SELECT a.subject_id FROM assignment_submissions x JOIN assignments a ON a.id = x.assignment_id WHERE x.student_id = p_student
        UNION SELECT ses.subject_id FROM attendance_records x JOIN attendance_sessions ses ON ses.id = x.session_id WHERE x.student_id = p_student
      )
  LOOP
    SELECT * INTO destino FROM subjects t
    WHERE t.career_id IS NOT DISTINCT FROM origen.career_id
      AND t.year = origen.year AND t.division = st.division
      AND lower(trim(t.name)) = lower(trim(origen.name))
    LIMIT 1;

    IF destino.id IS NULL THEN
      RETURN NEXT format('⚠ %s (%s°%s): no existe "%s" de %s°%s — queda donde está',
        st.full_name, st.anio, st.division, origen.name, st.anio, st.division);
      CONTINUE;
    END IF;

    n_ex := 0; n_tp := 0; n_as := 0;

    -- Exámenes rendidos → copia histórica del examen en la materia destino
    FOR r IN
      SELECT x.id, x.exam_id FROM exam_results x JOIN exams e ON e.id = x.exam_id
      WHERE x.student_id = p_student AND e.subject_id = origen.id
    LOOP
      e2 := kinnos_copia_examen(r.exam_id, destino.id);
      IF EXISTS (SELECT 1 FROM exam_results WHERE student_id = p_student AND exam_id = e2) THEN
        CONTINUE; -- ya estaba copiado de antes (arreglo del 21/10): se deja el original como respaldo
      END IF;
      SELECT jsonb_object_agg(q.id::text, q2.id::text) INTO qmap
      FROM exam_questions q
      JOIN exam_questions q2 ON q2.exam_id = e2
        AND q2.order_num IS NOT DISTINCT FROM q.order_num
        AND q2.question_text = q.question_text
      WHERE q.exam_id = r.exam_id;

      UPDATE exam_results SET
        exam_id = e2,
        answers = kinnos_remap_keys(answers, qmap),
        professor_adjustments = kinnos_remap_keys(professor_adjustments, qmap)
      WHERE id = r.id;
      n_ex := n_ex + 1;
    END LOOP;

    -- Entregas de TP → copia del TP en la materia destino
    FOR r IN
      SELECT x.id, x.assignment_id FROM assignment_submissions x JOIN assignments a ON a.id = x.assignment_id
      WHERE x.student_id = p_student AND a.subject_id = origen.id
    LOOP
      a2 := kinnos_copia_tp(r.assignment_id, destino.id);
      IF EXISTS (SELECT 1 FROM assignment_submissions WHERE student_id = p_student AND assignment_id = a2) THEN
        CONTINUE;
      END IF;
      UPDATE assignment_submissions SET assignment_id = a2 WHERE id = r.id;
      n_tp := n_tp + 1;
    END LOOP;

    -- Asistencia → misma fecha, en la materia destino
    FOR r IN
      SELECT x.id, ses.session_date FROM attendance_records x JOIN attendance_sessions ses ON ses.id = x.session_id
      WHERE x.student_id = p_student AND ses.subject_id = origen.id
    LOOP
      INSERT INTO attendance_sessions (subject_id, session_date) VALUES (destino.id, r.session_date)
      ON CONFLICT (subject_id, session_date) DO UPDATE SET subject_id = EXCLUDED.subject_id
      RETURNING id INTO ses2;
      IF EXISTS (SELECT 1 FROM attendance_records WHERE session_id = ses2 AND student_id = p_student) THEN
        CONTINUE;
      END IF;
      UPDATE attendance_records SET session_id = ses2 WHERE id = r.id;
      n_as := n_as + 1;
    END LOOP;

    -- Inscripción
    SELECT EXISTS (SELECT 1 FROM student_subjects WHERE student_id = p_student AND subject_id = origen.id) INTO inscripto;
    IF inscripto THEN
      INSERT INTO student_subjects (student_id, subject_id) VALUES (p_student, destino.id) ON CONFLICT DO NOTHING;
      DELETE FROM student_subjects WHERE student_id = p_student AND subject_id = origen.id;
    END IF;

    RETURN NEXT format('%s: "%s" %s°%s → %s°%s%s | exámenes %s, TPs %s, asistencias %s',
      st.full_name, origen.name, origen.year, coalesce(origen.division, '-'), destino.year, destino.division,
      CASE WHEN inscripto THEN '' ELSE ' (solo historial)' END, n_ex, n_tp, n_as);
  END LOOP;
END $$;

-- La app la llama al cambiarle el curso a un alumno (Admin → Alumnos, importación de Excel)
GRANT EXECUTE ON FUNCTION kinnos_reubicar_alumno(uuid) TO anon, authenticated;

-- ───────────── PARTE 1: Electrotecnia ─────────────
-- La original (mayo, con unidades y TP, 23 alumnos de 1°B) figuraba como 1°A.
UPDATE subjects SET division = 'B' WHERE id = '70b4cd60-215c-4df6-a60b-8dcb073be559'; -- original → 1°B
UPDATE subjects SET division = 'A' WHERE id = '2239f837-83c8-456d-adbb-0b8229527654'; -- nueva (22/10) → 1°A

-- ───────────── PARTE 2: materias de 1° que figuraban como "Ambas" ─────────────
-- Química Aplicada, Matemática Aplicada, Instalaciones Eléctricas, Física Aplicada,
-- Alfabetización Académica, Tecnología Ambiente y Sociedad, Energías Renovables.
INSERT INTO subjects (career_id, name, year, division, despliegue, campo_formacion, hs_semana, hs_total)
SELECT s.career_id, s.name, s.year, 'A', s.despliegue, s.campo_formacion, s.hs_semana, s.hs_total
FROM subjects s
WHERE s.year = 1 AND s.division IS NULL
AND NOT EXISTS (
  SELECT 1 FROM subjects t
  WHERE t.career_id IS NOT DISTINCT FROM s.career_id AND t.year = 1 AND t.division = 'A'
    AND lower(trim(t.name)) = lower(trim(s.name))
);

UPDATE subjects SET division = 'B' WHERE year = 1 AND division IS NULL;

-- ───────────── PARTE 3: división obligatoria ─────────────
-- 2° y 3° ya son todas "A" (sql/set-division-a-2do-3er.sql). Si quedara alguna
-- sin división, esto frena todo para que se revise a mano.
ALTER TABLE subjects ALTER COLUMN division SET NOT NULL;

-- ───────────── PARTE 4: horarios ─────────────

-- 4a. El horario de 1°B estaba cargado dos veces: deja un solo bloque de cada
--     (prefiere el que ya estaba vinculado a una materia).
DELETE FROM schedules s
USING (
  SELECT id, row_number() OVER (
    PARTITION BY anio, division, day, time_start, time_end, subject_name, is_consulta
    ORDER BY (subject_id IS NULL), created_at, id
  ) AS n
  FROM schedules
) d
WHERE s.id = d.id AND d.n > 1;

-- 4b. Ningún bloque puede quedar vinculado a una materia de otra división
UPDATE schedules sch SET subject_id = NULL
FROM subjects sub
WHERE sch.subject_id = sub.id AND sch.division IS DISTINCT FROM sub.division;

-- 4c. Vincula cada bloque suelto con la materia de su mismo año + división + nombre
UPDATE schedules sch SET subject_id = sub.id
FROM subjects sub
WHERE sch.subject_id IS NULL
  AND sub.year = sch.anio
  AND sub.division = sch.division
  AND lower(trim(sub.name)) = lower(trim(sch.subject_name));

-- ───────────── PARTE 5: curso de los alumnos según las listas oficiales ─────────────
-- (cruce de 1A/1B/2A/3A.xlsx contra Kinnos del 22/10: 189 de 192 ya estaban bien)
UPDATE students SET anio = 2, division = 'A' WHERE id = '5b9fde30-7a56-459b-acb0-07afa1deafd4'; -- figuraba 2°B (no existe)
UPDATE students SET anio = 2, division = 'A' WHERE id = '7f89c65e-5cee-4ecb-902a-91dbaee15fb1'; -- figuraba 3°A, está en la lista de 2°A
-- Este alumno figura en las listas de 1°A Y de 1°B: queda sin curso hasta que se confirme
-- (aparece como pendiente en el dashboard de preceptores)
UPDATE students SET anio = NULL, division = NULL WHERE id = '77288779-7943-4e04-baa5-fd40ff03e92b';

-- ───────────── PARTE 6: cada alumno a las materias de su división, con su historial ─────────────
CREATE TEMP TABLE reubicacion_log ON COMMIT PRESERVE ROWS AS
SELECT kinnos_reubicar_alumno(id) AS detalle FROM students;

COMMIT;

-- Para que la app vea la función nueva enseguida
NOTIFY pgrst, 'reload schema';

-- ───────────── Resultado: qué alumnos se movieron y con qué ─────────────
SELECT detalle FROM reubicacion_log ORDER BY detalle;
