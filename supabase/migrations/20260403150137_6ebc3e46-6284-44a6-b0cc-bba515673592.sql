
-- Create share_links table
CREATE TABLE share_links (
  link_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL CHECK (type IN ('session', 'group_invite')),
  profile_id UUID REFERENCES user_profiles(profile_id),
  session_id TEXT,
  group_id   UUID REFERENCES social_groups(group_id),
  card_snapshot JSONB NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_links_token ON share_links(token);
CREATE INDEX idx_share_links_profile ON share_links(profile_id);

-- RLS
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_links_public_read"
  ON share_links FOR SELECT
  USING (true);

CREATE POLICY "share_links_auth_insert"
  ON share_links FOR INSERT
  WITH CHECK (
    profile_id = (
      SELECT profile_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- increment_share_view RPC
CREATE OR REPLACE FUNCTION increment_share_view(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE share_links
  SET view_count = view_count + 1
  WHERE token = p_token;
END;
$$;
