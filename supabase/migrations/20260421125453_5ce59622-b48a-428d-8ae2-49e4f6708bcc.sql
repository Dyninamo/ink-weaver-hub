-- Batch 1: youtube_atoms, method_canonical, method_aliases
CREATE TABLE IF NOT EXISTS public.youtube_atoms (
    id BIGINT PRIMARY KEY,
    video_id TEXT,
    domain TEXT,
    water_type TEXT,
    month SMALLINT,
    conditions TEXT,
    species TEXT,
    title TEXT,
    content TEXT,
    flies_mentioned TEXT,
    methods_mentioned TEXT,
    confidence TEXT,
    venue_mentioned TEXT,
    venue_id TEXT,
    date_mentioned TEXT,
    date_resolved TEXT,
    date_source TEXT,
    weather_mentioned TEXT,
    tier TEXT,
    flies_mentioned_raw TEXT,
    venue_mentioned_raw TEXT,
    tier_original TEXT,
    atom_archetype TEXT,
    methods_mentioned_raw TEXT,
    effective_archetype TEXT
);
CREATE INDEX IF NOT EXISTS idx_yta_venue ON public.youtube_atoms(venue_mentioned);
CREATE INDEX IF NOT EXISTS idx_yta_arch ON public.youtube_atoms(effective_archetype);
CREATE INDEX IF NOT EXISTS idx_yta_water ON public.youtube_atoms(water_type);
CREATE INDEX IF NOT EXISTS idx_yta_video ON public.youtube_atoms(video_id);
ALTER TABLE public.youtube_atoms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read youtube atoms" ON public.youtube_atoms FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.method_canonical (
    canonical TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    mentions INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.method_canonical ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read method canonical" ON public.method_canonical FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.method_aliases (
    raw TEXT PRIMARY KEY,
    canonical TEXT NOT NULL REFERENCES public.method_canonical(canonical),
    category TEXT NOT NULL
);
ALTER TABLE public.method_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read method aliases" ON public.method_aliases FOR SELECT USING (true);

-- Batch 2: venue_slices_cache, stocking_records
CREATE TABLE IF NOT EXISTS public.venue_slices_cache (
    id BIGSERIAL PRIMARY KEY,
    venue_name TEXT NOT NULL UNIQUE,
    venue_id TEXT,
    generated_at TIMESTAMPTZ NOT NULL,
    archetype TEXT,
    water_type TEXT,
    atom_count INTEGER,
    slice_json JSONB NOT NULL,
    slice_text TEXT
);
CREATE INDEX IF NOT EXISTS idx_vsc_venue_id ON public.venue_slices_cache(venue_id);
CREATE INDEX IF NOT EXISTS idx_vsc_archetype ON public.venue_slices_cache(archetype);
ALTER TABLE public.venue_slices_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read venue slices" ON public.venue_slices_cache FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.stocking_records (
    id BIGSERIAL PRIMARY KEY,
    venue_name TEXT NOT NULL,
    venue_id TEXT,
    stocking_date TEXT,
    date_precision TEXT CHECK (date_precision IN ('exact','week','fortnight','month','vague')),
    species TEXT NOT NULL DEFAULT 'Rainbow',
    quantity INTEGER,
    avg_weight_lb REAL,
    supplier TEXT,
    season_total INTEGER,
    notes TEXT,
    source_report_rowid INTEGER,
    extraction_method TEXT CHECK (extraction_method IN ('regex','haiku','manual')),
    confidence REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stocking_venue ON public.stocking_records(venue_name);
CREATE INDEX IF NOT EXISTS idx_stocking_date ON public.stocking_records(stocking_date);
CREATE INDEX IF NOT EXISTS idx_stocking_vid ON public.stocking_records(venue_id);
ALTER TABLE public.stocking_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read stocking records" ON public.stocking_records FOR SELECT USING (true);

-- Batch 3: venue_clubs, weather_youtube
CREATE TABLE IF NOT EXISTS public.venue_clubs (
    id BIGSERIAL PRIMARY KEY,
    canonical_name TEXT UNIQUE,
    parent_canonical_name TEXT,
    parent_master_venue_id TEXT,
    archetype TEXT,
    region TEXT,
    atoms INTEGER,
    latitude REAL,
    longitude REAL
);
ALTER TABLE public.venue_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read venue clubs" ON public.venue_clubs FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.weather_youtube (
    id BIGSERIAL PRIMARY KEY,
    venue_mentioned TEXT,
    date TEXT,
    latitude REAL,
    longitude REAL,
    t_min_c REAL,
    t_max_c REAL,
    t_mean_c REAL,
    precip_mm REAL,
    wind_speed_max_ms REAL,
    wind_dir_dominant_deg REAL,
    cloud_cover_mean_pct REAL,
    source TEXT,
    fetched_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_wy_venue_date ON public.weather_youtube(venue_mentioned, date);
ALTER TABLE public.weather_youtube ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read weather youtube" ON public.weather_youtube FOR SELECT USING (true);

-- Batch 4: venues_new column additions
ALTER TABLE public.venues_new ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.venues_new ADD COLUMN IF NOT EXISTS is_day_ticket INTEGER;
ALTER TABLE public.venues_new ADD COLUMN IF NOT EXISTS is_season INTEGER;
ALTER TABLE public.venues_new ADD COLUMN IF NOT EXISTS is_syndicate INTEGER;
ALTER TABLE public.venues_new ADD COLUMN IF NOT EXISTS is_club INTEGER;
ALTER TABLE public.venues_new ADD COLUMN IF NOT EXISTS is_private INTEGER;
ALTER TABLE public.venues_new ADD COLUMN IF NOT EXISTS enriched_at TEXT;
ALTER TABLE public.venues_new ADD COLUMN IF NOT EXISTS enrichment_confidence TEXT;
ALTER TABLE public.venues_new ADD COLUMN IF NOT EXISTS enrichment_source TEXT;
ALTER TABLE public.venues_new ADD COLUMN IF NOT EXISTS archetype TEXT;