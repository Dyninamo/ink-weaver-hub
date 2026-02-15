
-- Table 1: prediction_params
CREATE TABLE prediction_params (
    venue TEXT NOT NULL,
    target TEXT NOT NULL CHECK (target IN ('rod_average', 'flies', 'methods', 'spots')),
    week_window INTEGER NOT NULL DEFAULT 2,
    top_n INTEGER NOT NULL DEFAULT 10,
    year_decay REAL NOT NULL DEFAULT 0.7,
    w_temperature REAL NOT NULL DEFAULT 1.0,
    w_wind_speed REAL NOT NULL DEFAULT 0.25,
    w_precipitation REAL NOT NULL DEFAULT 1.0,
    w_pressure REAL NOT NULL DEFAULT 0.0,
    w_humidity REAL NOT NULL DEFAULT 1.0,
    use_cross_venue INTEGER NOT NULL DEFAULT 0,
    venue_weight REAL NOT NULL DEFAULT 3.0,
    source TEXT NOT NULL DEFAULT 'global_default' CHECK (source IN ('global_default', 'tuned', 'manual')),
    last_validated TEXT,
    PRIMARY KEY (venue, target)
);

ALTER TABLE prediction_params ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on prediction_params"
    ON prediction_params FOR SELECT USING (true);
CREATE POLICY "Service write prediction_params"
    ON prediction_params FOR ALL USING (true) WITH CHECK (true);

-- Table 2: venue_profiles
CREATE TABLE venue_profiles (
    venue TEXT PRIMARY KEY,
    region TEXT NOT NULL,
    report_count INTEGER NOT NULL,
    date_range_start TEXT,
    date_range_end TEXT,
    rod_avg_mean REAL,
    rod_avg_std REAL,
    rod_mae REAL,
    rod_mae_ci_lo REAL,
    rod_mae_ci_hi REAL,
    flies_recall_at5 REAL,
    methods_recall_at4 REAL,
    spots_recall_at4 REAL,
    temp_correlation REAL,
    character_notes TEXT,
    cross_venue_rule TEXT NOT NULL DEFAULT 'same_venue_only'
        CHECK (cross_venue_rule IN ('same_venue_only', 'cross_venue_rod_avg', 'cross_venue_all')),
    cross_venue_warnings TEXT,
    seasonal_pattern_json TEXT,
    data_quality_flag TEXT NOT NULL DEFAULT 'full'
        CHECK (data_quality_flag IN ('full', 'limited', 'insufficient')),
    last_updated TEXT NOT NULL
);

ALTER TABLE venue_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on venue_profiles"
    ON venue_profiles FOR SELECT USING (true);
CREATE POLICY "Service write venue_profiles"
    ON venue_profiles FOR ALL USING (true) WITH CHECK (true);

-- Table 3: venue_correlations
CREATE TABLE venue_correlations (
    venue_a TEXT NOT NULL,
    venue_b TEXT NOT NULL,
    metric TEXT NOT NULL DEFAULT 'rod_average',
    correlation REAL,
    fly_overlap_jaccard REAL,
    notes TEXT,
    last_updated TEXT NOT NULL,
    PRIMARY KEY (venue_a, venue_b, metric),
    CHECK (venue_a < venue_b)
);

ALTER TABLE venue_correlations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on venue_correlations"
    ON venue_correlations FOR SELECT USING (true);
CREATE POLICY "Service write venue_correlations"
    ON venue_correlations FOR ALL USING (true) WITH CHECK (true);
