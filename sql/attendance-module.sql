-- ═══════════════════════════════════════════════════
--  Módulo de Asistencia — Kinnos
--  Diseño: autogestión del alumno, habilitada por el profesor.
--  El profesor "abre" la clase del día (con una ventana de minutos);
--  solo mientras está abierta, el alumno puede tildar su propia
--  presencia. Fuera de esa ventana no hay forma de registrar nada.
--  El profesor conserva la posibilidad de corregir manualmente
--  (tardanza, justificación, alguien que se olvidó de tildar, etc.)
-- ═══════════════════════════════════════════════════

-- 1. Una clase dictada = una sesión de asistencia (materia + fecha)
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    uuid REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  session_date  date NOT NULL,
  status        text NOT NULL DEFAULT 'cerrada' CHECK (status IN ('abierta', 'cerrada')),
  opened_at     timestamptz,     -- cuándo el profesor abrió la ventana
  closes_at     timestamptz,     -- fin de la ventana (opened_at + minutos elegidos)
  closed_at     timestamptz,     -- cuándo se cerró efectivamente (manual o por vencimiento)
  created_by    uuid REFERENCES professors(id) ON DELETE SET NULL,  -- profesor que abrió la clase
  created_at    timestamptz DEFAULT now(),
  UNIQUE(subject_id, session_date)
);

-- 2. Estado de cada alumno en esa sesión
CREATE TABLE IF NOT EXISTS attendance_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid REFERENCES attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id     uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  status         text NOT NULL CHECK (status IN ('presente', 'ausente', 'tarde', 'justificada')) DEFAULT 'ausente',
  marked_by_role text NOT NULL DEFAULT 'student' CHECK (marked_by_role IN ('student', 'professor')),
  marked_by      uuid,              -- id del alumno (autoregistro) o del profesor (corrección) según marked_by_role
  notes          text,              -- ej: motivo de la justificación
  marked_at      timestamptz DEFAULT now(),
  UNIQUE(session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_subject ON attendance_sessions(subject_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session  ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student  ON attendance_records(student_id);

-- ── Si ya habías creado la versión anterior (toma manual por el profesor),
--    esto la migra a la nueva sin perder nada: ──────────────────────────
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS status    text NOT NULL DEFAULT 'cerrada';
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS opened_at timestamptz;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS closes_at timestamptz;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS closed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_sessions_status_check') THEN
    ALTER TABLE attendance_sessions ADD CONSTRAINT attendance_sessions_status_check CHECK (status IN ('abierta', 'cerrada'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_marked_by_role_check') THEN
    ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_marked_by_role_check CHECK (marked_by_role IN ('student', 'professor'));
  END IF;
END $$;

ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_marked_by_fkey;
ALTER TABLE attendance_records ALTER COLUMN marked_by DROP NOT NULL;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS marked_by_role text NOT NULL DEFAULT 'student';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS marked_at timestamptz DEFAULT now();

-- Si la versión anterior tenía "updated_at" (toma manual del profesor), se copia a "marked_at" y se borra
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_records' AND column_name = 'updated_at'
  ) THEN
    UPDATE attendance_records SET marked_at = updated_at WHERE marked_at IS NULL OR marked_at = now();
    ALTER TABLE attendance_records DROP COLUMN updated_at;
  END IF;
END $$;

-- ── RLS ──────────────────────────────────────────────
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_attendance_sessions" ON attendance_sessions;
CREATE POLICY "anon_all_attendance_sessions"
  ON attendance_sessions FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_attendance_records" ON attendance_records;
CREATE POLICY "anon_all_attendance_records"
  ON attendance_records FOR ALL TO anon USING (true) WITH CHECK (true);
