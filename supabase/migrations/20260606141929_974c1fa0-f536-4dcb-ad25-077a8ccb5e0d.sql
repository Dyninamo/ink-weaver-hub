CREATE POLICY "diary_logs_user_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'diary-logs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "diary_logs_user_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'diary-logs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );