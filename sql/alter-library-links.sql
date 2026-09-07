-- ═══════════════════════════════════════════════════
--  Biblioteca: permitir documentos + varios links en la misma entrada
--  Columna nueva y NULLABLE: no se tocan video_url/external_url,
--  quedan de legado para los recursos ya cargados.
-- ═══════════════════════════════════════════════════

ALTER TABLE library_resources ADD COLUMN IF NOT EXISTS external_links jsonb DEFAULT '[]';
-- lista de links: [{ "name": "Simulador de circuitos", "url": "https://...", "type": "link" | "video" }, ...]

-- Migra los recursos viejos que tenían un solo video_url o external_url a la lista nueva
UPDATE library_resources SET external_links =
  CASE
    WHEN video_url    IS NOT NULL THEN jsonb_build_array(jsonb_build_object('name', title, 'url', video_url,    'type', 'video'))
    WHEN external_url IS NOT NULL THEN jsonb_build_array(jsonb_build_object('name', title, 'url', external_url, 'type', 'link'))
    ELSE '[]'::jsonb
  END
WHERE (external_links IS NULL OR external_links = '[]'::jsonb)
  AND (video_url IS NOT NULL OR external_url IS NOT NULL);

-- El campo "type" ya no determina qué se puede cargar (ahora se combina todo en una entrada),
-- así que deja de ser obligatorio.
ALTER TABLE library_resources ALTER COLUMN type DROP NOT NULL;
ALTER TABLE library_resources DROP CONSTRAINT IF EXISTS library_resources_type_check;
