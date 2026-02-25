
-- 1. User venue favourites
CREATE TABLE IF NOT EXISTS user_venue_favourites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL REFERENCES venues_new(venue_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, venue_id)
);

ALTER TABLE user_venue_favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favourites"
  ON user_venue_favourites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_uvf_user ON user_venue_favourites(user_id);

-- 2. User venue history
CREATE TABLE IF NOT EXISTS user_venue_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL REFERENCES venues_new(venue_id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'search',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_venue_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own history"
  ON user_venue_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_uvh_user_recent ON user_venue_history(user_id, created_at DESC);

-- Validation trigger for action column
CREATE OR REPLACE FUNCTION public.validate_venue_history_action()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.action NOT IN ('search', 'advice', 'diary') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be search, advice, or diary.', NEW.action;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_venue_history_action
  BEFORE INSERT OR UPDATE ON user_venue_history
  FOR EACH ROW EXECUTE FUNCTION public.validate_venue_history_action();

-- 3. User venue submissions
CREATE TABLE IF NOT EXISTS user_venue_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL REFERENCES venues_new(venue_id) ON DELETE CASCADE,
  submitted_name TEXT NOT NULL,
  submitted_water_type TEXT NOT NULL,
  submitted_county TEXT,
  submitted_postcode TEXT,
  submitted_latitude REAL,
  submitted_longitude REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_venue_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert submissions"
  ON user_venue_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own submissions"
  ON user_venue_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_uvs_status ON user_venue_submissions(status);
CREATE INDEX idx_uvs_user ON user_venue_submissions(user_id);

-- Validation triggers for submissions
CREATE OR REPLACE FUNCTION public.validate_venue_submission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.submitted_water_type NOT IN ('stillwater', 'river') THEN
    RAISE EXCEPTION 'Invalid water type: %. Must be stillwater or river.', NEW.submitted_water_type;
  END IF;
  IF NEW.status NOT IN ('pending', 'researched', 'merged', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be pending, researched, merged, or rejected.', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_venue_submission
  BEFORE INSERT OR UPDATE ON user_venue_submissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_venue_submission();
