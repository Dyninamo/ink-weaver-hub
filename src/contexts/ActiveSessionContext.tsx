import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ActiveSessionContextValue {
  active: boolean;
  refresh: () => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue>({
  active: false,
  refresh: () => { /* noop when outside provider */ },
});

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
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

  return (
    <ActiveSessionContext.Provider value={{ active, refresh: () => void check() }}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession() {
  return useContext(ActiveSessionContext);
}
