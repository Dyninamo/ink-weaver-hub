REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_end_stale_diary_sessions(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_table(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_notable_fish_witnesses(uuid) FROM authenticated;
-- Intentionally NOT revoked (still callable by authenticated):
--   public.get_my_profile_id(), public.get_my_group_ids(), public.is_group_admin(uuid),
--   public.current_user_managed_venue_ids(), public.current_user_writable_venue_ids()
--   — used inside RLS policies, evaluated in caller's role.
--   public.increment_share_view(text) — public share counter.