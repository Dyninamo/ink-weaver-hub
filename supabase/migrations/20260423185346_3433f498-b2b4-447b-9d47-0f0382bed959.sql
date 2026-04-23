-- 1. Preserve legacy table for rollback
ALTER TABLE public.flies RENAME TO flies_legacy_20260423;

-- 2. Create v2 schema
CREATE TABLE public.flies (
    id                 INTEGER PRIMARY KEY,
    name               TEXT NOT NULL UNIQUE,
    aliases            JSONB DEFAULT '[]'::jsonb,
    category           TEXT NOT NULL,
    sub_category       TEXT,
    family             TEXT,
    tiers              JSONB DEFAULT '[]'::jsonb,
    tier_families      JSONB DEFAULT '[]'::jsonb,
    hook_size_min      INTEGER,
    hook_size_max      INTEGER,
    imitation          TEXT,
    colours            JSONB DEFAULT '[]'::jsonb,
    accents            JSONB DEFAULT '[]'::jsonb,
    weights            JSONB DEFAULT '[]'::jsonb,
    hook_styles        JSONB DEFAULT '[]'::jsonb,
    original_count     INTEGER,
    confidence_rating  INTEGER,
    box_location       TEXT,
    season_notes       TEXT,
    tactics_notes      TEXT,
    materials_summary  TEXT
);

CREATE INDEX idx_flies_category   ON public.flies (category);
CREATE INDEX idx_flies_family     ON public.flies (family);
CREATE INDEX idx_flies_name_lower ON public.flies (LOWER(name));
CREATE INDEX idx_flies_colours    ON public.flies USING GIN (colours);
CREATE INDEX idx_flies_tiers      ON public.flies USING GIN (tiers);
CREATE INDEX idx_flies_tier_fams  ON public.flies USING GIN (tier_families);
CREATE INDEX idx_flies_aliases    ON public.flies USING GIN (aliases);

-- 3. RLS
ALTER TABLE public.flies ENABLE ROW LEVEL SECURITY;

CREATE POLICY flies_public_read ON public.flies
    FOR SELECT USING (true);

CREATE POLICY flies_service_write ON public.flies
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');