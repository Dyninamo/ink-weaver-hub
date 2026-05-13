import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the user's profile row from user_profiles, cached for 5 minutes.
 */
export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      return data;
    },
  });
}
