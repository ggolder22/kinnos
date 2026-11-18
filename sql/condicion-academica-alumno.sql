-- ═══════════════════════════════════════════════════
--  Condición académica de cada alumno en cada materia — Kinnos
--
--  Regular / Promocional / Libre. La carga el profesor desde
--  Calificaciones → "Cargar notas" (columna "Condición", al lado de
--  Observaciones). Es UNA por alumno y materia en cada ciclo lectivo:
--  vale para todas las instancias de calificación.
--
--  La usan:
--    · El listado "Condición académica" (PDF / Excel)
--    · El filtro de las actas de examen (Todos / Promocionales /
--      Regulares / Libres)
--
--  No confundir con subject_conditions (condicion-materia.sql), que es
--  la condición de la MATERIA (si se dicta como Regular o Promocional).
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS student_academic_conditions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  anio_academico  int  NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  condicion       text NOT NULL CHECK (condicion IN ('Regular', 'Promocional', 'Libre')),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, student_id, anio_academico)
);

CREATE INDEX IF NOT EXISTS idx_student_acad_cond_subject
  ON student_academic_conditions(subject_id, anio_academico);

-- ── RLS (mismo esquema que calificaciones-manuales.sql) ──
ALTER TABLE student_academic_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_student_academic_conditions" ON student_academic_conditions;
CREATE POLICY "anon_all_student_academic_conditions"
  ON student_academic_conditions FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Logo de la institución en las actas ──
-- Las actas usan institutions.logo_url (arriba a la derecha). Si la
-- institución todavía no tiene logo, se usa el del CENT 18 que viene
-- con la app. Revisá que el WHERE agarre la institución correcta:
--   SELECT id, name, logo_url FROM institutions;
UPDATE institutions
   SET logo_url = '/img/actas/logo-cent18.png'
 WHERE logo_url IS NULL
   AND (name ILIKE '%CENT%18%' OR name ILIKE '%terciario%18%');

NOTIFY pgrst, 'reload schema';
