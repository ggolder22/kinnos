-- ============================================================
-- KINNOS — Plan de estudios: Técnico Superior en Gestión
--          de Energía Renovable
-- Busca la carrera por nombre (ILIKE). Ejecutar DESPUÉS de
-- haber creado la institución y la carrera en el sistema.
-- ============================================================

WITH carrera AS (
  SELECT id FROM careers
  WHERE name ILIKE '%Energía Renovable%'
  LIMIT 1
)
INSERT INTO subjects (career_id, name, year, despliegue, campo_formacion, hs_semana, hs_total)
SELECT carrera.id, data.name, data.year, data.despliegue, data.campo_formacion, data.hs_semana, data.hs_total
FROM carrera, (VALUES
  -- ── Año 1 ──────────────────────────────────────────────────
  ('Alfabetización Académica',                            1, 'Cuatrimestre 1', 'General',                4,  64),
  ('Tecnología, Ambiente y Sociedad',                     1, 'Cuatrimestre 1', 'General',                4,  64),
  ('Energías Renovables',                                 1, 'Cuatrimestre 1', 'Específica',             5,  80),
  ('Matemática Aplicada',                                 1, 'Anual',          'Fundamento',             5, 160),
  ('Electrotecnia',                                       1, 'Anual',          'Específica',             5, 160),
  ('Química Aplicada',                                    1, 'Cuatrimestre 1', 'Fundamento',             4,  64),
  ('Informática Aplicada',                                1, 'Cuatrimestre 1', 'Fundamento',             4,  64),
  ('Energía Solar Térmica',                               1, 'Cuatrimestre 1', 'Específica',             5,  80),
  ('Instalaciones Eléctricas',                            1, 'Cuatrimestre 1', 'Específica',             4,  64),
  ('Práctica Profesionalizante I',                        1, 'Cuatrimestre 1', 'P. Profesionalizantes',  6,  96),
  -- ── Año 2 ──────────────────────────────────────────────────
  ('Información Técnica y Representación Gráfica',        2, 'Cuatrimestre 1', 'Específica',             4,  64),
  ('Energía Solar Fotovoltaica',                          2, 'Cuatrimestre 1', 'Específica',             4,  64),
  ('Hab. Socioemocionales para el Mundo del Trabajo',     2, 'Cuatrimestre 1', 'General',                5,  80),
  ('Gestión de Proyectos',                                2, 'Cuatrimestre 1', 'Fundamento',             5,  80),
  ('Práctica Profesionalizante II',                       2, 'Anual',          'P. Profesionalizantes',  7, 224),
  ('Energía de la Biomasa',                               2, 'Cuatrimestre 1', 'Específica',             4,  64),
  ('Energía Eólica',                                      2, 'Cuatrimestre 1', 'Específica',             4,  64),
  ('Energía Minihidráulica',                              2, 'Cuatrimestre 1', 'Específica',             4,  64),
  ('Instalaciones Térmicas Eficientes',                   2, 'Cuatrimestre 1', 'Específica',             5,  80),
  -- ── Año 3 ──────────────────────────────────────────────────
  ('Uso Racional de la Energía',                          3, 'Cuatrimestre 1', 'Específica',             4,  64),
  ('Gestión de Centrales de Energías Renovables',         3, 'Cuatrimestre 1', 'Específica',             4,  64),
  ('Arquitectura Bioclimática',                           3, 'Cuatrimestre 1', 'Específica',             4,  64),
  ('Marco Jurídico',                                      3, 'Cuatrimestre 1', 'Fundamento',             3,  48),
  ('Inglés Técnico',                                      3, 'Cuatrimestre 1', 'Fundamento',             4,  64),
  ('Práctica Profesionalizante III',                      3, 'Anual',          'P. Profesionalizantes',  7, 224),
  ('Ética y Deontología Profesional',                     3, 'Cuatrimestre 1', 'General',                3,  48),
  ('Gestión de Seguridad, Salud Ocupacional y Medio Ambiente', 3, 'Cuatrimestre 1', 'Específica',        4,  64),
  ('Inmótica y Domótica',                                 3, 'Cuatrimestre 1', 'Específica',             4,  64),
  ('Emprendedurismo',                                     3, 'Cuatrimestre 1', 'Específica',             5,  80)
) AS data(name, year, despliegue, campo_formacion, hs_semana, hs_total);
