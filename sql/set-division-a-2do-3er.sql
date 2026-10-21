-- ═══════════════════════════════════════════════════
--  Marca como "División A" las materias de 2° y 3° año
--  que hoy figuran como "ambas divisiones", porque en la
--  práctica solo existe 2°A y 3°A (todavía no hay 2°B/3°B).
--
--  No cambia el join_code ni afecta a ningún alumno ya
--  anotado (todos son de división A). Lo único que logra es
--  dejar la puerta cerrada para que, cuando se cree 2°B/3°B
--  más adelante, sus alumnos no puedan anotarse por error en
--  estas materias — van a necesitar sus propias materias
--  nuevas, con su propio horario y código, igual que hicimos
--  con 1°A/1°B.
-- ═══════════════════════════════════════════════════

UPDATE subjects
SET division = 'A'
WHERE year IN (2, 3)
AND division IS NULL;
