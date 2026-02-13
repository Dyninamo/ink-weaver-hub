CREATE POLICY "Allow insert fishing reports" ON fishing_reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update fishing reports" ON fishing_reports
  FOR UPDATE USING (true) WITH CHECK (true);