-- ============================================================
-- KINNOS — Políticas de escritura para rol anon
-- Ejecutar DESPUÉS de schema.sql
-- El frontend del admin escribe directamente con la anon key.
-- Idempotente: usa DROP IF EXISTS antes de cada CREATE.
-- ============================================================

-- Instituciones
DROP POLICY IF EXISTS "anon_write"   ON institutions;
DROP POLICY IF EXISTS "anon_update"  ON institutions;
DROP POLICY IF EXISTS "anon_delete"  ON institutions;
CREATE POLICY "anon_write"  ON institutions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON institutions FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON institutions FOR DELETE USING (true);

-- Carreras
DROP POLICY IF EXISTS "anon_write"   ON careers;
DROP POLICY IF EXISTS "anon_update"  ON careers;
DROP POLICY IF EXISTS "anon_delete"  ON careers;
CREATE POLICY "anon_write"  ON careers FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON careers FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON careers FOR DELETE USING (true);

-- Materias
DROP POLICY IF EXISTS "anon_write"   ON subjects;
DROP POLICY IF EXISTS "anon_update"  ON subjects;
DROP POLICY IF EXISTS "anon_delete"  ON subjects;
CREATE POLICY "anon_write"  ON subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON subjects FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON subjects FOR DELETE USING (true);

-- Profesores
DROP POLICY IF EXISTS "anon_write"   ON professors;
DROP POLICY IF EXISTS "anon_update"  ON professors;
DROP POLICY IF EXISTS "anon_delete"  ON professors;
CREATE POLICY "anon_write"  ON professors FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON professors FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON professors FOR DELETE USING (true);

-- Asignación profesor ↔ materia
DROP POLICY IF EXISTS "anon_write"   ON professor_subjects;
DROP POLICY IF EXISTS "anon_delete"  ON professor_subjects;
CREATE POLICY "anon_write"  ON professor_subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_delete" ON professor_subjects FOR DELETE USING (true);

-- Alumnos
DROP POLICY IF EXISTS "anon_write"   ON students;
DROP POLICY IF EXISTS "anon_update"  ON students;
DROP POLICY IF EXISTS "anon_delete"  ON students;
CREATE POLICY "anon_write"  ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON students FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON students FOR DELETE USING (true);

-- Inscripción alumno ↔ materia
DROP POLICY IF EXISTS "anon_write"   ON student_subjects;
DROP POLICY IF EXISTS "anon_delete"  ON student_subjects;
CREATE POLICY "anon_write"  ON student_subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_delete" ON student_subjects FOR DELETE USING (true);

-- Unidades
DROP POLICY IF EXISTS "anon_write"   ON units;
DROP POLICY IF EXISTS "anon_update"  ON units;
DROP POLICY IF EXISTS "anon_delete"  ON units;
CREATE POLICY "anon_write"  ON units FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON units FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON units FOR DELETE USING (true);

-- Exámenes
DROP POLICY IF EXISTS "anon_write"   ON exams;
DROP POLICY IF EXISTS "anon_update"  ON exams;
DROP POLICY IF EXISTS "anon_delete"  ON exams;
CREATE POLICY "anon_write"  ON exams FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON exams FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON exams FOR DELETE USING (true);

-- Novedades
DROP POLICY IF EXISTS "anon_write"   ON announcements;
DROP POLICY IF EXISTS "anon_update"  ON announcements;
DROP POLICY IF EXISTS "anon_delete"  ON announcements;
CREATE POLICY "anon_write"  ON announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON announcements FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON announcements FOR DELETE USING (true);

-- Resultados de exámenes
DROP POLICY IF EXISTS "anon_write"   ON exam_results;
DROP POLICY IF EXISTS "anon_update"  ON exam_results;
CREATE POLICY "anon_write"  ON exam_results FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON exam_results FOR UPDATE USING (true);
