
CREATE POLICY "Authenticated users can insert reference data"
  ON reference_data FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reference data"
  ON reference_data FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
