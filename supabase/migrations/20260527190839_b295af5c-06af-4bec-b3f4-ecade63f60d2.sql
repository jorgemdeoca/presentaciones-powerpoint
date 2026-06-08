
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email));
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- User settings (defaults for new presentations)
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  style TEXT NOT NULL DEFAULT 'modern',
  palette TEXT NOT NULL DEFAULT 'midnight_blue',
  font_pair TEXT NOT NULL DEFAULT 'space-grotesk-dm-sans',
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  default_language TEXT NOT NULL DEFAULT 'es',
  default_tone TEXT NOT NULL DEFAULT 'professional',
  default_slide_count INT NOT NULL DEFAULT 8,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_settings_all_own" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger needs user_settings table to exist
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Presentations
CREATE TABLE public.presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX presentations_user_idx ON public.presentations(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentations TO authenticated;
GRANT ALL ON public.presentations TO service_role;
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presentations_all_own" ON public.presentations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Slides
CREATE TABLE public.slides (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX slides_pres_idx ON public.slides(presentation_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slides TO authenticated;
GRANT ALL ON public.slides TO service_role;
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slides_all_own" ON public.slides FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- References (uploaded docs / texts / images analyzed by AI)
CREATE TABLE public.references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  file_url TEXT,
  extracted_text TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX references_user_idx ON public.references(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.references TO authenticated;
GRANT ALL ON public.references TO service_role;
ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "references_all_own" ON public.references FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('slide-images', 'slide-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true) ON CONFLICT DO NOTHING;

-- Storage policies: users manage their own folder; public read since buckets are public
CREATE POLICY "slide_images_read_public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'slide-images');
CREATE POLICY "slide_images_write_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'slide-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "slide_images_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'slide-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "slide_images_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'slide-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "uploads_read_public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'uploads');
CREATE POLICY "uploads_write_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "uploads_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "thumbnails_read_public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'thumbnails');
CREATE POLICY "thumbnails_write_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "thumbnails_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "thumbnails_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
