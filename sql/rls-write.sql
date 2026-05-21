-- ============================================================
-- KINNOS — Políticas de escritura para rol anon
-- Ejecutar DESPUÉS de schema.sql
-- El frontend del admin escribe directamente con la anon key.
-- ============================================================

-- Instituciones
CREATE POLICY "anon_write" ON institutions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON institutions FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON institutions FOR DELETE USING (true);

-- Carreras
CREATE POLICY "anon_write" ON careers FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON careers FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON careers FOR DELETE USING (true);

-- Materias
CREATE POLICY "anon_write" ON subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON subjects FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON subjects FOR DELETE USING (true);

-- Profesores
CREATE POLICY "anon_write" ON professors FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON professors FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON professors FOR DELETE USING (true);

-- Asignación profesor ↔ materia
CREATE POLICY "anon_write" ON professor_subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_delete" ON professor_subjects FOR DELETE USING (true);

-- Alumnos (el admin los crea también)
CREATE POLICY "anon_write" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON students FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON students FOR DELETE USING (true);

-- Inscripción alumno ↔ materia (profesores la gestionan)
CREATE POLICY "anon_write" ON student_subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_delete" ON student_subjects FOR DELETE USING (true);

-- Unidades (profesores)
CREATE POLICY "anon_write" ON units FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON units FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON units FOR DELETE USING (true);

-- Exámenes (profesores)
CREATE POLICY "anon_write" ON exams FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON exams FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON exams FOR DELETE USING (true);

-- Novedades (profesores)
CREATE POLICY "anon_write" ON announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON announcements FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON announcements FOR DELETE USING (true);

-- Resultados de exámenes (alumnos)
CREATE POLICY "anon_write" ON exam_results FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON exam_results FOR UPDATE USING (true);
