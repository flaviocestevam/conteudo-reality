DROP POLICY IF EXISTS open_all_content_items ON public.content_items;
DROP POLICY IF EXISTS open_all_daily_scripts ON public.daily_scripts;
DROP POLICY IF EXISTS open_all_participants ON public.participants;
DROP POLICY IF EXISTS open_all_settings ON public.settings;

CREATE POLICY read_content_items ON public.content_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY read_daily_scripts ON public.daily_scripts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY read_participants  ON public.participants  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY read_settings      ON public.settings      FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS reality_media_all_read   ON storage.objects;
DROP POLICY IF EXISTS reality_media_all_insert ON storage.objects;
DROP POLICY IF EXISTS reality_media_all_update ON storage.objects;
DROP POLICY IF EXISTS reality_media_all_delete ON storage.objects;