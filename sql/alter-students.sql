-- ============================================================
-- KINNOS — Agrega institution_id a la tabla students
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL;
