DROP POLICY IF EXISTS "Anon can insert into session-transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Anon can upsert into session-transcripts" ON storage.objects;

CREATE POLICY "session_transcripts_user_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'session-transcripts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "session_transcripts_user_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'session-transcripts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "session_transcripts_user_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'session-transcripts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'session-transcripts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "session_transcripts_user_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'session-transcripts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );