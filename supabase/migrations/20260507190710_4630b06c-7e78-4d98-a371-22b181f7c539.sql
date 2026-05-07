BEGIN;

ALTER TABLE public.session_events
  ADD CONSTRAINT session_events_rig_position_check
    CHECK (rig_position IS NULL OR rig_position IN ('top','middle','point'));

COMMIT;

NOTIFY pgrst, 'reload schema';