
CREATE OR REPLACE VIEW diary_as_reports AS
SELECT
  d.venue,
  d.trip_date AS date,
  EXTRACT(WEEK FROM d.trip_date)::INTEGER AS week_num,
  EXTRACT(YEAR FROM d.trip_date)::INTEGER AS year,
  d.total_fish::REAL AS rod_average,
  d.methods_used AS methods,
  d.flies_used AS flies,
  d.spots_fished AS best_spots,
  COALESCE(d.notes, '') AS summary,
  '' AS content,
  d.t_mean_week,
  d.wind_speed_mean_week,
  d.precip_total_mm_week,
  d.pressure_mean_week,
  d.humidity_mean_week,
  d.user_id
FROM diary_entries d
WHERE d.total_fish IS NOT NULL
  AND d.t_mean_week IS NOT NULL;
