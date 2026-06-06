REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_end_stale_diary_sessions(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clear_table(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_notable_fish_witnesses(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_profile_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_group_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_managed_venue_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_writable_venue_ids() FROM anon;
-- Intentionally NOT revoked: public.increment_share_view(text) — anonymous share-view counter.