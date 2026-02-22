
CREATE TABLE fly_water_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_name TEXT NOT NULL,
    water_type_id BIGINT NOT NULL REFERENCES water_types(water_type_id),
    suitability TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(pattern_name, water_type_id)
);

CREATE INDEX idx_fly_water_types_pattern ON fly_water_types(pattern_name);
CREATE INDEX idx_fly_water_types_water_type ON fly_water_types(water_type_id);

ALTER TABLE fly_water_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on fly_water_types"
    ON fly_water_types FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated insert on fly_water_types"
    ON fly_water_types FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on fly_water_types"
    ON fly_water_types FOR DELETE
    TO authenticated
    USING (true);
