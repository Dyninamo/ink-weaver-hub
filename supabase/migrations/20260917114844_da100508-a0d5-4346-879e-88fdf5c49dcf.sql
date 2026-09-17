ALTER TABLE public.weather_daily     RENAME COLUMN wind_speed_ms TO wind_speed_mps;
ALTER TABLE public.reports_enriched  RENAME COLUMN wind_speed_ms TO wind_speed_mps;
NOTIFY pgrst, 'reload schema';