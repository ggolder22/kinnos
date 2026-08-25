-- ═══════════════════════════════════════════════════
--  Módulo de Horarios (grilla semanal por curso) — Kinnos
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schedules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,  -- opcional, para filtrar por institución más adelante
  curso          text NOT NULL,   -- Ej: "CENT N° 18"  (etiqueta libre de la institución/carrera)
  anio           int  NOT NULL,   -- 1, 2, 3…
  division       text,            -- "A", "B"… null si el año no está dividido
  periodo        text,            -- Ej: "2do Cuatrimestre 2026"
  day            text NOT NULL CHECK (day IN ('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado')),
  time_start     text NOT NULL,   -- "17:40" (24hs, con cero a la izquierda para que ordene bien como texto)
  time_end       text NOT NULL,   -- "18:20"
  subject_name   text NOT NULL,
  professor_name text,
  is_consulta    bool DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

-- Si ya habías creado la tabla antes de tener año/división separados, esto las agrega
-- (en una tabla recién creada arriba, estas dos líneas no hacen nada — ya existen):
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS anio int;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS division text;

-- Migra filas viejas que tenían todo junto en "curso" (ej: "CENT N° 18 · 1° B")
UPDATE schedules SET
  anio     = COALESCE(anio, (regexp_match(curso, '(\d+)°'))[1]::int),
  division = COALESCE(division, (regexp_match(curso, '°\s*([A-Za-z])'))[1]),
  curso    = trim(regexp_replace(curso, '\s*[·-]?\s*\d+°\s*[A-Za-z]?\s*$', ''))
WHERE anio IS NULL AND curso ~ '\d+°';

-- El índice va después de que anio/division ya existan en la tabla
CREATE INDEX IF NOT EXISTS idx_schedules_anio_division ON schedules(anio, division);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Lectura pública: el horario se muestra incluso antes de iniciar sesión (pantalla de login)
DROP POLICY IF EXISTS "anon_all_schedules" ON schedules;
CREATE POLICY "anon_all_schedules"
  ON schedules FOR ALL TO anon USING (true) WITH CHECK (true);
