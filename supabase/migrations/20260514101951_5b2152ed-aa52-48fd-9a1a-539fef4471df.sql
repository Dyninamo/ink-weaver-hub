ALTER TABLE public.session_summaries  DROP CONSTRAINT IF EXISTS session_summaries_venue_id_fkey;
ALTER TABLE public.angler_venue_stats DROP CONSTRAINT IF EXISTS angler_venue_stats_venue_id_fkey;
ALTER TABLE public.venue_stats        DROP CONSTRAINT IF EXISTS venue_stats_venue_id_fkey;
ALTER TABLE public.session_summaries  ALTER COLUMN venue_id TYPE text USING venue_id::text;
ALTER TABLE public.angler_venue_stats ALTER COLUMN venue_id TYPE text USING venue_id::text;
ALTER TABLE public.venue_stats        ALTER COLUMN venue_id TYPE text USING venue_id::text;
ALTER TABLE public.venue_preferences  ALTER COLUMN venue_id TYPE text USING venue_id::text;