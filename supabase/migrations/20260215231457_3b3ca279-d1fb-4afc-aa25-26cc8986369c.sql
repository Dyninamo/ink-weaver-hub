
ALTER TABLE venue_profiles DROP COLUMN IF EXISTS season_open_month;
ALTER TABLE venue_profiles DROP COLUMN IF EXISTS season_close_month;

ALTER TABLE venue_profiles ADD COLUMN season_open_date text;
ALTER TABLE venue_profiles ADD COLUMN season_close_date text;

UPDATE venue_profiles SET season_open_date = '03-01', season_close_date = '02-01';
