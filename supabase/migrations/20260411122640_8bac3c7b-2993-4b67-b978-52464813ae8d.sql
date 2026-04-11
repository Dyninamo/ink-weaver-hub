DROP POLICY "Anon can insert into session-transcripts" ON storage.objects;
DROP POLICY "Anon can upsert into session-transcripts" ON storage.objects;

CREATE POLICY "Anon can insert into session-transcripts"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'session-transcripts');

CREATE POLICY "Anon can upsert into session-transcripts"
  ON storage.objects FOR UPDATE
  TO public
  USING      (bucket_id = 'session-transcripts')
  WITH CHECK (bucket_id = 'session-transcripts');