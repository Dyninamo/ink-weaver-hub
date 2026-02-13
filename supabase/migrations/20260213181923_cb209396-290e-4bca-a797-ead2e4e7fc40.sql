
CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  venue TEXT NOT NULL,
  trip_date DATE NOT NULL,
  arrival_time TIME,
  departure_time TIME,
  fishing_type TEXT CHECK (fishing_type IN ('Bank', 'Boat', 'Both')),
  
  weather_auto JSONB,
  weather_override JSONB,
  
  total_fish INTEGER DEFAULT 0,
  total_kept INTEGER DEFAULT 0,
  total_released INTEGER DEFAULT 0,
  
  methods_used JSONB DEFAULT '[]',
  flies_used JSONB DEFAULT '[]',
  spots_fished JSONB DEFAULT '[]',
  best_spot TEXT,
  best_method TEXT,
  best_fly TEXT,
  
  lines_used JSONB DEFAULT '[]',
  
  notes TEXT,
  photo_urls JSONB DEFAULT '[]',
  
  is_competition BOOLEAN DEFAULT FALSE,
  competition_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  t_mean_week REAL,
  wind_speed_mean_week REAL,
  precip_total_mm_week REAL,
  pressure_mean_week REAL,
  humidity_mean_week REAL,
  
  UNIQUE(user_id, venue, trip_date)
);

CREATE INDEX idx_diary_user ON diary_entries(user_id);
CREATE INDEX idx_diary_venue ON diary_entries(venue, trip_date);
CREATE INDEX idx_diary_date ON diary_entries(trip_date);
CREATE INDEX idx_diary_user_venue ON diary_entries(user_id, venue);

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own diary entries"
  ON diary_entries FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
