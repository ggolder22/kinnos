-- ============================================================
-- KINNOS — Legajo del profesor
-- 1. Agrega legajo_num a professors (secuencia auto-incremental)
-- 2. Crea tabla professor_documents
-- 3. RLS policies
-- 4. Bucket de storage "legajos"
-- ============================================================

-- Secuencia para números de legajo
CREATE SEQUENCE IF NOT EXISTS professors_legajo_seq START 1;

-- Columna legajo_num en professors
ALTER TABLE professors
  ADD COLUMN IF NOT EXISTS legajo_num integer;

-- Asignar legajo a profesores existentes que aún no tienen número
UPDATE professors
SET legajo_num = nextval('professors_legajo_seq')
WHERE legajo_num IS NULL;

-- Default automático para nuevos profesores
ALTER TABLE professors
  ALTER COLUMN legajo_num SET DEFAULT nextval('professors_legajo_seq');

-- ── Tabla professor_documents ──────────────────────────────

CREATE TABLE IF NOT EXISTS professor_documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid        NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  subject_id   uuid        REFERENCES subjects(id) ON DELETE SET NULL,
  doc_type     text        NOT NULL,
  description  text,
  file_url     text        NOT NULL,
  file_name    text,
  uploaded_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE professor_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_prof_docs" ON professor_documents;
CREATE POLICY "anon_select_prof_docs" ON professor_documents
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_prof_docs" ON professor_documents;
CREATE POLICY "anon_insert_prof_docs" ON professor_documents
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_prof_docs" ON professor_documents;
CREATE POLICY "anon_update_prof_docs" ON professor_documents
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "anon_delete_prof_docs" ON professor_documents;
CREATE POLICY "anon_delete_prof_docs" ON professor_documents
  FOR DELETE USING (true);

-- ── Bucket storage "legajos" ───────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('legajos', 'legajos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "legajos_select" ON storage.objects;
CREATE POLICY "legajos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'legajos');

DROP POLICY IF EXISTS "legajos_insert" ON storage.objects;
CREATE POLICY "legajos_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'legajos');

DROP POLICY IF EXISTS "legajos_update" ON storage.objects;
CREATE POLICY "legajos_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'legajos');

DROP POLICY IF EXISTS "legajos_delete" ON storage.objects;
CREATE POLICY "legajos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'legajos');
