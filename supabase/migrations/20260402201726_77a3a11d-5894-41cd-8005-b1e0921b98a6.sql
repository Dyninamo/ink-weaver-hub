
DELETE FROM content_reports;
DELETE FROM leaderboard_entries;
DELETE FROM fish_witnesses;
DELETE FROM notable_fish;
DELETE FROM card_reactions;
DELETE FROM card_replies;
DELETE FROM social_cards;
DELETE FROM group_memberships;
DELETE FROM social_groups;
DELETE FROM notification_logs;
DELETE FROM angler_venue_stats;
DELETE FROM user_profiles;

DELETE FROM auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
