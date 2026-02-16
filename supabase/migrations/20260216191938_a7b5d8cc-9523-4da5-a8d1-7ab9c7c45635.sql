
-- 1. Fly Types
CREATE TABLE IF NOT EXISTS public.fly_types (
  fly_type_id INTEGER PRIMARY KEY,
  fly_type TEXT NOT NULL UNIQUE,
  description TEXT
);
ALTER TABLE public.fly_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read fly_types" ON public.fly_types FOR SELECT USING (true);
CREATE POLICY "Service write fly_types" ON public.fly_types FOR ALL USING (true) WITH CHECK (true);

-- 2. Water Types
CREATE TABLE IF NOT EXISTS public.water_types (
  water_type_id INTEGER PRIMARY KEY,
  water_type TEXT NOT NULL UNIQUE,
  description TEXT
);
ALTER TABLE public.water_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read water_types" ON public.water_types FOR SELECT USING (true);
CREATE POLICY "Service write water_types" ON public.water_types FOR ALL USING (true) WITH CHECK (true);

-- 3. Regions
CREATE TABLE IF NOT EXISTS public.regions (
  region_id INTEGER PRIMARY KEY,
  region_name TEXT NOT NULL UNIQUE,
  description TEXT,
  essential_fly_mapping TEXT
);
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read regions" ON public.regions FOR SELECT USING (true);
CREATE POLICY "Service write regions" ON public.regions FOR ALL USING (true) WITH CHECK (true);

-- 4. Fly Species
CREATE TABLE IF NOT EXISTS public.fly_species (
  species_id INTEGER PRIMARY KEY,
  fly_type_id INTEGER REFERENCES public.fly_types(fly_type_id),
  common_name TEXT NOT NULL,
  latin_name TEXT,
  order_name TEXT,
  family_group TEXT,
  description TEXT
);
CREATE INDEX idx_fly_species_type ON public.fly_species(fly_type_id);
ALTER TABLE public.fly_species ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read fly_species" ON public.fly_species FOR SELECT USING (true);
CREATE POLICY "Service write fly_species" ON public.fly_species FOR ALL USING (true) WITH CHECK (true);

-- 5. Species Hatch Calendar
CREATE TABLE IF NOT EXISTS public.species_hatch_calendar (
  id INTEGER PRIMARY KEY,
  species_id INTEGER REFERENCES public.fly_species(species_id),
  month INTEGER NOT NULL,
  region_id INTEGER REFERENCES public.regions(region_id),
  water_type_id INTEGER REFERENCES public.water_types(water_type_id),
  hatch_intensity TEXT,
  hatch_time_of_day TEXT,
  notes TEXT,
  source TEXT
);
CREATE INDEX idx_hatch_species ON public.species_hatch_calendar(species_id);
CREATE INDEX idx_hatch_month ON public.species_hatch_calendar(month);
CREATE INDEX idx_hatch_region ON public.species_hatch_calendar(region_id);
ALTER TABLE public.species_hatch_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read species_hatch_calendar" ON public.species_hatch_calendar FOR SELECT USING (true);
CREATE POLICY "Service write species_hatch_calendar" ON public.species_hatch_calendar FOR ALL USING (true) WITH CHECK (true);

-- 6. Fly Monthly Availability
CREATE TABLE IF NOT EXISTS public.fly_monthly_availability (
  id INTEGER PRIMARY KEY,
  pattern_name TEXT NOT NULL,
  month INTEGER NOT NULL,
  source TEXT,
  relevance TEXT,
  water_type_id INTEGER REFERENCES public.water_types(water_type_id),
  notes TEXT
);
CREATE INDEX idx_availability_pattern ON public.fly_monthly_availability(pattern_name);
CREATE INDEX idx_availability_month ON public.fly_monthly_availability(month);
ALTER TABLE public.fly_monthly_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read fly_monthly_availability" ON public.fly_monthly_availability FOR SELECT USING (true);
CREATE POLICY "Service write fly_monthly_availability" ON public.fly_monthly_availability FOR ALL USING (true) WITH CHECK (true);

-- 7. Fly Species Link
CREATE TABLE IF NOT EXISTS public.fly_species_link (
  id INTEGER PRIMARY KEY,
  pattern_name TEXT NOT NULL,
  species_id INTEGER REFERENCES public.fly_species(species_id),
  is_primary INTEGER DEFAULT 0,
  life_stage TEXT,
  notes TEXT
);
CREATE INDEX idx_link_pattern ON public.fly_species_link(pattern_name);
CREATE INDEX idx_link_species ON public.fly_species_link(species_id);
ALTER TABLE public.fly_species_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read fly_species_link" ON public.fly_species_link FOR SELECT USING (true);
CREATE POLICY "Service write fly_species_link" ON public.fly_species_link FOR ALL USING (true) WITH CHECK (true);
