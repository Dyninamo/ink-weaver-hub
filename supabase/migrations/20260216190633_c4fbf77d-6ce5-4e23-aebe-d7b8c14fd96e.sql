
CREATE TABLE IF NOT EXISTS public.venue_spots (
  spot_id INTEGER PRIMARY KEY,
  venue_name TEXT NOT NULL,
  spot_name TEXT NOT NULL,
  access_type TEXT,
  notes TEXT,
  latitude REAL,
  longitude REAL,
  UNIQUE(venue_name, spot_name)
);

CREATE INDEX idx_venue_spots_venue ON public.venue_spots(venue_name);

ALTER TABLE public.venue_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read venue_spots" ON public.venue_spots FOR SELECT USING (true);
CREATE POLICY "Service write venue_spots" ON public.venue_spots FOR ALL USING (true) WITH CHECK (true);
