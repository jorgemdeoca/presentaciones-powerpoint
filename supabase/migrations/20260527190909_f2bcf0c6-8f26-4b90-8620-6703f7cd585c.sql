
-- Replace broad public-read SELECT policies with owner-folder SELECT.
-- Files remain publicly accessible via getPublicUrl because buckets are public=true.
DROP POLICY IF EXISTS "slide_images_read_public" ON storage.objects;
DROP POLICY IF EXISTS "uploads_read_public" ON storage.objects;
DROP POLICY IF EXISTS "thumbnails_read_public" ON storage.objects;

CREATE POLICY "slide_images_list_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'slide-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "uploads_list_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "thumbnails_list_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Lock down handle_new_user: only the auth trigger (superuser) should call it.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
