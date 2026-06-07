ALTER TABLE public.session_events
  ADD CONSTRAINT session_events_weight_lb_bounds
    CHECK (weight_lb IS NULL OR (weight_lb > 0 AND weight_lb <= 50));

ALTER TABLE public.session_events
  ADD CONSTRAINT session_events_length_inches_bounds
    CHECK (length_inches IS NULL OR (length_inches > 0 AND length_inches <= 60));