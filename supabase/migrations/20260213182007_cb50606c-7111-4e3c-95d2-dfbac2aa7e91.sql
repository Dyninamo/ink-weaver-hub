
CREATE TABLE IF NOT EXISTS diary_fish (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diary_entry_id UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  fish_number INTEGER NOT NULL,
  species TEXT DEFAULT 'Rainbow' CHECK (species IN ('Rainbow', 'Brown', 'Brook', 'Tiger', 'Other')),
  weight_lb REAL,
  weight_oz REAL,
  length_inches REAL,
  
  method TEXT,
  fly TEXT,
  fly_size INTEGER,
  fly_colour TEXT,
  line TEXT,
  depth TEXT,
  retrieve TEXT,
  
  spot TEXT,
  time_caught TIME,
  
  kept_or_released TEXT DEFAULT 'Released' CHECK (kept_or_released IN ('Kept', 'Released')),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fish_entry ON diary_fish(diary_entry_id);
CREATE INDEX idx_fish_user ON diary_fish(user_id);

ALTER TABLE diary_fish ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own fish records"
  ON diary_fish FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
