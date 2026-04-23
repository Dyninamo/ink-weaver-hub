-- 1. fly_water_type_monthly
CREATE TABLE public.fly_water_type_monthly (
    id             SERIAL PRIMARY KEY,
    pattern_name   TEXT NOT NULL,
    water_type_id  INTEGER NOT NULL,
    month          INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    suitability    TEXT NOT NULL,
    evidence_count INTEGER DEFAULT 0,
    source         TEXT DEFAULT 'family',
    UNIQUE (pattern_name, water_type_id, month)
);

CREATE INDEX idx_fwtm_pattern  ON public.fly_water_type_monthly (pattern_name);
CREATE INDEX idx_fwtm_wt_month ON public.fly_water_type_monthly (water_type_id, month);

ALTER TABLE public.fly_water_type_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY fwtm_public_read ON public.fly_water_type_monthly
    FOR SELECT USING (true);
CREATE POLICY fwtm_anon_upsert ON public.fly_water_type_monthly
    FOR ALL USING (true) WITH CHECK (true);

-- 2. fly_thumbnails
CREATE TABLE public.fly_thumbnails (
    id             SERIAL PRIMARY KEY,
    pattern_name   TEXT NOT NULL,
    source         TEXT NOT NULL,
    title_matched  TEXT,
    match_score    REAL,
    image_url      TEXT,
    local_path     TEXT,
    is_primary     INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (pattern_name, source)
);

CREATE INDEX idx_fly_thumbnails_pattern ON public.fly_thumbnails (pattern_name);

ALTER TABLE public.fly_thumbnails ENABLE ROW LEVEL SECURITY;
CREATE POLICY thumb_public_read ON public.fly_thumbnails
    FOR SELECT USING (true);
CREATE POLICY thumb_anon_upsert ON public.fly_thumbnails
    FOR ALL USING (true) WITH CHECK (true);