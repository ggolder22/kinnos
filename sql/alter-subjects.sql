-- ============================================================
-- KINNOS — Agrega campos del plan de estudios a subjects
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS despliegue      text,        -- 'Cuatrimestre 1' | 'Cuatrimestre 2' | 'Anual'
  ADD COLUMN IF NOT EXISTS campo_formacion text,        -- 'General' | 'Específica' | 'Fundamento' | 'P. Profesionalizantes'
  ADD COLUMN IF NOT EXISTS hs_semana       integer,     -- Horas cátedra por semana
  ADD COLUMN IF NOT EXISTS hs_total        integer;     -- Horas cátedra totales
