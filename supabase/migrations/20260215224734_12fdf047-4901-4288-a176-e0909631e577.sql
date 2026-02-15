
-- Prompt 1: Create missing reference tables (ref_leaders, ref_tippets, ref_rods)
CREATE TABLE public.ref_leaders (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  brand text,
  material text,
  type text,
  length_ft real,
  butt_diameter_mm real,
  tippet_diameter_mm real,
  breaking_strain_lb real,
  typical_use text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ref_leaders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ref_leaders" ON public.ref_leaders FOR SELECT USING (true);
CREATE POLICY "Service write ref_leaders" ON public.ref_leaders FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.ref_tippets (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  brand text,
  material text,
  diameter_mm real,
  breaking_strain_lb real,
  x_rating text,
  spool_length_m integer,
  typical_use text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ref_tippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ref_tippets" ON public.ref_tippets FOR SELECT USING (true);
CREATE POLICY "Service write ref_tippets" ON public.ref_tippets FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.ref_rods (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  manufacturer text,
  model text,
  length_ft real,
  line_weight integer,
  pieces integer,
  action text,
  water_type text,
  primary_use text,
  owner text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ref_rods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ref_rods" ON public.ref_rods FOR SELECT USING (true);
CREATE POLICY "Service write ref_rods" ON public.ref_rods FOR ALL USING (true) WITH CHECK (true);

-- Prompt 4: Add season columns to venue_profiles
ALTER TABLE public.venue_profiles ADD COLUMN IF NOT EXISTS season_open_month integer;
ALTER TABLE public.venue_profiles ADD COLUMN IF NOT EXISTS season_close_month integer;

UPDATE public.venue_profiles SET season_open_month = 3, season_close_month = 11 WHERE venue = 'Grafham Water';
UPDATE public.venue_profiles SET season_open_month = 3, season_close_month = 11 WHERE venue = 'Pitsford Water';
UPDATE public.venue_profiles SET season_open_month = 3, season_close_month = 11 WHERE venue = 'Rutland Water';
UPDATE public.venue_profiles SET season_open_month = 3, season_close_month = 11 WHERE venue = 'Ravensthorpe Reservoir';
UPDATE public.venue_profiles SET season_open_month = 3, season_close_month = 11 WHERE venue = 'Draycote Water';
