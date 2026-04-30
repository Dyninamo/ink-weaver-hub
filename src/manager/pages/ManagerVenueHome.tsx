import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVenueBySlug } from "@/manager/hooks/useVenueBySlug";
import ManagerLayout from "@/manager/ManagerLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { speciesLabel, speciesColorVar, slugify } from "@/manager/utils/slug";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Event {
  id: string;
  date_stocked: string;
  species: string;
  quantity: number;
  avg_weight_lb: number;
  supplier_name: string | null;
  cost_total: number | null;
  cost_estimate: number | null;
}

export default function ManagerVenueHome() {
  const { slug } = useParams();
  const { venue, isLoading, notFound, scope } = useVenueBySlug(slug);
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    if (!venue) return;
    (async () => {
      setLoadingEvents(true);
      const { data } = await supabase
        .from("stocking_events")
        .select("id, date_stocked, species, quantity, avg_weight_lb, supplier_name, cost_total, cost_estimate")
        .eq("venue_id", venue.venue_id)
        .order("date_stocked", { ascending: false });
      setEvents((data ?? []) as Event[]);
      setLoadingEvents(false);
    })();
  }, [venue]);

  if (isLoading) {
    return (
      <ManagerLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      </ManagerLayout>
    );
  }

  if (notFound) {
    return (
      <ManagerLayout>
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Venue not found, or you don't have access to it.
          </p>
          <Button className="mt-4" onClick={() => navigate("/manager")}>Back to dashboard</Button>
        </Card>
      </ManagerLayout>
    );
  }

  if (!venue) return null;

  const yearStart = `${new Date().getFullYear()}-01-01`;
  const ytdEvents = events.filter((e) => e.date_stocked >= yearStart);
  const ytdQty = ytdEvents.reduce((a, e) => a + e.quantity, 0);
  const ytdLb = ytdEvents.reduce((a, e) => a + e.quantity * Number(e.avg_weight_lb || 0), 0);
  const ytdAvgWeight = ytdQty ? ytdLb / ytdQty : null;
  const ytdSpend = ytdEvents.reduce(
    (a, e) => a + Number(e.cost_total ?? e.cost_estimate ?? 0),
    0,
  );
  const lastDate = events[0]?.date_stocked ?? null;
  const daysSince = lastDate
    ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
    : null;

  const groupName = scope.groups[0]?.name;
  const canWrite = scope.grantsByVenue[venue.venue_id]?.scope_type === "venue";

  return (
    <ManagerLayout currentVenue={venue}>
      <nav className="text-xs text-muted-foreground mb-3">
        {groupName ? (
          <>
            <Link to="/manager" className="hover:text-foreground">{groupName}</Link>
            <span className="mx-1.5">»</span>
          </>
        ) : (
          <>
            <Link to="/manager" className="hover:text-foreground">Manager</Link>
            <span className="mx-1.5">»</span>
          </>
        )}
        <span className="text-foreground">{venue.name}</span>
      </nav>

      <Card className="p-5 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{venue.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {[venue.acreage ? `${venue.acreage} acres` : null, venue.county]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
          {canWrite && (
            <Button asChild>
              <Link to={`/manager/${slug}/stock`}>
                <Plus className="w-4 h-4 mr-1" /> Log stocking event
              </Link>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <Kpi label="Fish stocked YTD" value={ytdQty.toLocaleString()} />
          <Kpi label="Avg weight YTD" value={ytdAvgWeight ? `${ytdAvgWeight.toFixed(1)} lb` : "—"} />
          <Kpi label="Stocking spend YTD" value={ytdSpend ? `£${Math.round(ytdSpend).toLocaleString()}` : "—"} />
          <Kpi label="Days since last stock" value={daysSince !== null ? String(daysSince) : "—"} />
        </div>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Recent stocking events</h2>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/manager/${slug}/calendar`}>Calendar view</Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loadingEvents ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No stocking events yet.{canWrite ? " Log your first one." : ""}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Date</th>
                  <th className="text-left font-medium px-3 py-2">Species</th>
                  <th className="text-right font-medium px-3 py-2">Qty</th>
                  <th className="text-right font-medium px-3 py-2">Avg wt</th>
                  <th className="text-left font-medium px-3 py-2">Supplier</th>
                  <th className="text-right font-medium px-3 py-2">Cost</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 10).map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2">{format(new Date(e.date_stocked), "d MMM yyyy")}</td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
                        style={{ backgroundColor: speciesColorVar(e.species) }}
                      >
                        {speciesLabel(e.species)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{e.quantity.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{Number(e.avg_weight_lb).toFixed(1)} lb</td>
                    <td className="px-3 py-2">{e.supplier_name ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {e.cost_total != null
                        ? `£${Math.round(e.cost_total).toLocaleString()}`
                        : e.cost_estimate != null
                        ? <span className="text-muted-foreground">~£{Math.round(e.cost_estimate).toLocaleString()}</span>
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canWrite && (
                        <Link
                          to={`/manager/${slug}/stock/${e.id}`}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 flex gap-2 flex-wrap">
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button variant="outline" disabled>Export season audit (PDF)</Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Phase 2</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button variant="outline" disabled>Download CSV</Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Phase 2</TooltipContent>
        </Tooltip>
      </div>
    </ManagerLayout>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
