
-- Add venue_type to fishing_reports if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fishing_reports' AND column_name = 'venue_type'
  ) THEN
    ALTER TABLE fishing_reports ADD COLUMN venue_type TEXT DEFAULT 'stillwater';
  END IF;
END $$;

-- Add venue_type to diary_entries if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diary_entries' AND column_name = 'venue_type'
  ) THEN
    ALTER TABLE diary_entries ADD COLUMN venue_type TEXT DEFAULT 'stillwater';
  END IF;
END $$;

-- Create/replace the diary totals trigger function
CREATE OR REPLACE FUNCTION update_diary_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE diary_entries SET
    total_fish = (SELECT COUNT(*) FROM diary_fish WHERE diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id)),
    total_kept = (SELECT COUNT(*) FROM diary_fish WHERE diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id) AND kept_or_released = 'Kept'),
    total_released = (SELECT COUNT(*) FROM diary_fish WHERE diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id) AND kept_or_released = 'Released'),
    methods_used = (SELECT COALESCE(jsonb_agg(DISTINCT f.method) FILTER (WHERE f.method IS NOT NULL), '[]') FROM diary_fish f WHERE f.diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id)),
    flies_used = (SELECT COALESCE(jsonb_agg(DISTINCT f.fly) FILTER (WHERE f.fly IS NOT NULL), '[]') FROM diary_fish f WHERE f.diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id)),
    spots_fished = (SELECT COALESCE(jsonb_agg(DISTINCT f.spot) FILTER (WHERE f.spot IS NOT NULL), '[]') FROM diary_fish f WHERE f.diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on diary_fish
DROP TRIGGER IF EXISTS diary_fish_changed ON diary_fish;
CREATE TRIGGER diary_fish_changed
  AFTER INSERT OR UPDATE OR DELETE ON diary_fish
  FOR EACH ROW EXECUTE FUNCTION update_diary_totals();

-- Recreate the diary_as_reports view with correct types
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
  d.notes AS summary,
  d.notes AS content,
  d.t_mean_week,
  d.wind_speed_mean_week,
  d.precip_total_mm_week,
  d.pressure_mean_week,
  d.humidity_mean_week,
  d.user_id
FROM diary_entries d
WHERE d.total_fish > 0;

-- Seed reference data (methods, lines, depths, retrieves, flies)
INSERT INTO reference_data (category, value, usage_count) VALUES
  ('method', 'Buzzer', 100),
  ('method', 'Dry', 60),
  ('method', 'Dry-Dropper', 40),
  ('method', 'Euro Nymph', 30),
  ('method', 'Lure', 90),
  ('method', 'Lure + Nymph', 20),
  ('method', 'Nymph', 80),
  ('method', 'Nymph/Buzzer', 50),
  ('method', 'Wet', 70)
ON CONFLICT (category, value, venue) DO NOTHING;

INSERT INTO reference_data (category, value, usage_count) VALUES
  ('line', 'Floating', 100),
  ('line', 'Hover', 40),
  ('line', 'Intermediate', 70),
  ('line', 'Midge Tip', 50),
  ('line', 'Sink Tip', 30),
  ('line', 'Di-3', 60),
  ('line', 'Di-5', 50),
  ('line', 'Di-7', 30),
  ('line', 'Fast Sinking', 20)
ON CONFLICT (category, value, venue) DO NOTHING;

INSERT INTO reference_data (category, value, usage_count) VALUES
  ('depth', 'Surface', 80),
  ('depth', 'Sub-surface', 70),
  ('depth', 'Mid-water', 50),
  ('depth', 'Deep', 40),
  ('depth', 'On the drop', 60)
ON CONFLICT (category, value, venue) DO NOTHING;

INSERT INTO reference_data (category, value, usage_count) VALUES
  ('retrieve', 'Figure-of-Eight Slow', 80),
  ('retrieve', 'Figure-of-Eight Fast', 60),
  ('retrieve', 'Static', 70),
  ('retrieve', 'On The Drop', 50),
  ('retrieve', 'On The Hang', 50),
  ('retrieve', 'Short Strips', 60),
  ('retrieve', 'Long Pulls', 40),
  ('retrieve', 'Roly Poly', 50),
  ('retrieve', 'Slow Constant', 30),
  ('retrieve', 'Sink and Draw', 30),
  ('retrieve', 'Twitched', 20),
  ('retrieve', 'Induced Take', 20),
  ('retrieve', 'Countdown', 20),
  ('retrieve', 'Washing Line Drift', 40),
  ('retrieve', 'Varied Speed', 30)
ON CONFLICT (category, value, venue) DO NOTHING;

INSERT INTO reference_data (category, value, usage_count) VALUES
  ('fly', 'Diawl Bach', 100),
  ('fly', 'Buzzer (Black)', 90),
  ('fly', 'Damsel Nymph', 85),
  ('fly', 'Hares Ear', 80),
  ('fly', 'Cat''s Whisker', 75),
  ('fly', 'Blob (Orange)', 70),
  ('fly', 'Pheasant Tail Nymph', 70),
  ('fly', 'Woolly Bugger', 65),
  ('fly', 'Montanas', 60),
  ('fly', 'Cormorant', 60),
  ('fly', 'Snake Fly', 55),
  ('fly', 'Booby', 55),
  ('fly', 'CDC & Elk', 50),
  ('fly', 'Parachute Adams', 50),
  ('fly', 'F-Fly', 45),
  ('fly', 'Klinkhamer', 45),
  ('fly', 'Minkie', 40),
  ('fly', 'Apps Bloodworm', 40),
  ('fly', 'Shipman''s Buzzer', 40),
  ('fly', 'Claret Dabbler', 35),
  ('fly', 'Gold Ribbed Hares Ear', 35),
  ('fly', 'Sedge Pupa', 30),
  ('fly', 'Black & Peacock Spider', 30),
  ('fly', 'Bibio', 30),
  ('fly', 'Humungous', 25),
  ('fly', 'Fab (Fluorescent)', 25),
  ('fly', 'Tadpole', 25),
  ('fly', 'Egg Fly', 20),
  ('fly', 'Hothead Damsel', 20),
  ('fly', 'Zonker', 20)
ON CONFLICT (category, value, venue) DO NOTHING;
