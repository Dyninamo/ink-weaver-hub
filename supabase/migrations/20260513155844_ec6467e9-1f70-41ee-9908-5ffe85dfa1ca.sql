ALTER TABLE public.session_events DROP CONSTRAINT IF EXISTS session_events_got_away_stage_check;
ALTER TABLE public.session_events ADD CONSTRAINT session_events_got_away_stage_check
  CHECK (got_away_stage IS NULL OR got_away_stage IN (
    'on_take', 'during_fight', 'at_net',
    'On the take', 'During the fight', 'At the net'
  ));