-- ============================================================
-- KINNOS — 50 ejercicios de conversión de unidades y magnitudes
-- Unidad 1 de Electrotecnia (o la materia que definas)
--
-- ANTES DE CORRER: asegurate de que la Unidad 1 ya exista
-- en la tabla 'units' (creada desde la Planificación).
--
-- Modificá el ILIKE si el nombre de tu materia es distinto.
-- ============================================================

WITH target_unit AS (
  SELECT u.id
  FROM units u
  JOIN subjects s ON s.id = u.subject_id
  WHERE u.unit_num = 1
    AND s.name ILIKE '%Electrotecnia%'
  LIMIT 1
)
INSERT INTO unit_exercises (unit_id, order_num, type, statement, answer, answer_numeric, tolerance, has_error, error_explanation, solution_steps)
SELECT
  t.id,
  d.order_num,
  d.type,
  d.statement,
  d.answer,
  d.answer_numeric,
  0.05,
  d.has_error,
  d.error_explanation,
  d.solution_steps::jsonb
FROM target_unit t,
(VALUES
  -- ── GRUPO A: km/h → m/s (10 ejercicios) ───────────────────────
  (1,  'solve', 'Un auto circula a 72 km/h. Expresá esa velocidad en m/s.',
   '20 m/s', 20, false, null,
   '["72 ÷ 3,6 = 20", "Resultado: 20 m/s"]'),

  (2,  'solve', 'Un tren viaja a 108 km/h. Convertí a m/s.',
   '30 m/s', 30, false, null,
   '["108 ÷ 3,6 = 30", "Resultado: 30 m/s"]'),

  (3,  'solve', 'Una moto alcanza 144 km/h en la autopista. ¿Cuántos m/s son?',
   '40 m/s', 40, false, null,
   '["144 ÷ 3,6 = 40", "Resultado: 40 m/s"]'),

  (4,  'solve', 'El límite de velocidad en la ruta es 90 km/h. Expresalo en m/s.',
   '25 m/s', 25, false, null,
   '["90 ÷ 3,6 = 25", "Resultado: 25 m/s"]'),

  (5,  'solve', 'Un ciclista va a 36 km/h. ¿A cuántos m/s equivale?',
   '10 m/s', 10, false, null,
   '["36 ÷ 3,6 = 10", "Resultado: 10 m/s"]'),

  (6,  'solve', 'Un peatón camina a 5,4 km/h. Pasalo a m/s.',
   '1,5 m/s', 1.5, false, null,
   '["5,4 ÷ 3,6 = 1,5", "Resultado: 1,5 m/s"]'),

  (7,  'solve', 'Un avión de pasajeros vuela a 900 km/h. ¿En m/s?',
   '250 m/s', 250, false, null,
   '["900 ÷ 3,6 = 250", "Resultado: 250 m/s"]'),

  (8,  'solve', 'El viento sopla a 54 km/h. Convertí a m/s.',
   '15 m/s', 15, false, null,
   '["54 ÷ 3,6 = 15", "Resultado: 15 m/s"]'),

  (9,  'solve', 'Un barco navega a 18 km/h. Expresá en m/s.',
   '5 m/s', 5, false, null,
   '["18 ÷ 3,6 = 5", "Resultado: 5 m/s"]'),

  (10, 'solve', 'Un tren bala viaja a 360 km/h. ¿Cuántos m/s son?',
   '100 m/s', 100, false, null,
   '["360 ÷ 3,6 = 100", "Resultado: 100 m/s"]'),

  -- ── GRUPO B: m/s → km/h (10 ejercicios) ───────────────────────
  (11, 'solve', 'Una pelota rueda a 10 m/s. Convertí a km/h.',
   '36 km/h', 36, false, null,
   '["10 × 3,6 = 36", "Resultado: 36 km/h"]'),

  (12, 'solve', 'Un corredor alcanza 8 m/s en la llegada. Expresalo en km/h.',
   '28,8 km/h', 28.8, false, null,
   '["8 × 3,6 = 28,8", "Resultado: 28,8 km/h"]'),

  (13, 'solve', 'El sonido viaja a 340 m/s en el aire. ¿En km/h?',
   '1224 km/h', 1224, false, null,
   '["340 × 3,6 = 1224", "Resultado: 1224 km/h"]'),

  (14, 'solve', 'Un ciclista de montaña baja a 15 m/s. Convertí a km/h.',
   '54 km/h', 54, false, null,
   '["15 × 3,6 = 54", "Resultado: 54 km/h"]'),

  (15, 'solve', 'Un barco a motor navega a 12 m/s. Pasalo a km/h.',
   '43,2 km/h', 43.2, false, null,
   '["12 × 3,6 = 43,2", "Resultado: 43,2 km/h"]'),

  (16, 'solve', 'Un auto eléctrico alcanza 50 m/s. ¿En km/h?',
   '180 km/h', 180, false, null,
   '["50 × 3,6 = 180", "Resultado: 180 km/h"]'),

  (17, 'solve', 'Un patinador va a 20 m/s. Expresalo en km/h.',
   '72 km/h', 72, false, null,
   '["20 × 3,6 = 72", "Resultado: 72 km/h"]'),

  (18, 'solve', 'Una corredora mantiene 4 m/s en el maratón. ¿En km/h?',
   '14,4 km/h', 14.4, false, null,
   '["4 × 3,6 = 14,4", "Resultado: 14,4 km/h"]'),

  (19, 'solve', 'Un velero navega a 3 m/s. Convertí a km/h.',
   '10,8 km/h', 10.8, false, null,
   '["3 × 3,6 = 10,8", "Resultado: 10,8 km/h"]'),

  (20, 'solve', 'Un tren de carga viaja a 25 m/s. ¿En km/h?',
   '90 km/h', 90, false, null,
   '["25 × 3,6 = 90", "Resultado: 90 km/h"]'),

  -- ── GRUPO C: Problemas de tiempo, distancia y velocidad (10) ───
  (21, 'solve', 'Un auto circula a 72 km/h. ¿Cuánto tiempo tarda en recorrer 400 m? Expresá en segundos.',
   '20 s', 20, false, null,
   '["72 km/h ÷ 3,6 = 20 m/s", "t = d ÷ v = 400 ÷ 20 = 20 s"]'),

  (22, 'solve', 'Un ciclista va a 36 km/h. ¿Cuántos metros recorre en 30 segundos?',
   '300 m', 300, false, null,
   '["36 km/h ÷ 3,6 = 10 m/s", "d = v × t = 10 × 30 = 300 m"]'),

  (23, 'solve', 'Un tren viaja a 90 km/h. ¿Cuántos segundos tarda en atravesar un puente de 500 m?',
   '20 s', 20, false, null,
   '["90 km/h ÷ 3,6 = 25 m/s", "t = d ÷ v = 500 ÷ 25 = 20 s"]'),

  (24, 'solve', 'Un auto viaja a 108 km/h. ¿Cuántos segundos tarda en recorrer 1500 m?',
   '50 s', 50, false, null,
   '["108 km/h ÷ 3,6 = 30 m/s", "t = d ÷ v = 1500 ÷ 30 = 50 s"]'),

  (25, 'solve', 'Una moto a 54 km/h pasa por debajo de un puente de 45 m de largo. ¿Cuántos segundos dura el paso?',
   '3 s', 3, false, null,
   '["54 km/h ÷ 3,6 = 15 m/s", "t = 45 ÷ 15 = 3 s"]'),

  (26, 'solve', 'Un corredor va a 10 m/s. ¿Cuántos kilómetros recorre en 5 minutos?',
   '3 km', 3, false, null,
   '["5 min = 300 s", "d = 10 × 300 = 3000 m = 3 km"]'),

  (27, 'solve', 'Un tren viaja a 144 km/h. ¿Cuántos segundos tarda en recorrer exactamente 1 kilómetro?',
   '25 s', 25, false, null,
   '["144 km/h ÷ 3,6 = 40 m/s", "t = 1000 ÷ 40 = 25 s"]'),

  (28, 'solve', 'Un auto recorre 360 m en 18 segundos a velocidad constante. ¿Cuál es su velocidad en km/h?',
   '72 km/h', 72, false, null,
   '["v = 360 ÷ 18 = 20 m/s", "20 × 3,6 = 72 km/h"]'),

  (29, 'solve', 'Una pelota rueda 200 m en 40 s. ¿Cuál es su velocidad en km/h?',
   '18 km/h', 18, false, null,
   '["v = 200 ÷ 40 = 5 m/s", "5 × 3,6 = 18 km/h"]'),

  (30, 'solve', 'Una persona camina a 5,4 km/h. ¿Cuántos metros recorre en 2 minutos (120 s)?',
   '180 m', 180, false, null,
   '["5,4 km/h ÷ 3,6 = 1,5 m/s", "d = 1,5 × 120 = 180 m"]'),

  -- ── GRUPO D: Conversión de tiempo y distancia (10 ejercicios) ──
  (31, 'solve', 'Convertí 2,5 km a metros.',
   '2500 m', 2500, false, null,
   '["1 km = 1000 m", "2,5 × 1000 = 2500 m"]'),

  (32, 'solve', 'Expresá 3500 m en km.',
   '3,5 km', 3.5, false, null,
   '["1 km = 1000 m → ÷1000", "3500 ÷ 1000 = 3,5 km"]'),

  (33, 'solve', 'Convertí 2 horas a minutos.',
   '120 min', 120, false, null,
   '["1 h = 60 min", "2 × 60 = 120 min"]'),

  (34, 'solve', 'Expresá 150 minutos en horas.',
   '2,5 h', 2.5, false, null,
   '["150 ÷ 60 = 2,5 h"]'),

  (35, 'solve', 'Convertí 7200 segundos a horas.',
   '2 h', 2, false, null,
   '["1 h = 3600 s", "7200 ÷ 3600 = 2 h"]'),

  (36, 'solve', 'Expresá 0,25 horas en segundos.',
   '900 s', 900, false, null,
   '["0,25 h × 3600 s/h = 900 s"]'),

  (37, 'solve', 'Convertí 1 hora y 30 minutos a segundos.',
   '5400 s', 5400, false, null,
   '["1 h 30 min = 90 min", "90 × 60 = 5400 s"]'),

  (38, 'solve', 'Expresá 1800 m en km.',
   '1,8 km', 1.8, false, null,
   '["1800 ÷ 1000 = 1,8 km"]'),

  (39, 'solve', 'Convertí 45 minutos a segundos.',
   '2700 s', 2700, false, null,
   '["45 × 60 = 2700 s"]'),

  (40, 'solve', 'Un auto recorre 180 km en 2 horas a velocidad constante. ¿Cuál es su velocidad en m/s?',
   '25 m/s', 25, false, null,
   '["v = 180 ÷ 2 = 90 km/h", "90 ÷ 3,6 = 25 m/s"]'),

  -- ── GRUPO E: Encontrá el error (10 ejercicios) ─────────────────
  (41, 'find_error',
   'Resolución presentada por un alumno:
Un auto viaja a v = 60 km durante 2 horas.
Distancia: d = v × t = 60 × 2 = 120 km. ✓',
   null, null, true,
   'La unidad de la velocidad es incorrecta. Se escribió "km" pero la velocidad se mide en km/h. Sin la parte "/h" la expresión no representa una velocidad sino una distancia.',
   null),

  (42, 'find_error',
   'Conversión realizada:
90 km/h ÷ 3,6 = 25 m/h.',
   null, null, true,
   'El valor numérico (25) es correcto, pero la unidad resultante está mal. Al dividir km/h por 3,6 se obtiene m/s, no m/h. La respuesta correcta es 25 m/s.',
   null),

  (43, 'find_error',
   'Resolución presentada:
Un auto recorre 200 m en 10 s.
v = 200 ÷ 10 = 20 km/s.',
   null, null, true,
   'La unidad del resultado está mal. Como la distancia está en metros (m) y el tiempo en segundos (s), la velocidad resulta en m/s, no km/s. La respuesta correcta es 20 m/s.',
   null),

  (44, 'find_error',
   'Para convertir 2 horas a segundos:
2 × 60 = 120 s.',
   null, null, true,
   'El factor de conversión usado es incorrecto. 1 hora = 3600 segundos, no 60. (60 es el factor para pasar horas a minutos, o minutos a segundos). La respuesta correcta es 2 × 3600 = 7200 s.',
   null),

  (45, 'find_error',
   'Conversión realizada:
v = 54 km/h. Convertida a m/s: 54 × 3,6 = 194,4 m/s.',
   null, null, true,
   'Para convertir de km/h a m/s se debe DIVIDIR por 3,6, no multiplicar. Se usó la operación inversa. La respuesta correcta es 54 ÷ 3,6 = 15 m/s.',
   null),

  (46, 'find_error',
   'Resolución presentada:
Un auto recorre 1 km en 1 minuto.
Velocidad = 1 km/min = 1 km/h.',
   null, null, true,
   '1 km/min ≠ 1 km/h. Para convertir km/min a km/h se multiplica por 60 (hay 60 minutos en una hora). La velocidad correcta es 1 × 60 = 60 km/h.',
   null),

  (47, 'find_error',
   'Conversión realizada:
Distancia = 500 m. Convertida a km: 500 × 1000 = 500 000 km.',
   null, null, true,
   'Para convertir metros a kilómetros se divide por 1000, no se multiplica. Se aplicó la operación inversa. La respuesta correcta es 500 ÷ 1000 = 0,5 km.',
   null),

  (48, 'find_error',
   'Resolución presentada:
Tiempo de viaje: t = 1 hora 30 minutos = 1,3 horas.',
   null, null, true,
   '30 minutos no es 0,3 horas. Para convertir minutos a horas se divide por 60: 30 ÷ 60 = 0,5 horas. El tiempo correcto es 1 + 0,5 = 1,5 horas.',
   null),

  (49, 'find_error',
   'Cálculo de velocidad:
v = d ÷ t = 300 m ÷ 60 s = 5 m/s².',
   null, null, true,
   'La unidad del resultado está mal. Metros dividido segundos da m/s, no m/s². La unidad m/s² corresponde a la aceleración, no a la velocidad. La respuesta correcta es 5 m/s.',
   null),

  (50, 'find_error',
   'Resolución presentada:
Un tren recorre 150 km en 2 horas.
Velocidad: v = d × t = 150 × 2 = 300 km/h.',
   null, null, true,
   'La fórmula usada es incorrecta. La velocidad se calcula dividiendo distancia por tiempo (v = d ÷ t), no multiplicando. La velocidad correcta es 150 ÷ 2 = 75 km/h.',
   null)

) AS d(order_num, type, statement, answer, answer_numeric, has_error, error_explanation, solution_steps);
