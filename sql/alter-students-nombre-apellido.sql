-- ═══════════════════════════════════════════════════
--  Nombre y apellido separados — Kinnos
--  Columnas nuevas y NULLABLE: no se toca ni se borra `full_name`,
--  que sigue existiendo y se sigue usando en todo el resto de la app.
--  Los alumnos ya cargados quedan con estas columnas en NULL hasta
--  que alguien (el alumno o el administrador) los edite y las complete.
-- ═══════════════════════════════════════════════════

ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name  text;
