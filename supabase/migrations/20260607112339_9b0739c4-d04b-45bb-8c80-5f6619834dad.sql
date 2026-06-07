CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS venues_new_name_trgm
  ON public.venues_new USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.suggest_venues(q text, lim int DEFAULT 5)
RETURNS TABLE (venue_id text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.venue_id, v.name
  FROM public.venues_new v
  WHERE q IS NOT NULL AND length(btrim(q)) >= 3
    AND similarity(v.name, q) > 0.25
  ORDER BY similarity(v.name, q) DESC
  LIMIT LEAST(COALESCE(lim, 5), 10);
$$;

GRANT EXECUTE ON FUNCTION public.suggest_venues(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_venues(text, int) TO service_role;