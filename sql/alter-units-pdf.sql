-- ═══════════════════════════════════════════════════
--  Soporte de varios PDFs por unidad — Kinnos
--  Ejecutar una sola vez en el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS pdf_urls jsonb DEFAULT '[]';
  -- lista de PDFs: [{ "name": "Guía.pdf", "url": "https://..." }, ...]
  -- el viejo campo pdf_url (un solo archivo) queda como legado, no se borra
