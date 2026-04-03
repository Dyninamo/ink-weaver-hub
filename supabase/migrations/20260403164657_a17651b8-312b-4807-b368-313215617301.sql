CREATE POLICY "vo_read_authenticated"
  ON venue_outreach FOR SELECT
  TO authenticated
  USING (true);