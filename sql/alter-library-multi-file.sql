-- ═══════════════════════════════════════════════════
--  Varios archivos por recurso de biblioteca — Kinnos
--  Columna nueva y NULLABLE: no se toca `file_url` (queda de legado
--  para los recursos ya cargados con un solo archivo).
-- ═══════════════════════════════════════════════════

ALTER TABLE library_resources ADD COLUMN IF NOT EXISTS file_urls jsonb DEFAULT '[]';
-- lista de archivos: [{ "name": "Manual.pdf", "url": "https://..." }, ...]
