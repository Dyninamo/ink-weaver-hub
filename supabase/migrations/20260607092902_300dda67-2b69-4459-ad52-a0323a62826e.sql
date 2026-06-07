ALTER TABLE public.session_events
  ADD COLUMN IF NOT EXISTS client_event_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS session_events_client_event_id_uniq
  ON public.session_events (client_event_id)
  WHERE client_event_id IS NOT NULL;