import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ManagerVenue {
  venue_id: string;
  name: string;
  full_name: string;
  county: string | null;
  acreage: number | null;
  group_id: string | null;
  // role inferred for this venue (from the highest-tier grant covering it)
  role: string;
  scope_type: "venue" | "group";
}

export interface ManagerGroup {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface ManagerScope {
  isLoading: boolean;
  error: string | null;
  groups: ManagerGroup[];
  venues: ManagerVenue[];
  // grants keyed by venue_id → role + scope (for write access checks)
  grantsByVenue: Record<string, { role: string; scope_type: "venue" | "group"; manager_id: string }>;
  reload: () => void;
}

export function useManagerScope(): ManagerScope {
  const { user, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<Omit<ManagerScope, "reload">>({
    isLoading: true,
    error: null,
    groups: [],
    venues: [],
    grantsByVenue: {},
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ isLoading: false, error: null, groups: [], venues: [], grantsByVenue: {} });
      return;
    }
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      const { data: grants, error: grantsErr } = await supabase
        .from("fishery_managers")
        .select("id, scope_type, scope_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (cancelled) return;
      if (grantsErr) {
        setState({ isLoading: false, error: grantsErr.message, groups: [], venues: [], grantsByVenue: {} });
        return;
      }

      const venueIds = (grants ?? []).filter((g) => g.scope_type === "venue").map((g) => g.scope_id);
      const groupIds = (grants ?? []).filter((g) => g.scope_type === "group").map((g) => g.scope_id);

      const [venuesDirect, groupsRes, venuesViaGroup] = await Promise.all([
        venueIds.length
          ? supabase
              .from("venues_new")
              .select("venue_id, name, full_name, county, acreage, group_id")
              .in("venue_id", venueIds)
          : Promise.resolve({ data: [], error: null } as any),
        groupIds.length
          ? supabase.from("fishery_groups").select("id, name, slug").in("id", groupIds)
          : Promise.resolve({ data: [], error: null } as any),
        groupIds.length
          ? supabase
              .from("venues_new")
              .select("venue_id, name, full_name, county, acreage, group_id")
              .in("group_id", groupIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (cancelled) return;

      const grantsByVenue: ManagerScope["grantsByVenue"] = {};
      const venuesMap = new Map<string, ManagerVenue>();

      for (const g of grants ?? []) {
        if (g.scope_type === "venue") {
          const v = (venuesDirect.data ?? []).find((x: any) => x.venue_id === g.scope_id);
          if (v) {
            grantsByVenue[v.venue_id] = { role: g.role, scope_type: "venue", manager_id: g.id };
            venuesMap.set(v.venue_id, { ...v, role: g.role, scope_type: "venue" });
          }
        } else if (g.scope_type === "group") {
          for (const v of venuesViaGroup.data ?? []) {
            if (v.group_id === g.scope_id && !venuesMap.has(v.venue_id)) {
              // group-scope is read-only by spec
              grantsByVenue[v.venue_id] = { role: g.role, scope_type: "group", manager_id: g.id };
              venuesMap.set(v.venue_id, { ...v, role: g.role, scope_type: "group" });
            }
          }
        }
      }

      const groups: ManagerGroup[] = (groupsRes.data ?? []).map((gr: any) => {
        const grant = (grants ?? []).find((g) => g.scope_type === "group" && g.scope_id === gr.id);
        return { id: gr.id, name: gr.name, slug: gr.slug, role: grant?.role ?? "viewer" };
      });

      setState({
        isLoading: false,
        error: null,
        groups,
        venues: Array.from(venuesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        grantsByVenue,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}
