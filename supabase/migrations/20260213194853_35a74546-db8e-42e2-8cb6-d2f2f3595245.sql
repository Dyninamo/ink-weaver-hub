CREATE POLICY "Allow authenticated insert basic advice" ON public.basic_advice
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update basic advice" ON public.basic_advice
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);