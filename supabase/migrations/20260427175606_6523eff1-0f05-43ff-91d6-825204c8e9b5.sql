CREATE TABLE IF NOT EXISTS session_trails (
  id             UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID             NOT NULL REFERENCES fishing_sessions(id),
  sort_order     INTEGER          NOT NULL,
  timestamp      TIMESTAMPTZ      NOT NULL,
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  accuracy       DOUBLE PRECISION,
  altitude       DOUBLE PRECISION,
  pressure_hpa   DOUBLE PRECISION,
  light_lux      DOUBLE PRECISION,
  compass_deg    DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_session_trails_session
  ON session_trails(session_id);

ALTER TABLE session_trails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert session_trails"
  ON session_trails FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can read diary session trails"
  ON session_trails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fishing_sessions
      WHERE fishing_sessions.id = session_trails.session_id
        AND fishing_sessions.source = 'diary'
    )
  );

CREATE POLICY "Users can read own session trails"
  ON session_trails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fishing_sessions
      WHERE fishing_sessions.id = session_trails.session_id
        AND fishing_sessions.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS session_weather_log (
  id                 UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID             NOT NULL REFERENCES fishing_sessions(id),
  sort_order         INTEGER          NOT NULL,
  timestamp          TIMESTAMPTZ      NOT NULL,
  temperature_c      DOUBLE PRECISION,
  wind_speed_kmh     DOUBLE PRECISION,
  wind_direction_deg DOUBLE PRECISION,
  wind_gusts_kmh     DOUBLE PRECISION,
  pressure_msl_hpa   DOUBLE PRECISION,
  rain_mm            DOUBLE PRECISION,
  cloud_cover_pct    DOUBLE PRECISION,
  is_day             BOOLEAN,
  rejected           BOOLEAN          NOT NULL DEFAULT false,
  phone_pressure_hpa DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_session_weather_log_session
  ON session_weather_log(session_id);

ALTER TABLE session_weather_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert session_weather_log"
  ON session_weather_log FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can read diary session weather log"
  ON session_weather_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fishing_sessions
      WHERE fishing_sessions.id = session_weather_log.session_id
        AND fishing_sessions.source = 'diary'
    )
  );

CREATE POLICY "Users can read own session weather log"
  ON session_weather_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fishing_sessions
      WHERE fishing_sessions.id = session_weather_log.session_id
        AND fishing_sessions.user_id = auth.uid()
    )
  );