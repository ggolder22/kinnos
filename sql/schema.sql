-- ============================================================
-- KINNOS — Schema principal
-- Ejecutar en Supabase SQL Editor (proyecto nuevo)
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE institutions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  address     text,
  logo_url    text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE careers (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE subjects (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  career_id   uuid NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  name        text NOT NULL,
  year        int,
  join_code   text UNIQUE,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE professors (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name   text NOT NULL,
  dni         text UNIQUE NOT NULL,
  email       text,
  phone       text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE students (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name   text NOT NULL,
  dni         text UNIQUE NOT NULL,
  email       text,
  phone       text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE professor_subjects (
  professor_id uuid NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  subject_id   uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  is_primary   bool DEFAULT false,
  PRIMARY KEY (professor_id, subject_id)
);

CREATE TABLE student_subjects (
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id  uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  PRIMARY KEY (student_id, subject_id)
);

CREATE TABLE units (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id  uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  unit_num    int NOT NULL,
  title       text NOT NULL,
  tag         text,
  topics      jsonb DEFAULT '[]',
  content     text,
  pdf_url     text,
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE exams (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id   uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title        text NOT NULL,
  is_active    bool DEFAULT false,
  time_limit   int,
  instructions text,
  unit_ids     jsonb DEFAULT '[]',
  is_practice  bool DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE exam_questions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id        uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_text  text NOT NULL,
  type           text NOT NULL CHECK (type IN ('multiple', 'truefalse', 'short')),
  options        jsonb DEFAULT '[]',
  correct_answer text,
  points         numeric DEFAULT 1,
  order_num      int NOT NULL
);

CREATE TABLE exam_results (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_id     uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  score       numeric,
  answers     jsonb DEFAULT '{}',
  started_at  timestamptz DEFAULT now(),
  taken_at    timestamptz
);

CREATE TABLE announcements (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id  uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text,
  is_pinned   bool DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX ON careers(institution_id);
CREATE INDEX ON subjects(career_id);
CREATE INDEX ON professor_subjects(subject_id);
CREATE INDEX ON student_subjects(subject_id);
CREATE INDEX ON student_subjects(student_id);
CREATE INDEX ON units(subject_id);
CREATE INDEX ON exams(subject_id);
CREATE INDEX ON exam_questions(exam_id);
CREATE INDEX ON exam_results(student_id);
CREATE INDEX ON exam_results(exam_id);
CREATE INDEX ON announcements(subject_id);

-- ============================================================
-- JOIN CODE AUTOMÁTICO
-- ============================================================

CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TRIGGER AS $$
DECLARE
  prefix   text;
  new_code text;
  attempts int := 0;
BEGIN
  IF NEW.join_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Prefijo: primeras 4 letras del nombre de la materia
  prefix := UPPER(REGEXP_REPLACE(NEW.name, '[^A-Za-z]', '', 'g'));
  prefix := LEFT(prefix, 4);
  IF LENGTH(prefix) < 2 THEN
    prefix := 'MAT';
  END IF;

  LOOP
    new_code := prefix || '-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 4));
    IF NOT EXISTS (SELECT 1 FROM subjects WHERE join_code = new_code) THEN
      NEW.join_code := new_code;
      RETURN NEW;
    END IF;
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'No se pudo generar un join_code único';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subjects_join_code
  BEFORE INSERT ON subjects
  FOR EACH ROW EXECUTE FUNCTION generate_join_code();

-- ============================================================
-- RLS — Row Level Security
-- El frontend usa la anon key (solo lectura controlada).
-- Las escrituras van por funciones serverless (service_role).
-- ============================================================

ALTER TABLE institutions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE careers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE professors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE students           ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_subjects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE units              ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;

-- Lectura pública (anon) — el frontend filtra por lógica de sesión
CREATE POLICY "anon_read" ON institutions       FOR SELECT USING (true);
CREATE POLICY "anon_read" ON careers            FOR SELECT USING (true);
CREATE POLICY "anon_read" ON subjects           FOR SELECT USING (true);
CREATE POLICY "anon_read" ON professors         FOR SELECT USING (true);
CREATE POLICY "anon_read" ON students           FOR SELECT USING (true);
CREATE POLICY "anon_read" ON professor_subjects FOR SELECT USING (true);
CREATE POLICY "anon_read" ON student_subjects   FOR SELECT USING (true);
CREATE POLICY "anon_read" ON units              FOR SELECT USING (true);
CREATE POLICY "anon_read" ON exams              FOR SELECT USING (true);
CREATE POLICY "anon_read" ON exam_questions     FOR SELECT USING (true);
CREATE POLICY "anon_read" ON exam_results       FOR SELECT USING (true);
CREATE POLICY "anon_read" ON announcements      FOR SELECT USING (true);
