
ALTER TABLE fishing_sessions
ADD COLUMN IF NOT EXISTS weather_log JSONB DEFAULT '[]';

CREATE TABLE session_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES fishing_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    venue_id UUID NOT NULL REFERENCES venue_metadata(id),
    session_date DATE NOT NULL,
    session_hours NUMERIC(4,2),
    total_fish INTEGER NOT NULL DEFAULT 0,
    fish_per_hour NUMERIC(4,2),
    blanked BOOLEAN NOT NULL DEFAULT false,
    weather_periods JSONB NOT NULL DEFAULT '[]',
    setup_changes_count INTEGER NOT NULL DEFAULT 0,
    setup_change_log JSONB NOT NULL DEFAULT '[]',
    is_private BOOLEAN NOT NULL DEFAULT false,
    blank_confidence TEXT,
    satisfaction_score INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_summaries_venue_date
    ON session_summaries(venue_id, session_date);
CREATE INDEX idx_session_summaries_user_venue
    ON session_summaries(user_id, venue_id);
CREATE UNIQUE INDEX idx_session_summaries_session_id
    ON session_summaries(session_id);

CREATE TABLE angler_venue_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    venue_id UUID NOT NULL REFERENCES venue_metadata(id),
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_fish INTEGER NOT NULL DEFAULT 0,
    total_hours NUMERIC(6,1) NOT NULL DEFAULT 0,
    catch_rate NUMERIC(4,2),
    fish_per_hour NUMERIC(4,2),
    general_ability NUMERIC(4,2),
    technique_stats JSONB NOT NULL DEFAULT '{}',
    last_session_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, venue_id)
);

CREATE INDEX idx_angler_venue_stats_venue
    ON angler_venue_stats(venue_id);

CREATE TABLE venue_stats (
    venue_id UUID PRIMARY KEY REFERENCES venue_metadata(id),
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_anglers INTEGER NOT NULL DEFAULT 0,
    mean_catch_rate NUMERIC(4,2),
    mean_fish_per_hour NUMERIC(4,2),
    total_reports INTEGER NOT NULL DEFAULT 0,
    report_date_range TEXT,
    total_diary_sessions INTEGER NOT NULL DEFAULT 0,
    diary_date_range TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE angler_venue_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session summaries"
    ON session_summaries FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own session summaries"
    ON session_summaries FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own session summaries"
    ON session_summaries FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own session summaries"
    ON session_summaries FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own angler venue stats"
    ON angler_venue_stats FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own angler venue stats"
    ON angler_venue_stats FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own angler venue stats"
    ON angler_venue_stats FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own angler venue stats"
    ON angler_venue_stats FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view venue stats"
    ON venue_stats FOR SELECT
    USING (true);
