-- ═══════════════════════════════════════════════════
--  Módulo de Trabajos Prácticos (enunciado + entrega en PDF) — Kinnos
-- ═══════════════════════════════════════════════════

-- 1. Trabajos prácticos que el profesor publica en la materia
CREATE TABLE IF NOT EXISTS assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   uuid REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  title        text NOT NULL,
  description  text,
  pdf_url      text,             -- enunciado subido por el profesor
  due_date     timestamptz,      -- fecha límite, opcional
  is_active    bool DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- 2. Entregas de los alumnos (un PDF por alumno y trabajo — se puede reemplazar)
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid REFERENCES assignments(id) ON DELETE CASCADE NOT NULL,
  student_id      uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  file_url        text NOT NULL,
  file_name       text,
  status          text DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed')),
  grade           numeric,        -- nota opcional (0-10)
  professor_notes text,
  submitted_at    timestamptz DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);

-- ── RLS ──────────────────────────────────────────────
ALTER TABLE assignments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_assignments" ON assignments;
CREATE POLICY "anon_all_assignments"
  ON assignments FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_assignment_submissions" ON assignment_submissions;
CREATE POLICY "anon_all_assignment_submissions"
  ON assignment_submissions FOR ALL TO anon USING (true) WITH CHECK (true);
