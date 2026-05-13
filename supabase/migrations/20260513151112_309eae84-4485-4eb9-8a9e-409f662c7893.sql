UPDATE public.fishing_sessions s
SET venue_id = v.venue_id
FROM public.venues_new v
WHERE s.venue_id IS NULL
  AND s.source = 'diary'
  AND lower(trim(s.venue_name)) = lower(v.name);

DO $$
DECLARE
  remaining_null integer;
BEGIN
  SELECT count(*) INTO remaining_null
    FROM public.fishing_sessions
    WHERE source = 'diary' AND venue_id IS NULL;
  RAISE NOTICE 'venue_id backfill complete: % diary sessions still NULL (expected: Home + Unknown + unmatched names)', remaining_null;
END $$;