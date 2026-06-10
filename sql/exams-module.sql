-- ═══════════════════════════════════════════════════
--  Módulo de Exámenes — Kinnos
-- ═══════════════════════════════════════════════════

-- 1. Tabla exams
CREATE TABLE IF NOT EXISTS exams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    uuid REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  title         text NOT NULL,
  instructions  text,
  pdf_url       text,
  time_limit    int,                -- minutos; null = sin límite
  is_active     bool DEFAULT false,
  is_practice   bool DEFAULT false,
  unit_ids      jsonb DEFAULT '[]',
  created_at    timestamptz DEFAULT now()
);

-- 2. Tabla exam_questions
CREATE TABLE IF NOT EXISTS exam_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id        uuid REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  order_num      int NOT NULL DEFAULT 1,
  question_text  text NOT NULL,
  type           text NOT NULL DEFAULT 'multiple'
                   CHECK (type IN ('multiple', 'truefalse', 'short')),
  options        jsonb,            -- solo para type='multiple': ["Opción A", "Opción B", ...]
  correct_answer text NOT NULL,
  points         numeric DEFAULT 1
);

-- 3. Tabla exam_results
CREATE TABLE IF NOT EXISTS exam_results (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id                 uuid REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  student_id              uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  answers                 jsonb DEFAULT '{}',
  score                   numeric DEFAULT 0,  -- % auto-calculado (0-100)
  professor_score         numeric,            -- override docente (0-100), nullable
  professor_notes         text,
  professor_adjustments   jsonb DEFAULT '{}', -- { "q_id": true|false } para cortas
  status                  text DEFAULT 'in_progress'
                            CHECK (status IN ('in_progress','submitted','confirmed')),
  started_at              timestamptz DEFAULT now(),
  submitted_at            timestamptz,
  confirmed_at            timestamptz,
  UNIQUE(student_id, exam_id)
);

-- ── RLS ──────────────────────────────────────────────
ALTER TABLE exams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_exams"
  ON exams FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_exam_questions"
  ON exam_questions FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_exam_results"
  ON exam_results FOR ALL TO anon USING (true) WITH CHECK (true);
