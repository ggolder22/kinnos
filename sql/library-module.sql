-- ═══════════════════════════════════════════════════
--  Módulo de Biblioteca Virtual / E-learning — Kinnos
-- ═══════════════════════════════════════════════════

-- 1. Recursos de la biblioteca (catálogo institucional)
CREATE TABLE IF NOT EXISTS library_resources (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE NOT NULL,
  career_id      uuid REFERENCES careers(id) ON DELETE CASCADE,   -- null = visible a toda la institución
  title          text NOT NULL,
  description    text,
  category       text,          -- etiqueta libre para filtrar (ej: "Manuales", "Normativa", "Videos de cátedra")
  type           text NOT NULL CHECK (type IN ('pdf', 'video', 'link')),
  file_url       text,          -- PDF subido a Storage (type='pdf')
  video_url      text,          -- link de YouTube/Vimeo/etc. (type='video')
  external_url   text,          -- link externo — artículo, simulador, etc. (type='link')
  created_by     uuid REFERENCES professors(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now()
);

-- 2. Vínculo N:N — un recurso puede colgarse en 0, 1 o varias materias sin duplicarse
CREATE TABLE IF NOT EXISTS library_subject_links (
  resource_id uuid REFERENCES library_resources(id) ON DELETE CASCADE NOT NULL,
  subject_id  uuid REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  linked_at   timestamptz DEFAULT now(),
  PRIMARY KEY (resource_id, subject_id)
);

-- 3. Progreso del alumno (autoreportado, igual criterio que los ejercicios de práctica)
CREATE TABLE IF NOT EXISTS library_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id   uuid REFERENCES library_resources(id) ON DELETE CASCADE NOT NULL,
  student_id    uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  status        text DEFAULT 'viewed' CHECK (status IN ('viewed', 'completed')),
  viewed_at     timestamptz DEFAULT now(),
  completed_at  timestamptz,
  UNIQUE(resource_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_library_resources_institution ON library_resources(institution_id);
CREATE INDEX IF NOT EXISTS idx_library_resources_career      ON library_resources(career_id);
CREATE INDEX IF NOT EXISTS idx_library_links_subject          ON library_subject_links(subject_id);
CREATE INDEX IF NOT EXISTS idx_library_progress_resource      ON library_progress(resource_id);
CREATE INDEX IF NOT EXISTS idx_library_progress_student       ON library_progress(student_id);

-- ── RLS ──────────────────────────────────────────────
ALTER TABLE library_resources     ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_subject_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_progress      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_library_resources" ON library_resources;
CREATE POLICY "anon_all_library_resources"
  ON library_resources FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_library_subject_links" ON library_subject_links;
CREATE POLICY "anon_all_library_subject_links"
  ON library_subject_links FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_library_progress" ON library_progress;
CREATE POLICY "anon_all_library_progress"
  ON library_progress FOR ALL TO anon USING (true) WITH CHECK (true);
