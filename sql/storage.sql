-- ============================================================
-- KINNOS — Supabase Storage: bucket de materiales
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Crear bucket público para PDFs y archivos de unidades
INSERT INTO storage.buckets (id, name, public)
VALUES ('materiales', 'materiales', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública (cualquiera puede ver los archivos)
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'materiales');

-- Subida permitida con la anon key (profesores)
CREATE POLICY "anon_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'materiales');

-- Reemplazar / actualizar archivos
CREATE POLICY "anon_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'materiales');

-- Eliminar archivos (al reemplazar un PDF)
CREATE POLICY "anon_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'materiales');
