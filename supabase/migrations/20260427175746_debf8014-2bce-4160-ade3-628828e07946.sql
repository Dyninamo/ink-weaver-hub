ALTER TABLE fishing_sessions
  ADD COLUMN IF NOT EXISTS venue_id TEXT;

COMMENT ON COLUMN fishing_sessions.venue_id
  IS 'Logical FK to venues_new(venue_id). Not enforced as a DB constraint because venues_new may not contain all venue IDs sent by the mobile app.';

ALTER TABLE fishing_sessions
  ADD COLUMN IF NOT EXISTS end_latitude DOUBLE PRECISION;

ALTER TABLE fishing_sessions
  ADD COLUMN IF NOT EXISTS end_longitude DOUBLE PRECISION;

ALTER TABLE fishing_sessions
  ADD COLUMN IF NOT EXISTS gps_altitude DOUBLE PRECISION;

COMMENT ON COLUMN fishing_sessions.gps_altitude
  IS 'Metres above sea level from the phone GPS at session start.';