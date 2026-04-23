import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns whether the current user has an active fishing session.
 * Re-checks on auth-state changes. Pages that toggle is_active can call
 * the returned `refresh` callback to force a re-check.
 */
export function useActiveSession(): { active: boolean; refresh: () => void } {
  const { user } = useAuth();
  const [active, setActive] = useState(false);

  const check = useCallback(async (uid?: string) => {
    const id = uid ?? user?.id;
    if (!id) {
      setActive(false);
      return;
    }
    const { data } = await supabase
      .from("fishing_sessions")
      .select("id")
      .eq("user_id", id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    setActive(!!data);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setActive(false);
      return;
    }
    void check(user.id).catch(() => {
      if (!cancelled) setActive(false);
    });
    const sub = supabase.auth.onAuthStateChange(() => {
      if (!cancelled) void check();
    });
    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, [user, check]);

  return { active, refresh: () => void check() };
}
