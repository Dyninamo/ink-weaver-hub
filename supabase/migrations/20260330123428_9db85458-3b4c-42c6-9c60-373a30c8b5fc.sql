
-- Pattern discovery tables
CREATE TABLE IF NOT EXISTS pattern_weather_effects (
    pattern_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    variable         TEXT NOT NULL,
    condition_value  TEXT NOT NULL,
    water_type_id    INTEGER REFERENCES water_types(water_type_id),
    month            INTEGER,
    n_sessions       INTEGER NOT NULL,
    mean_catch       REAL NOT NULL,
    baseline_catch   REAL NOT NULL,
    effect_size      REAL NOT NULL,
    cohen_d          REAL,
    p_value          REAL,
    ci_lower         REAL,
    ci_upper         REAL,
    n_venues         INTEGER,
    confidence       INTEGER NOT NULL,
    source           TEXT NOT NULL,
    is_interaction   BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pattern_fly_conditions (
    pattern_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fly_name          TEXT NOT NULL,
    condition_type    TEXT NOT NULL,
    condition_value   TEXT NOT NULL,
    water_type_id     INTEGER REFERENCES water_types(water_type_id),
    month             INTEGER,
    n_mentions        INTEGER NOT NULL,
    pct_of_condition  REAL NOT NULL,
    pct_overall       REAL NOT NULL,
    lift              REAL NOT NULL,
    rank_in_condition INTEGER,
    confidence        INTEGER NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pattern_hatch_weather (
    pattern_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    species_id        INTEGER NOT NULL,
    species_name      TEXT NOT NULL,
    month             INTEGER NOT NULL,
    water_type_id     INTEGER REFERENCES water_types(water_type_id),
    hatch_intensity   TEXT NOT NULL,
    temp_band         TEXT,
    recommended_flies TEXT,
    fly_lift          REAL,
    n_observations    INTEGER NOT NULL,
    confidence        INTEGER NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pattern_discovery_meta (
    run_id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_date                 TEXT NOT NULL,
    n_reports                INTEGER,
    n_sessions               INTEGER,
    n_patterns_discovered    INTEGER,
    n_fly_patterns           INTEGER,
    n_hatch_patterns         INTEGER,
    min_samples              INTEGER,
    significance_level       REAL,
    min_confidence           INTEGER,
    script_version           TEXT,
    notes                    TEXT
);

CREATE TABLE IF NOT EXISTS report_sources (
    source_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_name          TEXT NOT NULL UNIQUE,
    source_domain        TEXT NOT NULL,
    hub_url              TEXT NOT NULL,
    source_type          TEXT NOT NULL DEFAULT 'independent',
    discovery_strategy   TEXT NOT NULL DEFAULT 'auto',
    split_strategy       TEXT NOT NULL DEFAULT 'split_by_date_headers',
    extract_strategy     TEXT NOT NULL DEFAULT 'extract_stillwater',
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    n_venues             INTEGER NOT NULL DEFAULT 1,
    n_reports_total      INTEGER NOT NULL DEFAULT 0,
    last_checked         TIMESTAMPTZ,
    last_new_report      TIMESTAMPTZ,
    check_interval_days  INTEGER NOT NULL DEFAULT 7,
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_venue_map (
    source_id       BIGINT NOT NULL REFERENCES report_sources(source_id),
    venue_name      TEXT NOT NULL,
    venue_pattern   TEXT,
    is_primary      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, venue_name)
);

-- Enable RLS on all 6 tables
ALTER TABLE pattern_weather_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_fly_conditions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_hatch_weather   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_discovery_meta  ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_venue_map        ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Allow public read" ON pattern_weather_effects FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON pattern_fly_conditions  FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON pattern_hatch_weather   FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON pattern_discovery_meta  FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON report_sources          FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON source_venue_map        FOR SELECT USING (true);
