import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/manager/hooks/useManagerScope";
import ManagerLayout from "@/manager/ManagerLayout";
import { slugify } from "@/manager/utils/slug";
import { Card } from "@/components/ui/card";

interface VenueStats {
  ytdQty: number;
  ytdAvgWeight: number | null;
  lastDate: string | null;
  lastQty: number | null;
}

export default function ManagerHome() {
  const navigate = useNavigate();
  const scope = useManagerScope();
  const [stats, setStats] = useState<Record<string, VenueStats>>({});

  // Redirect single-venue user to their venue page
  useEffect(() => {
    if (scope.isLoading) return;
    if (!scope.venues.length) {
      navigate("/manager/no-access", { replace: true });
      return;
    }
    if (scope.venues.length === 1 && scope.groups.length === 0) {
      navigate(`/manager/${slugify(scope.venues[0].name)}`, { replace: true });
    }
  }, [scope.isLoading, scope.venues, scope.groups, navigate]);

  useEffect(() => {
    if (!scope.venues.length) return;
    const ids = scope.venues.map((v) => v.venue_id);
    const yearStart = `${new Date().getFullYear()}-01-01`;

    (async () => {
      const { data } = await supabase
        .from("stocking_events")
        .select("venue_id, quantity, avg_weight_lb, date_stocked")
        .in("venue_id", ids);

      const next: Record<string, VenueStats> = {};
      for (const id of ids) next[id] = { ytdQty: 0, ytdAvgWeight: null, lastDate: null, lastQty: null };

      for (const row of data ?? []) {
        const s = next[row.venue_id];
        if (!s) continue;
        if (row.date_stocked >= yearStart) {
          const qty = Number(row.quantity || 0);
          const w = Number(row.avg_weight_lb || 0);
          const prevTotalLb = (s.ytdAvgWeight ?? 0) * s.ytdQty;
          s.ytdQty += qty;
          s.ytdAvgWeight = s.ytdQty > 0 ? (prevTotalLb + qty * w) / s.ytdQty : null;
        }
        if (!s.lastDate || row.date_stocked > s.lastDate) {
          s.lastDate = row.date_stocked;
          s.lastQty = Number(row.quantity || 0);
        }
      }
      setStats(next);
    })();
  }, [scope.venues]);

  if (scope.isLoading) {
    return (
      <ManagerLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      </ManagerLayout>
    );
  }

  const groupName = scope.groups[0]?.name ?? "Your venues";
  const role = scope.groups[0]?.role ?? scope.venues[0]?.role ?? "manager";

  return (
    <ManagerLayout>
      <Card className="p-5 mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{groupName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {scope.venues.length} venue{scope.venues.length === 1 ? "" : "s"} · You are: <span className="capitalize">{role}</span>
        </p>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scope.venues.map((v) => {
          const s = stats[v.venue_id];
          const days = s?.lastDate
            ? Math.floor((Date.now() - new Date(s.lastDate).getTime()) / 86400000)
            : null;
          return (
            <Link
              key={v.venue_id}
              to={`/manager/${slugify(v.name)}`}
              className="block rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-foreground">{v.name}</h4>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">
                  Active season
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <div>
                  Last stocked:{" "}
                  <span className="text-foreground">
                    {days !== null ? `${days} day${days === 1 ? "" : "s"} ago — ${s?.lastQty} fish` : "—"}
                  </span>
                </div>
                <div>
                  Stocked YTD: <span className="text-foreground">{s?.ytdQty ?? 0} fish</span>
                </div>
                <div>
                  Avg weight YTD:{" "}
                  <span className="text-foreground">
                    {s?.ytdAvgWeight ? `${s.ytdAvgWeight.toFixed(1)} lb` : "—"}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 border-2 border-dashed border-border rounded-xl p-6 text-sm text-muted-foreground text-center">
        Charts and weekly reports will appear here in Phase 2 once we have a few months of stocking data
        and angler diary entries.
      </div>
    </ManagerLayout>
  );
}
