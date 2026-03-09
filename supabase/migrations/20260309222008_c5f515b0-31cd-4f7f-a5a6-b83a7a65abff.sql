
-- Step 1: Create helper functions (SECURITY DEFINER bypasses RLS)

CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profile_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_group_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gm.group_id
  FROM group_memberships gm
  WHERE gm.profile_id = (SELECT profile_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND gm.status = 'active';
$$;

CREATE OR REPLACE FUNCTION is_group_admin(target_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = target_group_id
      AND gm.profile_id = (SELECT profile_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
      AND gm.role = 'admin'
      AND gm.status = 'active'
  );
$$;

-- Step 2: Drop all broken policies

DROP POLICY IF EXISTS "Group members can read their groups" ON social_groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON social_groups;
DROP POLICY IF EXISTS "Group creator can update" ON social_groups;

DROP POLICY IF EXISTS "Members can read own group memberships" ON group_memberships;
DROP POLICY IF EXISTS "Group admins can insert memberships" ON group_memberships;
DROP POLICY IF EXISTS "Group admins can update memberships" ON group_memberships;

DROP POLICY IF EXISTS "Group members can read cards" ON social_cards;
DROP POLICY IF EXISTS "Users can insert own cards" ON social_cards;
DROP POLICY IF EXISTS "Users can update own cards" ON social_cards;

DROP POLICY IF EXISTS "Group members can read replies" ON card_replies;
DROP POLICY IF EXISTS "Users can insert replies to visible cards" ON card_replies;
DROP POLICY IF EXISTS "Users can update own replies" ON card_replies;

-- Step 3: Recreate policies using helper functions

-- social_groups
CREATE POLICY "Group members can read their groups"
  ON social_groups FOR SELECT
  USING ( group_id IN (SELECT get_my_group_ids()) );

CREATE POLICY "Authenticated users can create groups"
  ON social_groups FOR INSERT
  WITH CHECK ( created_by_profile_id = get_my_profile_id() );

CREATE POLICY "Group creator can update"
  ON social_groups FOR UPDATE
  USING ( created_by_profile_id = get_my_profile_id() );

-- group_memberships
CREATE POLICY "Members can read own group memberships"
  ON group_memberships FOR SELECT
  USING (
    profile_id = get_my_profile_id()
    OR group_id IN (SELECT get_my_group_ids())
  );

CREATE POLICY "Group admins can insert memberships"
  ON group_memberships FOR INSERT
  WITH CHECK ( is_group_admin(group_id) );

CREATE POLICY "Group admins can update memberships"
  ON group_memberships FOR UPDATE
  USING ( is_group_admin(group_id) );

-- social_cards
CREATE POLICY "Group members can read cards"
  ON social_cards FOR SELECT
  USING ( group_id IN (SELECT get_my_group_ids()) );

CREATE POLICY "Users can insert own cards"
  ON social_cards FOR INSERT
  WITH CHECK ( profile_id = get_my_profile_id() );

CREATE POLICY "Users can update own cards"
  ON social_cards FOR UPDATE
  USING ( profile_id = get_my_profile_id() );

-- card_replies
CREATE POLICY "Group members can read replies"
  ON card_replies FOR SELECT
  USING (
    card_id IN (
      SELECT sc.card_id FROM social_cards sc
      WHERE sc.group_id IN (SELECT get_my_group_ids())
    )
  );

CREATE POLICY "Users can insert replies to visible cards"
  ON card_replies FOR INSERT
  WITH CHECK (
    profile_id = get_my_profile_id()
    AND card_id IN (
      SELECT sc.card_id FROM social_cards sc
      WHERE sc.group_id IN (SELECT get_my_group_ids())
    )
  );

CREATE POLICY "Users can update own replies"
  ON card_replies FOR UPDATE
  USING ( profile_id = get_my_profile_id() );
