-- Prompt 239 — PostgREST may not recognize partial unique indexes for ON CONFLICT.
-- Replace the partial unique index with a real UNIQUE CONSTRAINT (full, NULLs allowed).
DROP INDEX IF EXISTS public.session_events_client_event_id_uniq;
DROP INDEX IF EXISTS public.session_events_client_event_id_key;

ALTER TABLE public.session_events
  DROP CONSTRAINT IF EXISTS session_events_client_event_id_key;

ALTER TABLE public.session_events
  ADD CONSTRAINT session_events_client_event_id_key UNIQUE (client_event_id);

NOTIFY pgrst, 'reload schema';