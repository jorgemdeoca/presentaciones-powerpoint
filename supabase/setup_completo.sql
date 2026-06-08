-- ============================================================================
-- SlideForge — Script de Configuración Completa de Supabase
-- ============================================================================
-- 
-- INSTRUCCIONES:
-- 1. Ve a tu Supabase Dashboard → SQL Editor
-- 2. Pega TODO este script y ejecútalo
-- 3. Es seguro ejecutarlo múltiples veces (idempotente)
--
-- Este script crea:
--   • 5 tablas: profiles, user_settings, presentations, slides, references
--   • 3 storage buckets: slide-images, uploads, thumbnails
--   • Políticas RLS de seguridad por usuario
--   • Trigger automático para crear perfil al registrarse
--   • Índices de rendimiento
-- ============================================================================

-- ─── TABLA: profiles ────────────────────────────────────────────────────────
-- Perfil del usuario, se crea automáticamente al registrarse
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ─── TABLA: user_settings ───────────────────────────────────────────────────
-- Configuración predeterminada del usuario para nuevas presentaciones
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  style TEXT NOT NULL DEFAULT 'modern',
  palette TEXT NOT NULL DEFAULT 'midnight_blue',
  font_pair TEXT NOT NULL DEFAULT 'space-grotesk-dm-sans',
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  default_language TEXT NOT NULL DEFAULT 'es',
  default_tone TEXT NOT NULL DEFAULT 'professional',
  default_slide_count INT NOT NULL DEFAULT 8,
  purpose TEXT NOT NULL DEFAULT 'work',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_settings_all_own" ON public.user_settings;
CREATE POLICY "user_settings_all_own" ON public.user_settings 
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- ─── FUNCIÓN + TRIGGER: auto-crear perfil al registrarse ────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email)
  );
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Solo el trigger (superuser) puede ejecutar esta función
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Crear trigger solo si no existe
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- ─── TABLA: presentations ───────────────────────────────────────────────────
-- Presentaciones generadas por IA
CREATE TABLE IF NOT EXISTS public.presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  generation_step TEXT NOT NULL DEFAULT 'ready',
  generation_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presentations_user_idx ON public.presentations(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentations TO authenticated;
GRANT ALL ON public.presentations TO service_role;
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presentations_all_own" ON public.presentations;
CREATE POLICY "presentations_all_own" ON public.presentations 
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- ─── TABLA: slides ──────────────────────────────────────────────────────────
-- Diapositivas individuales de cada presentación
CREATE TABLE IF NOT EXISTS public.slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  layout TEXT NOT NULL DEFAULT 'title-content',
  title TEXT,
  subtitle TEXT,
  bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  body TEXT,
  image_url TEXT,
  image_prompt TEXT,
  notes TEXT,
  design JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slides_pres_idx ON public.slides(presentation_id, position);

-- Posición única por presentación (evita slides duplicadas)
ALTER TABLE public.slides DROP CONSTRAINT IF EXISTS slides_presentation_position_unique;
ALTER TABLE public.slides ADD CONSTRAINT slides_presentation_position_unique UNIQUE (presentation_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slides TO authenticated;
GRANT ALL ON public.slides TO service_role;
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slides_all_own" ON public.slides;
CREATE POLICY "slides_all_own" ON public.slides 
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- ─── TABLA: references ──────────────────────────────────────────────────────
-- Documentos de referencia subidos por el usuario (PDFs, textos, imágenes)
CREATE TABLE IF NOT EXISTS public.references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  file_url TEXT,
  extracted_text TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS references_user_idx ON public.references(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.references TO authenticated;
GRANT ALL ON public.references TO service_role;
ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "references_all_own" ON public.references;
CREATE POLICY "references_all_own" ON public.references 
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- ─── STORAGE BUCKETS ────────────────────────────────────────────────────────
-- Buckets públicos (las imágenes necesitan ser accesibles por URL directa)
INSERT INTO storage.buckets (id, name, public) VALUES ('slide-images', 'slide-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true) ON CONFLICT DO NOTHING;

-- ─── POLÍTICAS DE STORAGE ───────────────────────────────────────────────────
-- Cada usuario solo puede leer/escribir en su propia carpeta (carpeta = user_id)

-- Limpiar políticas anteriores (para idempotencia)
DROP POLICY IF EXISTS "slide_images_read_public" ON storage.objects;
DROP POLICY IF EXISTS "slide_images_list_own" ON storage.objects;
DROP POLICY IF EXISTS "slide_images_write_own" ON storage.objects;
DROP POLICY IF EXISTS "slide_images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "slide_images_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "slide_images_public_all" ON storage.objects;
DROP POLICY IF EXISTS "uploads_read_public" ON storage.objects;
DROP POLICY IF EXISTS "uploads_list_own" ON storage.objects;
DROP POLICY IF EXISTS "uploads_write_own" ON storage.objects;
DROP POLICY IF EXISTS "uploads_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "uploads_public_all" ON storage.objects;
DROP POLICY IF EXISTS "thumbnails_read_public" ON storage.objects;
DROP POLICY IF EXISTS "thumbnails_list_own" ON storage.objects;
DROP POLICY IF EXISTS "thumbnails_write_own" ON storage.objects;
DROP POLICY IF EXISTS "thumbnails_update_own" ON storage.objects;

-- slide-images: usuario autenticado opera en su carpeta
CREATE POLICY "slide_images_list_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'slide-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "slide_images_write_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'slide-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "slide_images_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'slide-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "slide_images_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'slide-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- uploads: usuario autenticado opera en su carpeta
CREATE POLICY "uploads_list_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "uploads_write_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "uploads_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- thumbnails: usuario autenticado opera en su carpeta
CREATE POLICY "thumbnails_list_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "thumbnails_write_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "thumbnails_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─── LIMPIAR POLÍTICAS INSEGURAS DE LOVABLE ─────────────────────────────────
-- Estas políticas permitían acceso público sin autenticación. Las eliminamos.
DROP POLICY IF EXISTS "public_all" ON public.user_settings;
DROP POLICY IF EXISTS "public_all" ON public.presentations;
DROP POLICY IF EXISTS "public_all" ON public.slides;
DROP POLICY IF EXISTS "public_all" ON public.references;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.user_settings FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.presentations FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.slides FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.references FROM anon;

-- ============================================================================
-- ✅ CONFIGURACIÓN COMPLETA
-- 
-- Ahora ve a:
--   Authentication → URL Configuration:
--     Site URL: http://localhost:3000 (desarrollo) o https://tu-dominio.vercel.app
--     Redirect URLs: http://localhost:3000/**, https://tu-dominio.vercel.app/**
--
--   Authentication → Providers:
--     Email: habilitado (ya viene por defecto)
--     Google: opcional (necesita credenciales de Google Cloud Console)
-- ============================================================================
