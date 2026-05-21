-- ============================================================
-- KINNOS — Agregar status e institution_id a professors
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE professors
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'rejected')),
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL;

-- Índice para filtrar por estado rápido
CREATE INDEX IF NOT EXISTS idx_professors_status ON professors(status);
