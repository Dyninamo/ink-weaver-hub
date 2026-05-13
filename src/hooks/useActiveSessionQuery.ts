import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the currently-active diary session for a user, or null.
 * Deduped across components and cached for 30s.
 */
export function useActiveSessionQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['active-session', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('fishing_sessions')
        .select('id, venue_name, venue_type, session_date, start_time, created_at, is_active, source')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('source', 'diary')
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
}
