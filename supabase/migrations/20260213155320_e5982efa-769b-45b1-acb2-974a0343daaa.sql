CREATE POLICY "Allow insert basic advice" ON basic_advice
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update basic advice" ON basic_advice
  FOR UPDATE USING (true) WITH CHECK (true);