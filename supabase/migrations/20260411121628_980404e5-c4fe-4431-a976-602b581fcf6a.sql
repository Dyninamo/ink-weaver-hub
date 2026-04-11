
-- Create the private bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-transcripts',
  'session-transcripts',
  false,
  5242880,
  ARRAY['application/x-ndjson', 'application/json', 'text/plain']
);

-- Allow anon to INSERT into session-transcripts only.
CREATE POLICY "Anon can insert into session-transcripts"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'session-transcripts');

-- Allow anon to UPDATE objects in session-transcripts (required for upsert).
CREATE POLICY "Anon can upsert into session-transcripts"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'session-transcripts')
  WITH CHECK (bucket_id = 'session-transcripts');
