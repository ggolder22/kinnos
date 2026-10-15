-- ═══════════════════════════════════════════════════
--  Módulo de Asistencia — Kinnos
--  Diseño: autogestión total del alumno. La ventana para marcar
--  presente se calcula sola a partir del cronograma (tabla `schedules`,
--  ver alter-schedules-subject-link.sql): arranca en el horario de
--  inicio de la materia y dura 30 minutos. Fuera de esa ventana no
--  hay forma de registrar nada — ni el profesor "abre" ni "cierra" nada.
--  El profesor conserva la corrección manual (tardanza avalada por
--  preceptoría, justificación, alguien que se olvidó de tildar, etc.)
-- ═══════════════════════════════════════════════════

-- 1. Una clase dictada = una sesión de asistencia (materia + fecha).
--    Se crea sola la primera vez que hace falta (un alumno se marca,
--    o el profesor corrige a alguien) — nadie la "abre" a mano.
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    uuid REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  session_date  date NOT NULL,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(subject_id, session_date)
);

-- 2. Estado de cada alumno en esa sesión
CREATE TABLE IF NOT EXISTS attendance_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid REFERENCES attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id     uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  status         text NOT NULL CHECK (status IN ('presente', 'ausente', 'tarde', 'justificada')) DEFAULT 'ausente',
  marked_by_role text NOT NULL DEFAULT 'student' CHECK (marked_by_role IN ('student', 'professor', 'system')),
  marked_by      uuid,              -- id del alumno o del profesor según marked_by_role; null si lo completó el sistema
  notes          text,              -- ej: motivo de la justificación
  marked_at      timestamptz DEFAULT now(),
  UNIQUE(session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_subject ON attendance_sessions(subject_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session  ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student  ON attendance_records(student_id);

-- ── Si ya habías creado una versión anterior de este módulo, esto la
--    migra sin perder nada (las columnas de apertura/cierre manual
--    quedan en desuso pero no se borran, por las dudas): ─────────────
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_marked_by_fkey;
ALTER TABLE attendance_records ALTER COLUMN marked_by DROP NOT NULL;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS marked_by_role text NOT NULL DEFAULT 'student';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS marked_at timestamptz DEFAULT now();

-- Amplía el check de marked_by_role para incluir 'system' (registros que completa
-- el propio sistema al vencer la ventana), por si ya existía con el check viejo
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_marked_by_role_check;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_marked_by_role_check CHECK (marked_by_role IN ('student', 'professor', 'system'));

-- Si la versión anterior tenía "updated_at", se copia a "marked_at" y se borra
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
