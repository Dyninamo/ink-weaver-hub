CREATE TABLE public.query_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  venue text,
  week_num integer,
  weather_signature text,
  advice_text text,
  response_data jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_query_cache_key ON public.query_cache (cache_key);
CREATE INDEX idx_query_cache_expires ON public.query_cache (expires_at);

ALTER TABLE public.query_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of cached advice"
ON public.query_cache FOR SELECT
TO anon, authenticated
USING (expires_at > now());