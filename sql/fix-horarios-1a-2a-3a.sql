-- ═══════════════════════════════════════════════════
--  Corrección de vínculos horario ↔ materia para 1°A, 2°A, 3°A
--  (complementa sql/seed-schedules-1a-2a-3a.sql, que ya corriste)
--
--  Qué hace, en dos partes:
--
--  PARTE 1 — Crea 3 materias nuevas para 1°A, porque hoy "Energía Solar
--  Térmica", "Informática Aplicada" y "Prácticas Profesionalizantes I"
--  solo existen cargadas para la división B. Se crean independientes
--  (contenido/exámenes propios), con el mismo profesor que figura en el
--  horario de 1°A. Es idempotente: si ya existen, no las duplica.
--
--  PARTE 2 — Vincula a mano (vía subject_id) 7 horarios cuyo texto o año
--  no coincide exactamente con la materia real en Kinnos:
--    - "Energía Minihidráulica y Geotérmica" (horario) → "Energía Minihidráulica" (materia, 2°)
--    - "Prácticas Profesionalizantes III" (horario, 2°A) → "Práctica Profesionalizante II" (materia, 2°)
--    - "Marco Jurídico" (horario, 2°A) → misma materia, pero está cargada como de 3° año
--    - "Uso Racional de la Energía" (horario, 2°A) → misma materia, cargada como de 3° año
--    - "Gestión de Proyectos de Inversión" (horario, 3°A) → "Gestión de Proyectos" (materia, 2°)
--    - "Práctica Profesionalizante V" (horario, 3°A) → "Práctica Profesionalizante III" (materia, 3°)
--    - "Ética Profesional y Deontología" (horario, 3°A) → "Ética y Deontología Profesional" (materia, 3°)
--  No se cambia el año/división de ningún horario (eso representa qué
--  curso físico tiene clase ese día — se deja como está), y no se toca
--  ninguna materia existente. Solo se le dice a Kinnos "este bloque de
--  horario es de ESTA materia", usando el mismo mecanismo manual que ya
--  existe en Admin → Plan de Estudios → botón "Horarios".
-- ═══════════════════════════════════════════════════

-- ───────────── PARTE 1: materias nuevas para 1°A ─────────────

INSERT INTO subjects (career_id, name, year, division)
SELECT '41bdec2b-4de8-442a-bbe3-d7c987e14423', v.name, 1, 'A'
FROM (VALUES
  ('Energía Solar Térmica'),
  ('Informática Aplicada'),
  ('Prácticas Profesionalizantes I')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM subjects s WHERE s.year = 1 AND s.division = 'A' AND s.name = v.name
);

-- Profesores, según lo que figura en el horario de 1°A:
--   Informática Aplicada              -> Leguiza, Adrián
--   Energía Solar Térmica             -> Procopio, Alejandro
--   Prácticas Profesionalizantes I    -> Procopio, Alejandro
INSERT INTO professor_subjects (professor_id, subject_id, is_primary)
SELECT p.id, s.id, true
FROM subjects s
JOIN (VALUES
  ('Informática Aplicada',           '2ffc0ac9-08b6-4f5f-91a9-dfb31507f3c6'::uuid),
  ('Energía Solar Térmica',          'fb70b261-9cf4-41c7-88a7-cd10f16dd700'::uuid),
  ('Prácticas Profesionalizantes I', 'fb70b261-9cf4-41c7-88a7-cd10f16dd700'::uuid)
) AS link(subject_name, professor_id) ON link.subject_name = s.name
JOIN professors p ON p.id = link.professor_id
WHERE s.year = 1 AND s.division = 'A'
AND NOT EXISTS (
  SELECT 1 FROM professor_subjects ps WHERE ps.subject_id = s.id AND ps.professor_id = p.id
);

-- ───────────── PARTE 2: vínculo explícito de horarios desfasados ─────────────

UPDATE schedules SET subject_id = 'fdc0a3b2-67b2-4b61-8c32-7d1480b094f6' -- Energía Minihidráulica (2°)
WHERE anio = 2 AND division = 'A' AND subject_name = 'Energía Minihidráulica y Geotérmica';

UPDATE schedules SET subject_id = '38be8f5d-b804-459d-bf21-f5ce93fb7efa' -- Práctica Profesionalizante II (2°)
WHERE anio = 2 AND division = 'A' AND subject_name = 'Prácticas Profesionalizantes III';

UPDATE schedules SET subject_id = '312442bf-956f-4e3c-9a52-0d35c5512446' -- Marco Jurídico (3°)
WHERE anio = 2 AND division = 'A' AND subject_name = 'Marco Jurídico';

UPDATE schedules SET subject_id = '4e898a79-feeb-43ee-b4de-5dbdb487cd86' -- Uso Racional de la Energía (3°)
WHERE anio = 2 AND division = 'A' AND subject_name = 'Uso Racional de la Energía';

UPDATE schedules SET subject_id = '2e15cde5-faa4-4cd6-ab38-84901a52bf51' -- Gestión de Proyectos (2°)
WHERE anio = 3 AND division = 'A' AND subject_name = 'Gestión de Proyectos de Inversión';

UPDATE schedules SET subject_id = '521f3114-c168-4c00-8760-94e117b8afeb' -- Práctica Profesionalizante III (3°)
WHERE anio = 3 AND division = 'A' AND subject_name = 'Práctica Profesionalizante V';

UPDATE schedules SET subject_id = '62f93222-055c-43d2-abb1-74bdadaa3796' -- Ética y Deontología Profesional (3°)
WHERE anio = 3 AND division = 'A' AND subject_name = 'Ética Profesional y Deontología';
