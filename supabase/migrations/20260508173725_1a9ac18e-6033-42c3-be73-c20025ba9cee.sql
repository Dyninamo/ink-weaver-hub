CREATE TABLE public.app_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_time timestamptz NOT NULL,
  server_time timestamptz NOT NULL DEFAULT now(),
  route       text,
  event_type  text NOT NULL,
  payload     jsonb,
  session_id  text,
  app_version text,
  user_agent  text
);

CREATE INDEX idx_app_events_user_time ON public.app_events (user_id, server_time DESC);
CREATE INDEX idx_app_events_event_type ON public.app_events (event_type);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_own_events"
  ON public.app_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_read_own_events"
  ON public.app_events FOR SELECT
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';