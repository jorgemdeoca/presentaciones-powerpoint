-- Restore RLS, FK constraints, and revoke anonymous table access (reverts migration #3)

-- Revoke anon CRUD on core tables
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.user_settings FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.presentations FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.slides FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.references FROM anon;

-- Drop permissive policies
DROP POLICY IF EXISTS "public_all" ON public.user_settings;
DROP POLICY IF EXISTS "public_all" ON public.presentations;
DROP POLICY IF EXISTS "public_all" ON public.slides;
DROP POLICY IF EXISTS "public_all" ON public.references;

DROP POLICY IF EXISTS "slide_images_public_all" ON storage.objects;
DROP POLICY IF EXISTS "uploads_public_all" ON storage.objects;

-- Restore user-scoped table policies
CREATE POLICY "user_settings_all_own" ON public.user_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "presentations_all_own" ON public.presentations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "slides_all_own" ON public.slides
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "references_all_own" ON public.references
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Restore storage policies (user folder prefix)
DROP POLICY IF EXISTS "slide_images_read_public" ON storage.objects;
DROP POLICY IF EXISTS "slide_images_write_own" ON storage.objects;
DROP POLICY IF EXISTS "slide_images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "slide_images_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "uploads_read_public" ON storage.objects;
DROP POLICY IF EXISTS "uploads_write_own" ON storage.objects;
DROP POLICY IF EXISTS "uploads_delete_own" ON storage.objects;

CREATE POLICY "slide_images_read_public" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'slide-images');
CREATE POLICY "slide_images_write_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'slide-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "slide_images_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'slide-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "slide_images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'slide-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "uploads_read_public" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'uploads');
CREATE POLICY "uploads_write_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "uploads_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Slides: unique position per presentation
ALTER TABLE public.slides
  DROP CONSTRAINT IF EXISTS slides_presentation_position_unique;
ALTER TABLE public.slides
  ADD CONSTRAINT slides_presentation_position_unique UNIQUE (presentation_id, position);

-- Presentations: generation progress fields
ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS generation_step TEXT DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS generation_error TEXT;

-- Slides: extended design JSON for art director output
ALTER TABLE public.slides
  ADD COLUMN IF NOT EXISTS design JSONB DEFAULT '{}'::jsonb;
