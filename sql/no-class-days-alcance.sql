-- ═══════════════════════════════════════════════════
--  Alcance por año/división en el Calendario de días sin clase
--
--  Hasta ahora un día cargado acá siempre afectaba a TODA la
--  institución. Ahora se puede declarar también para un año puntual
--  (ambas divisiones) o para un año + división específicos — sin
--  dejar de poder seguir usando "toda la institución" como hasta hoy.
--
--  anio/division en NULL = sin acotar (si los dos quedan NULL, es
--  "toda la institución", el comportamiento de siempre). No se borra
--  ni se toca ningún día ya cargado: todos quedan con anio/division
--  en NULL automáticamente, o sea "toda la institución", exactamente
--  como ya funcionaban.
-- ═══════════════════════════════════════════════════

ALTER TABLE no_class_days ADD COLUMN IF NOT EXISTS anio     int;
ALTER TABLE no_class_days ADD COLUMN IF NOT EXISTS division text;

-- Antes solo podía existir UN día cargado por institución+fecha. Ahora
-- puede haber varios (uno institucional + uno o más acotados), así que
-- esa restricción vieja ya no aplica.
ALTER TABLE no_class_days DROP CONSTRAINT IF EXISTS no_class_days_institution_id_day_date_key;

-- Pero sigue sin poder haber DOS declaraciones para el mismo alcance exacto
-- (misma institución + fecha + año + división).
CREATE UNIQUE INDEX IF NOT EXISTS uq_no_class_days_scope
  ON no_class_days (institution_id, day_date, COALESCE(anio, 0), COALESCE(division, ''));

NOTIFY pgrst, 'reload schema';
