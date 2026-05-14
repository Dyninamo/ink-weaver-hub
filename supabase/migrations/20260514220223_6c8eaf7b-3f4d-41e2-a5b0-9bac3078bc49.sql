CREATE TABLE IF NOT EXISTS public.venue_slices (
    venue_id        TEXT PRIMARY KEY,
    slice           JSONB NOT NULL,
    slice_built_at  TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_slices_built_at
    ON public.venue_slices (slice_built_at);

ALTER TABLE public.venue_slices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read venue_slices"
    ON public.venue_slices FOR SELECT
    USING (true);

CREATE POLICY "Service write venue_slices"
    ON public.venue_slices FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.venue_slices_touch_updated()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venue_slices_touch_updated ON public.venue_slices;
CREATE TRIGGER trg_venue_slices_touch_updated
  BEFORE UPDATE ON public.venue_slices
  FOR EACH ROW EXECUTE FUNCTION public.venue_slices_touch_updated();