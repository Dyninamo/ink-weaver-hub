DROP POLICY IF EXISTS "diary_logs_user_upload" ON storage.objects;
DROP POLICY IF EXISTS "diary_logs_user_update" ON storage.objects;

CREATE POLICY "diary_logs_user_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'diary-logs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "diary_logs_user_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'diary-logs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'diary-logs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );