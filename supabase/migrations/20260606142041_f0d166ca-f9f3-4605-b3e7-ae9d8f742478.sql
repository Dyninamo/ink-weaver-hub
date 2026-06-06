DROP POLICY IF EXISTS "vo_read_authenticated" ON public.venue_outreach;

CREATE POLICY "vo_read_own"
  ON public.venue_outreach FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());