DELETE FROM public.query_cache;

DROP POLICY IF EXISTS "anon_delete_cache" ON public.query_cache;
CREATE POLICY "anon_delete_cache" ON public.query_cache
  FOR DELETE
  TO anon
  USING (true);