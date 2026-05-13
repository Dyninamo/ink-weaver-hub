import { createContext, useContext, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { useActiveSessionQuery } from "@/hooks/useActiveSessionQuery";

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
  const qc = useQueryClient();
  const { data } = useActiveSessionQuery(user?.id);
  const active = !!data;

  return (
    <ActiveSessionContext.Provider
      value={{
        active,
        refresh: () => { void qc.invalidateQueries({ queryKey: ['active-session'] }); },
      }}
    >
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession() {
  return useContext(ActiveSessionContext);
}
