-- ═══════════════════════════════════════════════════
--  Módulo de Horarios (grilla semanal por curso) — Kinnos
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schedules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,  -- opcional, para filtrar por institución más adelante
  curso          text NOT NULL,   -- Ej: "CENT N° 18 · 1° B"  (etiqueta libre: institución + curso/división)
  periodo        text,            -- Ej: "2do Cuatrimestre 2026"
  day            text NOT NULL CHECK (day IN ('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado')),
  time_start     text NOT NULL,   -- "17:40" (24hs, con cero a la izquierda para que ordene bien como texto)
  time_end       text NOT NULL,   -- "18:20"
  subject_name   text NOT NULL,
  professor_name text,
  is_consulta    bool DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedules_curso ON schedules(curso);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Lectura pública: el horario se muestra incluso antes de iniciar sesión (pantalla de login)
CREATE POLICY "anon_all_schedules"
  ON schedules FOR ALL TO anon USING (true) WITH CHECK (true);
