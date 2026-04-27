ALTER TABLE session_events
  ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION;
COMMENT ON COLUMN session_events.gps_accuracy
  IS 'GPS accuracy in metres at event time.';

ALTER TABLE session_events
  ADD COLUMN IF NOT EXISTS gps_altitude DOUBLE PRECISION;
COMMENT ON COLUMN session_events.gps_altitude
  IS 'Metres above sea level from phone GPS at event time.';

ALTER TABLE session_events
  ADD COLUMN IF NOT EXISTS sensor_pressure_hpa DOUBLE PRECISION;
COMMENT ON COLUMN session_events.sensor_pressure_hpa
  IS 'Phone barometer reading in hPa at event time.';

ALTER TABLE session_events
  ADD COLUMN IF NOT EXISTS sensor_light_lux DOUBLE PRECISION;
COMMENT ON COLUMN session_events.sensor_light_lux
  IS 'Ambient light sensor reading in lux at event time.';

ALTER TABLE session_events
  ADD COLUMN IF NOT EXISTS sensor_compass_deg DOUBLE PRECISION;
COMMENT ON COLUMN session_events.sensor_compass_deg
  IS 'Phone compass heading in degrees (0-360) at event time.';

ALTER TABLE session_events
  ADD COLUMN IF NOT EXISTS event_wind_gusts DOUBLE PRECISION;
COMMENT ON COLUMN session_events.event_wind_gusts
  IS 'Wind gust speed in km/h from weather API snapshot at event time.';

ALTER TABLE session_events
  ADD COLUMN IF NOT EXISTS event_rain_mm DOUBLE PRECISION;
COMMENT ON COLUMN session_events.event_rain_mm
  IS 'Rainfall in mm from weather API snapshot at event time.';

ALTER TABLE session_events
  ADD COLUMN IF NOT EXISTS event_cloud_pct DOUBLE PRECISION;
COMMENT ON COLUMN session_events.event_cloud_pct
  IS 'Cloud cover percentage (0-100) from weather API snapshot at event time.';

ALTER TABLE session_events
  ADD COLUMN IF NOT EXISTS event_pressure_trend TEXT;
COMMENT ON COLUMN session_events.event_pressure_trend
  IS 'Barometric pressure trend at event time. One of: falling_rapidly, falling, steady, rising, rising_rapidly.';