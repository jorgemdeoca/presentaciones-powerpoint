
-- Drop FK constraints to auth.users
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
ALTER TABLE public.presentations DROP CONSTRAINT IF EXISTS presentations_user_id_fkey;
ALTER TABLE public.slides DROP CONSTRAINT IF EXISTS slides_user_id_fkey;
ALTER TABLE public.references DROP CONSTRAINT IF EXISTS references_user_id_fkey;

-- user_settings: drop PK (which is on user_id), add new id PK
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_pkey;
ALTER TABLE public.user_settings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'work';

-- Other tables: user_id optional
ALTER TABLE public.presentations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.slides ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.references ALTER COLUMN user_id DROP NOT NULL;

-- Permissive policies
DROP POLICY IF EXISTS "user_settings_all_own" ON public.user_settings;
DROP POLICY IF EXISTS "presentations_all_own" ON public.presentations;
DROP POLICY IF EXISTS "slides_all_own" ON public.slides;
DROP POLICY IF EXISTS "references_all_own" ON public.references;

CREATE POLICY "public_all" ON public.user_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.presentations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.slides FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.references FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.references TO anon;

UPDATE storage.buckets SET public = true WHERE id IN ('slide-images', 'uploads');

DROP POLICY IF EXISTS "slide_images_own_select" ON storage.objects;
DROP POLICY IF EXISTS "slide_images_own_insert" ON storage.objects;
DROP POLICY IF EXISTS "slide_images_own_update" ON storage.objects;
DROP POLICY IF EXISTS "slide_images_own_delete" ON storage.objects;
DROP POLICY IF EXISTS "uploads_own_select" ON storage.objects;
DROP POLICY IF EXISTS "uploads_own_insert" ON storage.objects;
DROP POLICY IF EXISTS "uploads_own_update" ON storage.objects;
DROP POLICY IF EXISTS "uploads_own_delete" ON storage.objects;

CREATE POLICY "slide_images_public_all" ON storage.objects FOR ALL TO anon, authenticated
  USING (bucket_id = 'slide-images') WITH CHECK (bucket_id = 'slide-images');
CREATE POLICY "uploads_public_all" ON storage.objects FOR ALL TO anon, authenticated
  USING (bucket_id = 'uploads') WITH CHECK (bucket_id = 'uploads');
