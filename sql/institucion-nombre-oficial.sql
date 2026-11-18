-- ═══════════════════════════════════════════════════
--  Nombre oficial de la institución — Kinnos
--
--  institutions.name           → nombre corto, el que se ve en toda la app
--                                 y en "Institución Educativa:" de las actas
--                                 (ej: "CENT Nº 18")
--  institutions.nombre_oficial → nombre completo para el encabezado de las
--                                 actas (ej: "Centro Educativo de Nivel
--                                 Terciario Nº 18"). Si está vacío, las actas
--                                 usan `name`.
--
--  Se edita desde el panel Super Admin → Instituciones → Editar.
-- ═══════════════════════════════════════════════════

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS nombre_oficial text;

-- CENT 18: nombre oficial como en el modelo de actas, y se corrige
-- "Nª" (ordinal femenino) por "Nº".
UPDATE institutions
   SET nombre_oficial = 'Centro Educativo de Nivel Terciario Nº 18',
       name           = replace(name, 'Nª', 'Nº')
 WHERE logo_url = '/img/actas/logo-cent18.png';

NOTIFY pgrst, 'reload schema';
