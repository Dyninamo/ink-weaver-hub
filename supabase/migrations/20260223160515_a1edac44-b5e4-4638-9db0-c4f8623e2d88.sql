
-- PROMPT 19: Beat GPS Coordinates
-- Adds lat/lng to fishing_sessions, inserts 14 passport beats into venue_metadata

-- 1. ADD latitude/longitude TO fishing_sessions
ALTER TABLE fishing_sessions ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE fishing_sessions ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_fs_lat_lng ON fishing_sessions(latitude, longitude)
    WHERE latitude IS NOT NULL;

-- 2. INSERT 14 passport beats INTO venue_metadata (examples; remaining 209 via JSON upload)
INSERT INTO venue_metadata (id, name, latitude, longitude, description)
VALUES
  (gen_random_uuid(), 'Balder Fishery', 54.5712008780754, -2.046917157747943, 'Passport beat – Balder'),
  (gen_random_uuid(), 'East Briscoe Farm Cottages', 54.57448627916165, -2.0267229783191554, 'Passport beat – Balder'),
  (gen_random_uuid(), 'West End Farm', 54.57395606097916, -2.02183840159478, 'Passport beat – Balder'),
  (gen_random_uuid(), 'River Alyn - Rossett & Gresford Flyfishers', 53.101677307862, -2.9639804363251, 'Passport beat – Dee'),
  (gen_random_uuid(), 'Llangollen Maelor Angling', 52.969797327212, -3.1662511825562, 'Passport beat – Dee'),
  (gen_random_uuid(), 'Deepdale Woods', 54.54058233206012, -1.987631248125059, 'Passport beat – Deepdale Beck'),
  (gen_random_uuid(), 'Pembrokeshire AA Eastern & Western Cleddau', 51.784356024769, -4.86496925354, 'Passport beat – Eastern And Western Cleddau'),
  (gen_random_uuid(), 'The Bont', 51.842631939097, -4.7808766365051, 'Passport beat – Eastern And Western Cleddau'),
  (gen_random_uuid(), 'River Eden - Lower', 52.840067185636, -3.9137077331543, 'Passport beat – Eden'),
  (gen_random_uuid(), 'River Eden - Middle', 52.857503159183, -3.9218509197235, 'Passport beat – Eden'),
  (gen_random_uuid(), 'River Eden - Upper', 52.865684183751, -3.9264750480652, 'Passport beat – Eden'),
  (gen_random_uuid(), 'Toft House Fishery', 54.61673291308511, -2.017772615955258, 'Passport beat – Egglesburn'),
  (gen_random_uuid(), 'Greta Farm', 54.5142043319436, -2.0190122204720318, 'Passport beat – Greta'),
  (gen_random_uuid(), 'Bargoed Park (Taff Bargoed AA)', 51.67340738261956, -3.298497603838541, 'Passport beat – Hidden Lakes')
ON CONFLICT DO NOTHING;
