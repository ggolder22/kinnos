-- ═══════════════════════════════════════════════════
--  Módulo de Proyectos (grupos de trabajo + bitácora) — Kinnos
--  Pensado para materias tipo "Prácticas Profesionalizantes":
--  grupos de alumnos armando un proyecto, con código de seguimiento
--  y una línea de tiempo compartida (fotos, videos, mensajes) entre
--  alumnos y profesor.
-- ═══════════════════════════════════════════════════

-- 1. Grupos de trabajo dentro de una materia
CREATE TABLE IF NOT EXISTS project_groups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     uuid REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  name           text NOT NULL,
  description    text,             -- de qué trata el proyecto
  tracking_code  text UNIQUE,      -- se autogenera, ej: "PRY-8K3F"
  status         text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'approved', 'not_approved')),
  approved_at    timestamptz,
  created_at     timestamptz DEFAULT now()
);

-- 2. Integrantes del grupo (N:N con alumnos)
CREATE TABLE IF NOT EXISTS project_group_members (
  group_id   uuid REFERENCES project_groups(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, student_id)
);

-- 3. Bitácora del proyecto: mensajes + fotos/videos/archivos, de alumnos y del profesor
CREATE TABLE IF NOT EXISTS project_updates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid REFERENCES project_groups(id) ON DELETE CASCADE NOT NULL,
  author_type  text NOT NULL CHECK (author_type IN ('student', 'professor')),
  author_id    uuid NOT NULL,     -- id en students o professors, según author_type
  author_name  text NOT NULL,     -- desnormalizado para mostrar sin joins cruzados
  message      text,
  attachments  jsonb DEFAULT '[]', -- [{ "name": "foto1.jpg", "url": "...", "type": "image/jpeg" }, ...]
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_groups_subject   ON project_groups(subject_id);
CREATE INDEX IF NOT EXISTS idx_project_members_group    ON project_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_project_members_student  ON project_group_members(student_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_group    ON project_updates(group_id);

-- ── Código de seguimiento automático (igual criterio que el join_code de materias) ──
CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code text;
  attempts int := 0;
BEGIN
  IF NEW.tracking_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  LOOP
    new_code := 'PRY-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 5));
    IF NOT EXISTS (SELECT 1 FROM project_groups WHERE tracking_code = new_code) THEN
      NEW.tracking_code := new_code;
      RETURN NEW;
    END IF;
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'No se pudo generar un tracking_code único';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_groups_tracking_code ON project_groups;
CREATE TRIGGER trg_project_groups_tracking_code
  BEFORE INSERT ON project_groups
  FOR EACH ROW EXECUTE FUNCTION generate_tracking_code();

-- ── RLS ──────────────────────────────────────────────
ALTER TABLE project_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_updates        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_project_groups" ON project_groups;
CREATE POLICY "anon_all_project_groups"
  ON project_groups FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_project_group_members" ON project_group_members;
CREATE POLICY "anon_all_project_group_members"
  ON project_group_members FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_project_updates" ON project_updates;
CREATE POLICY "anon_all_project_updates"
  ON project_updates FOR ALL TO anon USING (true) WITH CHECK (true);
