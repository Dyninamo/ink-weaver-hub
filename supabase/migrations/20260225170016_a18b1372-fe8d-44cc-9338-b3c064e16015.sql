-- Drop existing SELECT policy that only covers own rows
DROP POLICY IF EXISTS "Users can view own submissions" ON user_venue_submissions;

-- Admin + user can read submissions
CREATE POLICY "Users and admin can read submissions"
  ON user_venue_submissions FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.jwt() ->> 'email' = 'nick.dyne@gmail.com'
  );

-- Admin can update submission status
CREATE POLICY "Admin can update submissions"
  ON user_venue_submissions FOR UPDATE
  USING (auth.jwt() ->> 'email' = 'nick.dyne@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'nick.dyne@gmail.com');