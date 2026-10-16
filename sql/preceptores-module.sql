-- ═══════════════════════════════════════════════════
--  Módulo de Preceptores — Kinnos
--  Rol nuevo, de alcance institucional (no por materia):
--  ve a todos los alumnos de todos los años y divisiones de SU
--  institución, puede corregir asistencia de cualquiera y subir
--  certificados que justifiquen faltas.
-- ═══════════════════════════════════════════════════

-- 1. Preceptores (igual patrón que professors, el admin los da de alta directo
--    con DNI — sin flujo de aprobación, porque no hay autorregistro público)
CREATE TABLE IF NOT EXISTS preceptors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      text NOT NULL,
  dni            text UNIQUE NOT NULL,
  email          text,
  phone          text,
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preceptors_institution ON preceptors(institution_id);

-- 2. Certificados de alumnos (médicos, de alumno regular, etc.) — quedan
--    guardados en la base y, opcionalmente, vinculados a una falta puntual
--    que justifican.
CREATE TABLE IF NOT EXISTS student_certificates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  file_url              text NOT NULL,
  file_name             text,
  reason                text,              -- ej: "Certificado médico", "Trámite"
  attendance_record_id  uuid REFERENCES attendance_records(id) ON DELETE SET NULL,
  uploaded_by           uuid REFERENCES preceptors(id) ON DELETE SET NULL,
  uploaded_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_student ON student_certificates(student_id);

-- El preceptor también corrige asistencia — amplía el check para admitirlo
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_marked_by_role_check;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_marked_by_role_check
  CHECK (marked_by_role IN ('student', 'professor', 'system', 'preceptor'));

-- ── RLS ──────────────────────────────────────────────
ALTER TABLE preceptors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_preceptors" ON preceptors;
CREATE POLICY "anon_all_preceptors"
  ON preceptors FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_student_certificates" ON student_certificates;
CREATE POLICY "anon_all_student_certificates"
  ON student_certificates FOR ALL TO anon USING (true) WITH CHECK (true);
