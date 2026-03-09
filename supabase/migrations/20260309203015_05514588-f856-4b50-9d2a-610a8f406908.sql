
-- 1. ALTER user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_id UUID UNIQUE DEFAULT gen_random_uuid();
UPDATE user_profiles SET profile_id = gen_random_uuid() WHERE profile_id IS NULL;
ALTER TABLE user_profiles ALTER COLUMN profile_id SET NOT NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS angler_id UUID REFERENCES angler_profiles(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notification_push_token TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notify_venue_card BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notify_group_post BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notify_notable_fish BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notify_platform_record BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can read all profiles" ON user_profiles FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_id ON user_profiles(profile_id);

-- 2. venue_affiliations
CREATE TABLE IF NOT EXISTS venue_affiliations (
  affiliation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES user_profiles(profile_id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL REFERENCES venues_new(venue_id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'opted_out', 'lapsed')),
  is_welcome_back_pending BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_session_at TIMESTAMPTZ, lapsed_at TIMESTAMPTZ, opted_out_at TIMESTAMPTZ,
  UNIQUE (profile_id, venue_id)
);
ALTER TABLE venue_affiliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own affiliations" ON venue_affiliations FOR SELECT USING (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own affiliations" ON venue_affiliations FOR UPDATE USING (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_venue_affiliations_profile ON venue_affiliations(profile_id);
CREATE INDEX IF NOT EXISTS idx_venue_affiliations_venue ON venue_affiliations(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_affiliations_status ON venue_affiliations(status);

-- 3. social_groups
CREATE TABLE IF NOT EXISTS social_groups (
  group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by_profile_id UUID NOT NULL REFERENCES user_profiles(profile_id),
  invite_code TEXT UNIQUE, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE social_groups ENABLE ROW LEVEL SECURITY;

-- 4. group_memberships
CREATE TABLE IF NOT EXISTS group_memberships (
  membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES social_groups(group_id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_profiles(profile_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
  invited_by_profile_id UUID REFERENCES user_profiles(profile_id),
  invited_at TIMESTAMPTZ, joined_at TIMESTAMPTZ, removed_at TIMESTAMPTZ,
  UNIQUE (group_id, profile_id)
);
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read own group memberships" ON group_memberships FOR SELECT USING (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()) OR group_id IN (SELECT gm.group_id FROM group_memberships gm JOIN user_profiles up ON up.profile_id = gm.profile_id WHERE up.id = auth.uid() AND gm.status = 'active'));
CREATE POLICY "Group admins can insert memberships" ON group_memberships FOR INSERT WITH CHECK (group_id IN (SELECT gm.group_id FROM group_memberships gm JOIN user_profiles up ON up.profile_id = gm.profile_id WHERE up.id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'));
CREATE POLICY "Group admins can update memberships" ON group_memberships FOR UPDATE USING (group_id IN (SELECT gm.group_id FROM group_memberships gm JOIN user_profiles up ON up.profile_id = gm.profile_id WHERE up.id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'));
CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_profile ON group_memberships(profile_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_status ON group_memberships(status);

-- social_groups RLS
CREATE POLICY "Group members can read their groups" ON social_groups FOR SELECT USING (group_id IN (SELECT gm.group_id FROM group_memberships gm JOIN user_profiles up ON up.profile_id = gm.profile_id WHERE up.id = auth.uid() AND gm.status = 'active'));
CREATE POLICY "Authenticated users can create groups" ON social_groups FOR INSERT WITH CHECK (created_by_profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "Group creator can update" ON social_groups FOR UPDATE USING (created_by_profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));

-- 5. social_cards (session_id is UUID to match fishing_sessions.id)
CREATE TABLE IF NOT EXISTS social_cards (
  card_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES user_profiles(profile_id) ON DELETE CASCADE,
  session_id UUID REFERENCES fishing_sessions(id),
  group_id UUID REFERENCES social_groups(group_id) ON DELETE CASCADE,
  venue_id TEXT REFERENCES venues_new(venue_id),
  venue_name TEXT NOT NULL, session_date DATE NOT NULL,
  n_fish INTEGER NOT NULL DEFAULT 0, species_breakdown JSONB,
  top_fly_1 TEXT, top_fly_2 TEXT, method TEXT,
  conditions_temp_c REAL, conditions_wind TEXT, conditions_weather TEXT,
  personal_note TEXT, photo_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false, is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE social_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members can read cards" ON social_cards FOR SELECT USING (group_id IN (SELECT gm.group_id FROM group_memberships gm JOIN user_profiles up ON up.profile_id = gm.profile_id WHERE up.id = auth.uid() AND gm.status = 'active'));
CREATE POLICY "Users can insert own cards" ON social_cards FOR INSERT WITH CHECK (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update own cards" ON social_cards FOR UPDATE USING (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_social_cards_group ON social_cards(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_cards_profile ON social_cards(profile_id);
CREATE INDEX IF NOT EXISTS idx_social_cards_session ON social_cards(session_id);

-- 6. card_replies
CREATE TABLE IF NOT EXISTS card_replies (
  reply_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES social_cards(card_id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_profiles(profile_id) ON DELETE CASCADE,
  parent_reply_id UUID REFERENCES card_replies(reply_id),
  body TEXT NOT NULL, is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE card_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members can read replies" ON card_replies FOR SELECT USING (card_id IN (SELECT sc.card_id FROM social_cards sc JOIN group_memberships gm ON gm.group_id = sc.group_id JOIN user_profiles up ON up.profile_id = gm.profile_id WHERE up.id = auth.uid() AND gm.status = 'active'));
CREATE POLICY "Users can insert replies to visible cards" ON card_replies FOR INSERT WITH CHECK (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()) AND card_id IN (SELECT sc.card_id FROM social_cards sc JOIN group_memberships gm ON gm.group_id = sc.group_id JOIN user_profiles up ON up.profile_id = gm.profile_id WHERE up.id = auth.uid() AND gm.status = 'active'));
CREATE POLICY "Users can update own replies" ON card_replies FOR UPDATE USING (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_card_replies_card ON card_replies(card_id, created_at ASC);

-- 7. card_reactions
CREATE TABLE IF NOT EXISTS card_reactions (
  reaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES user_profiles(profile_id) ON DELETE CASCADE,
  card_id UUID REFERENCES social_cards(card_id) ON DELETE CASCADE,
  reply_id UUID REFERENCES card_replies(reply_id) ON DELETE CASCADE,
  emoji TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((card_id IS NOT NULL AND reply_id IS NULL) OR (card_id IS NULL AND reply_id IS NOT NULL)),
  UNIQUE (profile_id, card_id, emoji), UNIQUE (profile_id, reply_id, emoji)
);
ALTER TABLE card_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members can read reactions" ON card_reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert own reactions" ON card_reactions FOR INSERT WITH CHECK (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete own reactions" ON card_reactions FOR DELETE USING (profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_card_reactions_card ON card_reactions(card_id);
CREATE INDEX IF NOT EXISTS idx_card_reactions_reply ON card_reactions(reply_id);

-- 8. venue_daily_cards
CREATE TABLE IF NOT EXISTS venue_daily_cards (
  daily_card_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues_new(venue_id),
  card_date DATE NOT NULL, generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  n_sessions INTEGER NOT NULL DEFAULT 0, rod_average REAL,
  top_fly_1 TEXT, top_fly_2 TEXT, top_fly_3 TEXT, dominant_method TEXT,
  conditions_temp_c REAL, conditions_wind TEXT, conditions_weather TEXT,
  best_fish_species TEXT, best_fish_weight_kg REAL, best_fish_weight_lb REAL,
  best_fish_length_cm REAL, best_fish_length_in REAL,
  narrative TEXT NOT NULL, has_leaderboard_event BOOLEAN NOT NULL DEFAULT false,
  leaderboard_summary TEXT, UNIQUE (venue_id, card_date)
);
ALTER TABLE venue_daily_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliated users can read venue cards" ON venue_daily_cards FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_venue_daily_cards_venue_date ON venue_daily_cards(venue_id, card_date DESC);

-- 9. user_blocks
CREATE TABLE IF NOT EXISTS user_blocks (
  block_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_profile_id UUID NOT NULL REFERENCES user_profiles(profile_id) ON DELETE CASCADE,
  blocked_profile_id UUID NOT NULL REFERENCES user_profiles(profile_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (blocker_profile_id, blocked_profile_id)
);
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own blocks" ON user_blocks FOR ALL USING (blocker_profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_profile_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_profile_id);

-- 10. content_reports
CREATE TABLE IF NOT EXISTS content_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_profile_id UUID NOT NULL REFERENCES user_profiles(profile_id),
  content_type TEXT NOT NULL CHECK (content_type IN ('social_card', 'card_reply', 'notable_fish')),
  content_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'misinformation')),
  notes TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert reports" ON content_reports FOR INSERT WITH CHECK (reporter_profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "Users can read own reports" ON content_reports FOR SELECT USING (reporter_profile_id IN (SELECT profile_id FROM user_profiles WHERE id = auth.uid()) OR auth.jwt() ->> 'email' = 'nick.dyne@gmail.com');
CREATE POLICY "Admin can update reports" ON content_reports FOR UPDATE USING (auth.jwt() ->> 'email' = 'nick.dyne@gmail.com');
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON content_reports(reporter_profile_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
