-- Allow inserts into venue_metadata (needed for admin seeding)
CREATE POLICY "Allow insert venue metadata"
ON public.venue_metadata
FOR INSERT
WITH CHECK (true);

-- Allow updates for upsert to work
CREATE POLICY "Allow update venue metadata"
ON public.venue_metadata
FOR UPDATE
USING (true)
WITH CHECK (true);