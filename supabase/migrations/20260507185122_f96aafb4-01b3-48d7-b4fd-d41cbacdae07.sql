BEGIN;

ALTER TABLE public.session_events
    ADD CONSTRAINT session_events_dropper_position_check
        CHECK (dropper_position IS NULL
            OR dropper_position IN ('d1','d2','d3','d4'));

COMMIT;

NOTIFY pgrst, 'reload schema';