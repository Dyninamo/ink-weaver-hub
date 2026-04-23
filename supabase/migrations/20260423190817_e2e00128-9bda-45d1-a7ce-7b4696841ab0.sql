DROP POLICY IF EXISTS flies_service_write ON public.flies;

CREATE POLICY flies_anon_upsert ON public.flies
    FOR ALL USING (true) WITH CHECK (true);