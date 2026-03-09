
-- 1. species_size_profiles
CREATE TABLE IF NOT EXISTS species_size_profiles (
  size_profile_id SERIAL PRIMARY KEY,
  species_name TEXT NOT NULL,
  species_code TEXT NOT NULL UNIQUE,
  lw_coefficient_a REAL NOT NULL,
  lw_exponent_b REAL NOT NULL,
  tolerance_pct REAL NOT NULL DEFAULT 30.0,
  typical_length_min_cm REAL, typical_length_max_cm REAL,
  typical_weight_min_kg REAL, typical_weight_max_kg REAL,
  typical_length_min_in REAL, typical_length_max_in REAL,
  typical_weight_min_lb REAL, typical_weight_max_lb REAL,
  record_weight_natural_kg REAL, record_weight_natural_lb REAL,
  record_length_natural_cm REAL, record_length_natural_in REAL,
  record_weight_cultivated_kg REAL, record_weight_cultivated_lb REAL,
  record_length_cultivated_cm REAL, record_length_cultivated_in REAL,
  record_notes TEXT, notes TEXT, source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE species_size_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read species_size_profiles" ON species_size_profiles FOR SELECT USING (true);

-- Seed 7 species
INSERT INTO species_size_profiles (
  species_name, species_code, lw_coefficient_a, lw_exponent_b, tolerance_pct,
  typical_length_min_cm, typical_length_max_cm, typical_weight_min_kg, typical_weight_max_kg,
  typical_length_min_in, typical_length_max_in, typical_weight_min_lb, typical_weight_max_lb,
  record_weight_natural_kg, record_weight_natural_lb, record_length_natural_cm, record_length_natural_in,
  record_weight_cultivated_kg, record_weight_cultivated_lb, record_length_cultivated_cm, record_length_cultivated_in,
  record_notes, source
) VALUES
  ('Rainbow Trout', 'rainbow', 0.00000933, 3.03, 30.0,
   25, 75, 0.15, 4.5, 9.8, 29.5, 0.33, 9.92,
   NULL, NULL, NULL, NULL, 13.95, 30.75, 80, 31.5,
   'Cultivated: 30lb 12oz, T Flower, Tavistock, 1994. Not native to UK.',
   'FishBase Bayesian LWR for Oncorhynchus mykiss'),
  ('Brown Trout', 'brown', 0.00000871, 3.03, 30.0,
   20, 80, 0.08, 5.0, 7.9, 31.5, 0.18, 11.02,
   14.40, 31.75, 90, 35.4, 12.73, 28.06, 85, 33.5,
   'Natural: 31lb 12oz, Brian Rutland, Loch Awe, 2002. Cultivated: 28lb 1oz, D Taylor, Dever Springs, 1995.',
   'FishBase Bayesian LWR for Salmo trutta'),
  ('Brook Trout', 'brook', 0.00000912, 3.03, 30.0,
   15, 50, 0.03, 2.0, 5.9, 19.7, 0.07, 4.41,
   NULL, NULL, NULL, NULL, 3.71, 8.19, 50, 19.7,
   'Cultivated: 8lb 3oz, Ernest Holland, Fontburn Reservoir, 1998.',
   'FishBase Bayesian LWR for Salvelinus fontinalis'),
  ('Tiger Trout', 'tiger', 0.00000950, 3.03, 35.0,
   20, 55, 0.08, 3.0, 7.9, 21.7, 0.18, 6.61,
   NULL, NULL, NULL, NULL, 5.22, 11.51, 55, 21.7,
   'No BRFC category. UK catches to ~11lb 8oz (Alderneuk, Scotland).',
   'Derived: midpoint Brown + Brook Bayesian'),
  ('Blue Trout', 'blue', 0.00000933, 3.03, 30.0,
   25, 65, 0.15, 3.5, 9.8, 25.6, 0.33, 7.72,
   NULL, NULL, NULL, NULL, 5.76, 12.70, 58, 22.8,
   'No BRFC category. Colour variant of Rainbow Trout.',
   'FishBase Bayesian LWR for Oncorhynchus mykiss'),
  ('Arctic Char', 'char', 0.00000724, 3.03, 35.0,
   15, 55, 0.03, 1.5, 5.9, 21.7, 0.07, 3.31,
   4.31, 9.50, 60, 23.6, NULL, NULL, NULL, NULL,
   'Natural: 9lb 8oz, W Fairbairn, Loch Arkaig, 1995.',
   'FishBase Bayesian LWR for Salvelinus alpinus'),
  ('Grayling', 'grayling', 0.00000776, 3.06, 30.0,
   20, 50, 0.07, 1.2, 7.9, 19.7, 0.15, 2.65,
   2.04, 4.50, 48, 18.9, NULL, NULL, NULL, NULL,
   'Natural: 4lb 8oz, Simon Ellis, Wessex River, 2019.',
   'FishBase Bayesian LWR for Thymallus thymallus');

-- 2. notable_fish (user_profiles uses id not user_id)
CREATE TABLE IF NOT EXISTS notable_fish (
  fish_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES user_profiles(profile_id),
  session_id UUID REFERENCES fishing_sessions(id),
  venue_id TEXT REFERENCES venues_new(venue_id),
  venue_name TEXT NOT NULL,
  species TEXT NOT NULL,
  length_cm REAL, length_in REAL, weight_kg REAL, weight_lb REAL,
  measurement_unit TEXT NOT NULL DEFAULT 'metric' CHECK (measurement_unit IN ('metric', 'imperial')),
  measurement_entered_at TIMESTAMPTZ NOT NULL,
  photo_url TEXT, photo_uploaded_at TIMESTAMPTZ,
  exif_latitude REAL, exif_longitude REAL, exif_taken_at TIMESTAMPTZ,
  exif_device TEXT, exif_edited BOOLEAN DEFAULT false, exif_subject_distance_m REAL,
  check_location_pass BOOLEAN, check_time_pass BOOLEAN, check_edit_clean BOOLEAN,
  check_plausibility_pass BOOLEAN, check_measure_in_frame BOOLEAN,
  confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  verification_tier INTEGER NOT NULL DEFAULT 1 CHECK (verification_tier BETWEEN 1 AND 4),
  n_witnesses INTEGER NOT NULL DEFAULT 0,
  venue_percentile REAL, platform_percentile REAL,
  is_personal_best BOOLEAN NOT NULL DEFAULT false,
  is_venue_season_record BOOLEAN NOT NULL DEFAULT false,
  is_venue_alltime_record BOOLEAN NOT NULL DEFAULT false,
  is_platform_record BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notable_fish ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read active notable fish" ON notable_fish FOR SELECT USING (is_active = true);
CREATE POLICY "Users can insert own notable fish" ON notable_fish FOR INSERT WITH CHECK (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own notable fish" ON notable_fish FOR UPDATE USING (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE INDEX idx_notable_fish_profile ON notable_fish(profile_id);
CREATE INDEX idx_notable_fish_venue ON notable_fish(venue_id, submitted_at DESC);
CREATE INDEX idx_notable_fish_species ON notable_fish(species, weight_kg DESC);
CREATE INDEX idx_notable_fish_tier ON notable_fish(verification_tier);

-- 3. fish_witnesses
CREATE TABLE IF NOT EXISTS fish_witnesses (
  witness_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fish_id UUID NOT NULL REFERENCES notable_fish(fish_id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_profiles(profile_id),
  witnessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fish_id, profile_id)
);
ALTER TABLE fish_witnesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read witnesses" ON fish_witnesses FOR SELECT USING (true);
CREATE POLICY "Users can insert own witness" ON fish_witnesses FOR INSERT WITH CHECK (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE INDEX idx_fish_witnesses_fish ON fish_witnesses(fish_id);

-- 4. leaderboard_entries
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fish_id UUID NOT NULL UNIQUE REFERENCES notable_fish(fish_id),
  scope TEXT NOT NULL CHECK (scope IN ('personal_best', 'venue_season', 'venue_alltime', 'group', 'platform_species')),
  group_id UUID REFERENCES social_groups(group_id),
  venue_id TEXT REFERENCES venues_new(venue_id),
  profile_id UUID NOT NULL REFERENCES user_profiles(profile_id),
  species TEXT NOT NULL,
  weight_kg REAL, weight_lb REAL, length_cm REAL, length_in REAL,
  venue_percentile REAL, verification_tier INTEGER NOT NULL,
  season TEXT, rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read leaderboard" ON leaderboard_entries FOR SELECT USING (true);
CREATE INDEX idx_leaderboard_scope ON leaderboard_entries(scope, venue_id, species, weight_kg DESC);

-- 5. verification_scores
CREATE TABLE IF NOT EXISTS verification_scores (
  score_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fish_id UUID NOT NULL UNIQUE REFERENCES notable_fish(fish_id) ON DELETE CASCADE,
  pts_measurement_entered INTEGER NOT NULL DEFAULT 0,
  pts_plausibility_pass INTEGER NOT NULL DEFAULT 0,
  pts_photo_submitted INTEGER NOT NULL DEFAULT 0,
  pts_exif_clean INTEGER NOT NULL DEFAULT 0,
  pts_location_match INTEGER NOT NULL DEFAULT 0,
  pts_time_match INTEGER NOT NULL DEFAULT 0,
  pts_measure_in_frame INTEGER NOT NULL DEFAULT 0,
  pts_peer_witness INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE verification_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read verification scores" ON verification_scores FOR SELECT USING (true);

-- 6. notification_logs
CREATE TABLE IF NOT EXISTS notification_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES user_profiles(profile_id),
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'venue_daily_card', 'group_card_posted',
    'notable_fish_personal_best', 'notable_fish_top25', 'notable_fish_top10',
    'notable_fish_venue_season_record', 'notable_fish_venue_alltime_record',
    'notable_fish_platform_record', 'group_invite', 'welcome_back'
  )),
  reference_id TEXT,
  push_sent BOOLEAN NOT NULL DEFAULT false,
  push_sent_at TIMESTAMPTZ, push_success BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notification logs" ON notification_logs FOR SELECT USING (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE INDEX idx_notification_logs_profile ON notification_logs(profile_id, created_at DESC);

-- 7. Storage policies for notable-fish bucket (bucket created via tool)
CREATE POLICY "Users can upload own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'notable-fish'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
      SELECT profile_id::text FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view notable fish photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'notable-fish'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'notable-fish'
    AND (storage.foldername(name))[1] = (
      SELECT profile_id::text FROM user_profiles WHERE id = auth.uid()
    )
  );
