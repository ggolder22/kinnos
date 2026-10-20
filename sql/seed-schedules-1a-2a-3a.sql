-- ═══════════════════════════════════════════════════
--  Horarios — 1°A, 2°A y 3°A — Segundo Cuatrimestre
--  Transcripto de los PDF "horario 1a.pdf", "horario 2a.pdf", "horario 3a.pdf"
--
--  subject_name tiene que matchear EXACTO (sin importar mayúsculas) con
--  subjects.name para que Kinnos vincule el horario a la materia en forma
--  automática y pueda calcular la ventana de asistencia (inicio + 30 min).
--  Si algún nombre no coincide exactamente con el de la materia cargada,
--  no pasa nada grave: desde Admin → Plan de Estudios → botón "Horarios"
--  de esa materia se puede vincular a mano (el combo muestra los horarios
--  sueltos de ese año que todavía no están vinculados a ninguna materia).
--
--  Celdas donde la grilla original tenía más de una cosa en el mismo
--  horario (ej: una "Consulta" de una materia + el dictado de otra al
--  mismo tiempo) se cargaron como filas separadas — es información real
--  de los PDF, no un error de carga.
-- ═══════════════════════════════════════════════════

-- ───────────── 1° A ─────────────
INSERT INTO schedules (curso, anio, division, periodo, day, time_start, time_end, subject_name, professor_name, is_consulta) VALUES
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Lunes',     '17:40', '18:20', 'Informática Aplicada', 'Leguiza, Adrián', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Martes',    '17:40', '18:20', 'Química Aplicada', 'Caroprese, Eugenia', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Miércoles', '17:40', '18:20', 'Informática Aplicada', 'Leguiza, Adrián', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Jueves',    '17:40', '18:20', 'Química Aplicada', 'Caroprese, Eugenia', true),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Jueves',    '17:40', '18:20', 'Matemática Aplicada', 'Pérez, Adolfo', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Viernes',   '17:40', '18:20', 'Instalaciones Eléctricas', 'Cuenca, Kevin', true),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Viernes',   '17:40', '18:20', 'Informática Aplicada', 'Leguiza, Adrián', false),

('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Lunes',     '18:20', '19:00', 'Informática Aplicada', 'Leguiza, Adrián', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Martes',    '18:20', '19:00', 'Química Aplicada', 'Caroprese, Eugenia', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Miércoles', '18:20', '19:00', 'Informática Aplicada', 'Leguiza, Adrián', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Jueves',    '18:20', '19:00', 'Química Aplicada', 'Caroprese, Eugenia', true),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Jueves',    '18:20', '19:00', 'Matemática Aplicada', 'Pérez, Adolfo', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Jueves',    '18:20', '19:00', 'Energía Solar Térmica', 'Procopio, Alejandro', true),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Viernes',   '18:20', '19:00', 'Instalaciones Eléctricas', 'Cuenca, Kevin', true),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Viernes',   '18:20', '19:00', 'Informática Aplicada', 'Leguiza, Adrián', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Viernes',   '18:20', '19:00', 'Energía Solar Térmica', 'Procopio, Alejandro', false),

('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Lunes',     '19:00', '19:40', 'Matemática Aplicada', 'Pérez, Adolfo', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Martes',    '19:00', '19:40', 'Matemática Aplicada', 'Pérez, Adolfo', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Miércoles', '19:00', '19:40', 'Electrotecnia', 'Chavez, Agustin', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Jueves',    '19:00', '19:40', 'Energía Solar Térmica', 'Procopio, Alejandro', true),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Viernes',   '19:00', '19:40', 'Prácticas Profesionalizantes I', 'Procopio, Alejandro', false),

('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Lunes',     '19:40', '20:20', 'Matemática Aplicada', 'Pérez, Adolfo', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Martes',    '19:40', '20:20', 'Matemática Aplicada', 'Pérez, Adolfo', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Miércoles', '19:40', '20:20', 'Electrotecnia', 'Chavez, Agustin', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Jueves',    '19:40', '20:20', 'Energía Solar Térmica', 'Procopio, Alejandro', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Viernes',   '19:40', '20:20', 'Prácticas Profesionalizantes I', 'Procopio, Alejandro', false),

('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Lunes',     '20:30', '21:05', 'Matemática Aplicada', 'Pérez, Adolfo', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Martes',    '20:30', '21:05', 'Instalaciones Eléctricas', 'Cuenca, Kevin', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Miércoles', '20:30', '21:05', 'Electrotecnia', 'Chavez, Agustin', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Jueves',    '20:30', '21:05', 'Energía Solar Térmica', 'Procopio, Alejandro', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Viernes',   '20:30', '21:05', 'Prácticas Profesionalizantes I', 'Procopio, Alejandro', false),

('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Lunes',     '21:05', '21:40', 'Química Aplicada', 'Caroprese, Eugenia', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Martes',    '21:05', '21:40', 'Instalaciones Eléctricas', 'Cuenca, Kevin', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Miércoles', '21:05', '21:40', 'Electrotecnia', 'Chavez, Agustin', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Jueves',    '21:05', '21:40', 'Energía Solar Térmica', 'Procopio, Alejandro', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Viernes',   '21:05', '21:40', 'Prácticas Profesionalizantes I', 'Procopio, Alejandro', false),

('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Lunes',     '21:40', '22:15', 'Química Aplicada', 'Caroprese, Eugenia', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Martes',    '21:40', '22:15', 'Instalaciones Eléctricas', 'Cuenca, Kevin', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Miércoles', '21:40', '22:15', 'Electrotecnia', 'Chavez, Agustin', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Jueves',    '21:40', '22:15', 'Energía Solar Térmica', 'Procopio, Alejandro', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Viernes',   '21:40', '22:15', 'Prácticas Profesionalizantes I', 'Procopio, Alejandro', false),

('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Lunes',     '22:15', '22:50', 'Electrotecnia', 'Chavez, Agustin', true),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Martes',    '22:15', '22:50', 'Instalaciones Eléctricas', 'Cuenca, Kevin', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Miércoles', '22:15', '22:50', 'Electrotecnia', 'Chavez, Agustin', true),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Jueves',    '22:15', '22:50', 'Energía Solar Térmica', 'Procopio, Alejandro', false),
('CENT N° 18', 1, 'A', 'Segundo Cuatrimestre', 'Viernes',   '22:15', '22:50', 'Prácticas Profesionalizantes I', 'Procopio, Alejandro', false);

-- ───────────── 2° A ─────────────
INSERT INTO schedules (curso, anio, division, periodo, day, time_start, time_end, subject_name, professor_name, is_consulta) VALUES
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Martes',    '17:40', '18:20', 'Marco Jurídico', 'Dra. Tocino', true),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Jueves',    '17:40', '18:20', 'Energía Minihidráulica y Geotérmica', 'Rodrigo, Rodolfo', true),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Jueves',    '17:40', '18:20', 'Uso Racional de la Energía', 'Polimeni, Gustavo', true),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Viernes',   '17:40', '18:20', 'Energía Eólica', 'Chavez, Agustin', true),

('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Martes',    '18:20', '19:00', 'Marco Jurídico', 'Dra. Tocino', true),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Jueves',    '18:20', '19:00', 'Energía Minihidráulica y Geotérmica', 'Rodrigo, Rodolfo', true),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Jueves',    '18:20', '19:00', 'Uso Racional de la Energía', 'Polimeni, Gustavo', true),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Viernes',   '18:20', '19:00', 'Energía Eólica', 'Chavez, Agustin', true),

('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Lunes',     '19:00', '19:40', 'Energía Minihidráulica y Geotérmica', 'Rodrigo, Rodolfo', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Martes',    '19:00', '19:40', 'Energía Minihidráulica y Geotérmica', 'Rodrigo, Rodolfo', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Miércoles', '19:00', '19:40', 'Marco Jurídico', 'Dra. Tocino', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Jueves',    '19:00', '19:40', 'Uso Racional de la Energía', 'Polimeni, Gustavo', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Viernes',   '19:00', '19:40', 'Prácticas Profesionalizantes III', 'Porras, Emiliano', false),

('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Lunes',     '19:40', '20:20', 'Energía Minihidráulica y Geotérmica', 'Rodrigo, Rodolfo', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Martes',    '19:40', '20:20', 'Energía Minihidráulica y Geotérmica', 'Rodrigo, Rodolfo', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Miércoles', '19:40', '20:20', 'Marco Jurídico', 'Dra. Tocino', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Jueves',    '19:40', '20:20', 'Uso Racional de la Energía', 'Polimeni, Gustavo', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Viernes',   '19:40', '20:20', 'Prácticas Profesionalizantes III', 'Porras, Emiliano', false),

('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Lunes',     '20:30', '21:05', 'Energía Eólica', 'Chavez, Agustin', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Martes',    '20:30', '21:05', 'Energía Eólica', 'Chavez, Agustin', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Miércoles', '20:30', '21:05', 'Marco Jurídico', 'Dra. Tocino', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Jueves',    '20:30', '21:05', 'Prácticas Profesionalizantes III', 'Porras, Emiliano', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Viernes',   '20:30', '21:05', 'Prácticas Profesionalizantes III', 'Porras, Emiliano', false),

('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Lunes',     '21:05', '21:40', 'Energía Eólica', 'Chavez, Agustin', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Martes',    '21:05', '21:40', 'Prácticas Profesionalizantes III', 'Porras, Emiliano', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Miércoles', '21:05', '21:40', 'Uso Racional de la Energía', 'Polimeni, Gustavo', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Jueves',    '21:05', '21:40', 'Prácticas Profesionalizantes III', 'Porras, Emiliano', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Viernes',   '21:05', '21:40', 'Prácticas Profesionalizantes III', 'Porras, Emiliano', false),

('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Lunes',     '21:40', '22:15', 'Energía Eólica', 'Chavez, Agustin', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Martes',    '21:40', '22:15', 'Prácticas Profesionalizantes III', 'Porras, Emiliano', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Miércoles', '21:40', '22:15', 'Uso Racional de la Energía', 'Polimeni, Gustavo', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Jueves',    '21:40', '22:15', 'Prácticas Profesionalizantes III', 'Porras, Emiliano', false),
('CENT N° 18', 2, 'A', 'Segundo Cuatrimestre', 'Viernes',   '21:40', '22:15', 'Prácticas Profesionalizantes III', 'Porras, Emiliano', false);

-- ───────────── 3° A ─────────────
INSERT INTO schedules (curso, anio, division, periodo, day, time_start, time_end, subject_name, professor_name, is_consulta) VALUES
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Martes',    '17:40', '18:20', 'Gestión de Proyectos de Inversión', NULL, true),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Miércoles', '17:40', '18:20', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Jueves',    '17:40', '18:20', 'Práctica Profesionalizante V', NULL, false),

('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Martes',    '18:20', '19:00', 'Gestión de Proyectos de Inversión', NULL, true),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Miércoles', '18:20', '19:00', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Jueves',    '18:20', '19:00', 'Práctica Profesionalizante V', NULL, false),

('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Martes',    '19:00', '19:40', 'Gestión de Proyectos de Inversión', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Miércoles', '19:00', '19:40', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Jueves',    '19:00', '19:40', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Viernes',   '19:00', '19:40', 'Ética Profesional y Deontología', 'Silva, Daniel', true),

('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Martes',    '19:40', '20:20', 'Gestión de Proyectos de Inversión', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Miércoles', '19:40', '20:20', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Jueves',    '19:40', '20:20', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Viernes',   '19:40', '20:20', 'Ética Profesional y Deontología', 'Silva, Daniel', true),

('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Lunes',     '20:30', '21:10', 'Ética Profesional y Deontología', 'Silva, Daniel', false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Martes',    '20:30', '21:10', 'Gestión de Proyectos de Inversión', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Miércoles', '20:30', '21:10', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Jueves',    '20:30', '21:10', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Viernes',   '20:30', '21:10', 'Práctica Profesionalizante V', NULL, false),

('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Lunes',     '21:10', '21:50', 'Ética Profesional y Deontología', 'Silva, Daniel', false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Martes',    '21:10', '21:50', 'Gestión de Proyectos de Inversión', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Miércoles', '21:10', '21:50', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Jueves',    '21:10', '21:50', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Viernes',   '21:10', '21:50', 'Práctica Profesionalizante V', NULL, false),

('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Lunes',     '21:50', '22:30', 'Ética Profesional y Deontología', 'Silva, Daniel', false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Miércoles', '21:50', '22:30', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Jueves',    '21:50', '22:30', 'Práctica Profesionalizante V', NULL, false),
('CENT N° 18', 3, 'A', 'Segundo Cuatrimestre', 'Viernes',   '21:50', '22:30', 'Práctica Profesionalizante V', NULL, false);
