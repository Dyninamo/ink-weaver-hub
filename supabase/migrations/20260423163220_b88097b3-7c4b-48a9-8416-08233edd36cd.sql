-- User queries (Ask the Ghillie)
CREATE TABLE IF NOT EXISTS public.user_queries (
  query_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface text NOT NULL DEFAULT 'queries_tab',
  question text NOT NULL,
  venue_id text,
  venue_name text,
  session_id uuid REFERENCES public.fishing_sessions(id) ON DELETE SET NULL,
  weather_snapshot jsonb,
  answer_narrative text,
  answer_chips jsonb,
  confidence text,
  model text,
  cached_until timestamptz,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validate surface values via trigger (immutable-safe)
CREATE OR REPLACE FUNCTION public.validate_user_query_surface()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.surface NOT IN ('queries_tab', 'pre_session', 'mid_session', 'venue_detail') THEN
    RAISE EXCEPTION 'Invalid surface: %. Must be queries_tab, pre_session, mid_session, or venue_detail.', NEW.surface;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_user_queries_surface ON public.user_queries;
CREATE TRIGGER validate_user_queries_surface
BEFORE INSERT OR UPDATE OF surface ON public.user_queries
FOR EACH ROW EXECUTE FUNCTION public.validate_user_query_surface();

-- updated_at trigger
DROP TRIGGER IF EXISTS user_queries_set_updated_at ON public.user_queries;
CREATE TRIGGER user_queries_set_updated_at
BEFORE UPDATE ON public.user_queries
FOR EACH ROW EXECUTE FUNCTION public.handle_session_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_queries_user_created
  ON public.user_queries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_queries_session
  ON public.user_queries (session_id) WHERE session_id IS NOT NULL;

ALTER TABLE public.user_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queries"
  ON public.user_queries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queries"
  ON public.user_queries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queries"
  ON public.user_queries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own queries"
  ON public.user_queries FOR DELETE
  USING (auth.uid() = user_id);