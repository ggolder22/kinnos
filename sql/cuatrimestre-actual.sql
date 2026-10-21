-- ═══════════════════════════════════════════════════
--  Cuatrimestre actual — Kinnos
--  El campo "despliegue" de las materias (Cuatrimestre 1 / Cuatrimestre 2 /
--  Anual) ya existía, pero no había forma de saber en qué cuatrimestre
--  está la institución "ahora" para poder filtrar con eso.
--
--  PARTE 1 — agrega institutions.cuatrimestre_actual y lo deja en
--  "Cuatrimestre 2" (así estamos hoy).
--
--  PARTE 2 — corrige el despliegue de 14 materias que decían
--  "Cuatrimestre 1" (o estaban vacías) pero en realidad se están
--  dictando ahora mismo, en el Segundo Cuatrimestre — tienen horario
--  real cargado y, varias, hasta exámenes ya rendidos este cuatrimestre.
-- ═══════════════════════════════════════════════════

-- ───────────── PARTE 1: cuatrimestre actual por institución ─────────────

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS cuatrimestre_actual text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'institutions_cuatrimestre_check') THEN
    ALTER TABLE institutions ADD CONSTRAINT institutions_cuatrimestre_check
      CHECK (cuatrimestre_actual IN ('Cuatrimestre 1', 'Cuatrimestre 2'));
  END IF;
END $$;

UPDATE institutions SET cuatrimestre_actual = 'Cuatrimestre 2' WHERE cuatrimestre_actual IS NULL;

-- ───────────── PARTE 2: corregir despliegue desactualizado ─────────────

UPDATE subjects SET despliegue = 'Cuatrimestre 2'
WHERE year = 1 AND division = 'A' AND name IN ('Energía Solar Térmica', 'Informática Aplicada', 'Prácticas Profesionalizantes I');

UPDATE subjects SET despliegue = 'Cuatrimestre 2'
WHERE year = 1 AND division = 'B' AND name IN ('Energía Solar Térmica', 'Informática Aplicada', 'Prácticas Profesionalizantes I');

UPDATE subjects SET despliegue = 'Cuatrimestre 2'
WHERE year = 1 AND division IS NULL AND name IN ('Instalaciones Eléctricas', 'Química Aplicada');

UPDATE subjects SET despliegue = 'Cuatrimestre 2'
WHERE year = 2 AND division = 'A' AND name IN ('Energía Eólica', 'Energía Minihidráulica', 'Gestión de Proyectos');

UPDATE subjects SET despliegue = 'Cuatrimestre 2'
WHERE year = 3 AND division = 'A' AND name IN ('Ética y Deontología Profesional', 'Marco Jurídico', 'Uso Racional de la Energía');
