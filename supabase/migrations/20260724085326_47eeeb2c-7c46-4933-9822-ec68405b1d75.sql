
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE POLICY "reality_media_all_read" ON storage.objects FOR SELECT
USING (bucket_id = 'reality-media');
CREATE POLICY "reality_media_all_insert" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'reality-media');
CREATE POLICY "reality_media_all_update" ON storage.objects FOR UPDATE
USING (bucket_id = 'reality-media');
CREATE POLICY "reality_media_all_delete" ON storage.objects FOR DELETE
USING (bucket_id = 'reality-media');
