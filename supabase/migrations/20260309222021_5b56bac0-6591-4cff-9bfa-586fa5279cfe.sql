
-- user_profiles: only authenticated users can read
DROP POLICY IF EXISTS "Users can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can read profiles" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_profiles;

CREATE POLICY "Authenticated users can read profiles"
  ON user_profiles FOR SELECT
  USING ( auth.role() = 'authenticated' );

-- notable_fish: only authenticated users can read
DROP POLICY IF EXISTS "Anyone can read notable fish" ON notable_fish;
DROP POLICY IF EXISTS "Enable read access for all users" ON notable_fish;

CREATE POLICY "Authenticated users can read notable fish"
  ON notable_fish FOR SELECT
  USING ( auth.role() = 'authenticated' );
