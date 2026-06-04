-- Prompt 215: owner-scoped RLS on session_trails (mirror session_events)
DROP POLICY IF EXISTS "Anon can insert session_trails" ON public.session_trails;

-- Owner INSERT (authenticated users may insert points for sessions they own)
DROP POLICY IF EXISTS "Users can insert own session trails" ON public.session_trails;
CREATE POLICY "Users can insert own session trails"
ON public.session_trails
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fishing_sessions s
    WHERE s.id = session_trails.session_id
      AND s.user_id = auth.uid()
  )
);

-- Owner DELETE
DROP POLICY IF EXISTS "Users can delete own session trails" ON public.session_trails;
CREATE POLICY "Users can delete own session trails"
ON public.session_trails
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fishing_sessions s
    WHERE s.id = session_trails.session_id
      AND s.user_id = auth.uid()
  )
);

-- Service role full access (edge function)
DROP POLICY IF EXISTS "Service role can manage all trails" ON public.session_trails;
CREATE POLICY "Service role can manage all trails"
ON public.session_trails
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
