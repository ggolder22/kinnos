-- ═══════════════════════════════════════════════════
--  Condición de la materia (Regular / Promocional) — Kinnos
--
--  El profesor la carga UNA vez por ciclo lectivo desde la pestaña
--  Planificación. Después queda bloqueada: para cambiarla tiene que
--  pedir autorización, y la aprueba (o rechaza) un preceptor de la
--  institución de la materia.
--
--  El bloqueo no es solo visual: un trigger en la base rechaza
--  cualquier cambio o borrado de una condición ya cargada que no
--  venga de una solicitud aprobada (función kinnos_resolver_cambio_condicion).
-- ═══════════════════════════════════════════════════

BEGIN;

-- 1. Condición vigente de cada materia, por ciclo lectivo
CREATE TABLE IF NOT EXISTS subject_conditions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id          uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  anio_academico      int  NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  condicion           text NOT NULL CHECK (condicion IN ('Regular', 'Promocional')),
  set_by_professor_id uuid REFERENCES professors(id) ON DELETE SET NULL,
  set_by_name         text,
  set_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, anio_academico)
);

-- 2. Pedidos de cambio (historial completo: pendientes, aprobados y rechazados)
CREATE TABLE IF NOT EXISTS condition_change_requests (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id                uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  anio_academico            int  NOT NULL,
  condicion_actual          text NOT NULL CHECK (condicion_actual IN ('Regular', 'Promocional')),
  condicion_nueva           text NOT NULL CHECK (condicion_nueva  IN ('Regular', 'Promocional')),
  motivo                    text NOT NULL,
  requested_by_professor_id uuid REFERENCES professors(id) ON DELETE SET NULL,
  requested_by_name         text,
  requested_at              timestamptz NOT NULL DEFAULT now(),
  status                    text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by_preceptor_id  uuid REFERENCES preceptors(id) ON DELETE SET NULL,
  resolved_by_name          text,
  resolved_at               timestamptz,
  respuesta                 text,
  CHECK (condicion_actual <> condicion_nueva)
);

-- Una sola solicitud pendiente por materia y ciclo
CREATE UNIQUE INDEX IF NOT EXISTS uq_condition_request_pending
  ON condition_change_requests(subject_id, anio_academico) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_condition_requests_status ON condition_change_requests(status, requested_at DESC);

-- 3. Bloqueo: una condición ya cargada no se puede modificar ni borrar
--    salvo desde kinnos_resolver_cambio_condicion (que prende el permiso
--    solo durante su propia transacción).
CREATE OR REPLACE FUNCTION kinnos_bloquear_condicion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- pg_trigger_depth() > 1: el cambio lo dispara la propia base en cascada
  -- (se borró la materia, o se borró el profesor que la cargó) — se permite.
  IF pg_trigger_depth() <= 1
     AND coalesce(current_setting('kinnos.cambio_condicion_autorizado', true), '') <> 'si' THEN
    RAISE EXCEPTION 'La condición de la materia ya está cargada y no se puede cambiar sin la autorización de un preceptor.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS trg_bloquear_condicion ON subject_conditions;
CREATE TRIGGER trg_bloquear_condicion
  BEFORE UPDATE OR DELETE ON subject_conditions
  FOR EACH ROW EXECUTE FUNCTION kinnos_bloquear_condicion();

-- 4. El preceptor aprueba o rechaza una solicitud. Solo puede resolver
--    solicitudes de materias de SU institución.
CREATE OR REPLACE FUNCTION kinnos_resolver_cambio_condicion(
  p_request   uuid,
  p_aprobar   bool,
  p_preceptor uuid,
  p_respuesta text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  req  condition_change_requests%ROWTYPE;
  prec preceptors%ROWTYPE;
  inst uuid;
BEGIN
  SELECT * INTO req FROM condition_change_requests WHERE id = p_request FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'La solicitud no existe.'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Esta solicitud ya fue resuelta.'; END IF;

  SELECT * INTO prec FROM preceptors WHERE id = p_preceptor;
  IF prec.id IS NULL THEN RAISE EXCEPTION 'Solo un preceptor puede resolver la solicitud.'; END IF;

  SELECT c.institution_id INTO inst
  FROM subjects s JOIN careers c ON c.id = s.career_id
  WHERE s.id = req.subject_id;
  IF prec.institution_id IS DISTINCT FROM inst THEN
    RAISE EXCEPTION 'La materia no es de tu institución.';
  END IF;

  IF p_aprobar THEN
    PERFORM set_config('kinnos.cambio_condicion_autorizado', 'si', true);
    UPDATE subject_conditions
    SET condicion = req.condicion_nueva, set_at = now(),
        set_by_name = coalesce(req.requested_by_name, set_by_name) || ' (autorizado por ' || prec.full_name || ')'
    WHERE subject_id = req.subject_id AND anio_academico = req.anio_academico;
    PERFORM set_config('kinnos.cambio_condicion_autorizado', '', true);
  END IF;

  UPDATE condition_change_requests
  SET status = CASE WHEN p_aprobar THEN 'approved' ELSE 'rejected' END,
      resolved_by_preceptor_id = prec.id,
      resolved_by_name = prec.full_name,
      resolved_at = now(),
      respuesta = nullif(trim(coalesce(p_respuesta, '')), '')
  WHERE id = req.id;

  RETURN CASE WHEN p_aprobar THEN 'approved' ELSE 'rejected' END;
END $$;

GRANT EXECUTE ON FUNCTION kinnos_resolver_cambio_condicion(uuid, bool, uuid, text) TO anon, authenticated;

-- ── RLS (mismo esquema que el resto de los módulos) ──
ALTER TABLE subject_conditions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_subject_conditions" ON subject_conditions;
CREATE POLICY "anon_all_subject_conditions"
  ON subject_conditions FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_condition_requests" ON condition_change_requests;
CREATE POLICY "anon_all_condition_requests"
  ON condition_change_requests FOR ALL TO anon USING (true) WITH CHECK (true);

COMMIT;

NOTIFY pgrst, 'reload schema';
