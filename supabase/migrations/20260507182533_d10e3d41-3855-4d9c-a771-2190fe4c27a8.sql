ALTER TABLE public.session_events
    ADD COLUMN IF NOT EXISTS quantity         integer,
    ADD COLUMN IF NOT EXISTS created_at       timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS dropper_position text,
    ADD COLUMN IF NOT EXISTS kept_released    text,
    ADD COLUMN IF NOT EXISTS gps_latitude     double precision,
    ADD COLUMN IF NOT EXISTS gps_longitude    double precision,
    ADD COLUMN IF NOT EXISTS voice_transcript text,
    ADD COLUMN IF NOT EXISTS input_method     text DEFAULT 'manual';

NOTIFY pgrst, 'reload schema';