ALTER TABLE public.reports_raw
  ADD COLUMN IF NOT EXISTS content_original TEXT;

COMMENT ON COLUMN public.reports_raw.content_original IS
  'Pre-cleanup raw content from the source page (preserved when content is re-extracted to strip site navigation chrome). Master DB parity column added 2026-05-01.';

ALTER TABLE public.reports_enriched
  ADD COLUMN IF NOT EXISTS content_original TEXT;

COMMENT ON COLUMN public.reports_enriched.content_original IS
  'Pre-cleanup raw content from the source row (carried through from reports_raw). Master DB parity column added 2026-05-01.';

NOTIFY pgrst, 'reload schema';