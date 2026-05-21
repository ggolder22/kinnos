# Kinnos — Plataforma Educativa Multi-tenant

## Contexto del proyecto
Kinnos es una nueva plataforma educativa construida desde cero, derivada de "alumnosapp" (una app mono-tenant para Electrotecnia). El objetivo es soportar múltiples instituciones, carreras, materias y profesores desde un único sistema.

El desarrollador es **Ing. Germán Golder** (gfcriptos@gmail.com, GitHub: ggolder22). No es programador de profesión — trabaja con Claude Code para construir la app.

## Stack tecnológico
- **Frontend:** HTML + JS vanilla (SPA, sin frameworks)
- **Backend/DB:** Supabase (PostgreSQL + RLS + Storage)
- **Deploy:** Vercel (con funciones serverless en `/api/`)
- **Repo:** https://github.com/ggolder22/kinnos.git
- **Referencia:** la app anterior está en https://github.com/ggolder22/alumnosgolder.git

## Jerarquía de datos
```
Institución
  └── Carrera
        └── Materia  ←  tiene un join_code único para inscripción
              ├── Profesores  (N:N — un profe puede dar varias materias)
              └── Alumnos     (N:N — un alumno puede estar en varias materias)
                    ├── Unidades / Contenido
                    ├── Exámenes (con preguntas, IA, PDF)
                    └── Novedades
```

## Roles
| Rol | Descripción |
|---|---|
| **Super Admin** | Germán — gestiona todo: instituciones, carreras, materias, profesores |
| **Profesor** | Ve y gestiona solo SUS materias: unidades, exámenes, alumnos, novedades |
| **Alumno** | Se inscribe con un código, ve el contenido de sus materias |
| **Admin institucional** | (Fase 2) Ve todo lo de su institución |
| **Preceptor** | (Fase 2) Gestión administrativa de alumnos |

## Schema de base de datos (a crear en Supabase nuevo)

### Tablas principales
```sql
-- Estructura organizacional
institutions      (id uuid PK, name text, address text, logo_url text, created_at)
careers           (id uuid PK, institution_id FK, name text, description text)
subjects          (id uuid PK, career_id FK, name text, year int, join_code text UNIQUE)

-- Personas
professors        (id uuid PK, full_name text, dni text UNIQUE, email text, phone text)
students          (id uuid PK, full_name text, dni text UNIQUE, email text, phone text)

-- Relaciones N:N
professor_subjects (professor_id FK, subject_id FK, is_primary bool)
student_subjects   (student_id FK, subject_id FK, enrolled_at timestamptz)

-- Contenido (todos tienen subject_id)
units             (id uuid PK, subject_id FK, unit_num int, title text, tag text,
                   topics jsonb, content text, pdf_url text, updated_at)
exams             (id uuid PK, subject_id FK, title text, is_active bool,
                   time_limit int, instructions text, unit_ids jsonb, is_practice bool)
exam_questions    (id uuid PK, exam_id FK, question_text text, type text,
                   options jsonb, correct_answer text, points numeric, order_num int)
exam_results      (id uuid PK, student_id FK, exam_id FK, score numeric,
                   answers jsonb, started_at timestamptz, taken_at timestamptz)
announcements     (id uuid PK, subject_id FK, title text, body text,
                   is_pinned bool, created_at)
```

## Flujo de inscripción del alumno
1. El profe crea su materia → sistema genera código automático (ej: `ELEC-24A`)
2. El alumno se registra una vez en Kinnos (nombre, DNI, email, teléfono)
3. El alumno ingresa el código de materia → queda inscripto
4. Puede inscribirse en N materias con distintos códigos

## Flujo de login
- **Super Admin:** DNI especial hardcodeado en config.js (igual que antes)
- **Profesor:** DNI registrado en tabla `professors` → ve panel de profesor
- **Alumno:** DNI registrado en tabla `students` → ve panel de alumno con sus materias

## Funcionalidades (igual que alumnosapp, portadas)
- Unidades con contenido editable, PDF descargable
- Exámenes: múltiple opción, V/F, respuesta corta
- Generación de preguntas con IA (Claude via Vercel serverless)
- Exámenes de práctica (sin nota, sin tiempo, repetible)
- Exámenes formales (con nota, con tiempo, un solo intento)
- Vista de corrección para el profesor
- Tablón de novedades
- Notificaciones por email (EmailJS) y WhatsApp

## Plan de implementación
- **Fase 1 — Base multi-tenant:** estructura DB, login diferenciado, super admin, panel profesor, panel alumno
- **Fase 2 — Contenido:** unidades, exámenes, novedades (portar de alumnosapp)
- **Fase 3 — Dashboard institucional + preceptores**

## Estado actual
- Repo creado y conectado a GitHub
- Supabase: pendiente crear proyecto nuevo para Kinnos
- Próximo paso: crear el SQL de la base de datos y el index.html base
