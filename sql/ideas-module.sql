-- ═══════════════════════════════════════════════════
--  Módulo de Ideas — Kinnos
--  Tablero compartido entre admin, profesores y preceptores para anotar
--  ideas a desarrollar en la app y tildar las que ya se hicieron.
--  No se muestra en el panel del alumno.
--  Los adjuntos (archivos y capturas) van al bucket "materiales",
--  carpeta ideas/<id de la nota>/.
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dev_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body         text NOT NULL,
  author_role  text NOT NULL CHECK (author_role IN ('admin', 'profesor', 'preceptor')),
  author_id    uuid,              -- id del profesor/preceptor; null para el admin
  author_name  text NOT NULL,
  attachments  jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ url, path, name, type, size }]
  is_done      bool NOT NULL DEFAULT false,
  done_at      timestamptz,
  done_by_name text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_notes_created ON dev_notes(created_at DESC);

-- ── RLS (mismo esquema que el resto de los módulos) ──
ALTER TABLE dev_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_dev_notes" ON dev_notes;
CREATE POLICY "anon_all_dev_notes"
  ON dev_notes FOR ALL TO anon USING (true) WITH CHECK (true);
