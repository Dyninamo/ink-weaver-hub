ALTER TABLE public.session_summaries
  ALTER COLUMN session_hours TYPE NUMERIC(6,2),
  ALTER COLUMN fish_per_hour TYPE NUMERIC(6,2);