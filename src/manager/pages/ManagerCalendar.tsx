import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVenueBySlug } from "@/manager/hooks/useVenueBySlug";
import ManagerLayout from "@/manager/ManagerLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { speciesColorVar, speciesLabel } from "@/manager/utils/slug";

interface Event {
  id: string;
  date_stocked: string;
  species: string;
  quantity: number;
  avg_weight_lb: number;
}

export default function ManagerCalendar() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { venue, isLoading, notFound, scope } = useVenueBySlug(slug);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (!venue) return;
    (async () => {
      setLoadingEvents(true);
      const from = format(startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const to = format(endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const { data } = await supabase
        .from("stocking_events")
        .select("id, date_stocked, species, quantity, avg_weight_lb")
        .eq("venue_id", venue.venue_id)
        .gte("date_stocked", from)
        .lte("date_stocked", to);
      setEvents((data ?? []) as Event[]);
      setLoadingEvents(false);
    })();
  }, [venue, cursor]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [cursor]);

  if (isLoading) {
    return (
      <ManagerLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      </ManagerLayout>
    );
  }

  if (notFound || !venue) {
    return (
      <ManagerLayout>
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Venue not found.</p>
        </Card>
      </ManagerLayout>
    );
  }

  const canWrite = scope.grantsByVenue[venue.venue_id]?.scope_type === "venue";

  return (
    <ManagerLayout currentVenue={venue}>
      <nav className="text-xs text-muted-foreground mb-3">
        <Link to="/manager" className="hover:text-foreground">Manager</Link>
        <span className="mx-1.5">»</span>
        <Link to={`/manager/${slug}`} className="hover:text-foreground">{venue.name}</Link>
        <span className="mx-1.5">»</span>
        <span className="text-foreground">Calendar</span>
      </nav>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, -1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold tracking-tight px-3 min-w-[160px] text-center">
              {format(cursor, "MMMM yyyy")}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Today
          </Button>
        </div>

        <div className="grid grid-cols-7 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-2 py-1">{d}</div>
          ))}
        </div>

        {loadingEvents ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-7 border-t border-l border-border rounded-md overflow-hidden">
            {days.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayEvents = events.filter((e) => e.date_stocked === dayKey);
              const inMonth = isSameMonth(day, cursor);
              const today = isSameDay(day, new Date());
              return (
                <div
                  key={dayKey}
                  className={`min-h-[64px] sm:min-h-[80px] border-r border-b border-border p-1.5 text-xs flex flex-col gap-1 ${
                    inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground"
                  } ${dayEvents.length ? "bg-[hsl(75_25%_94%)]" : ""}`}
                >
                  <div className={`text-[11px] ${today ? "font-bold text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                  {dayEvents.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => canWrite && navigate(`/manager/${slug}/stock/${e.id}`)}
                      className="text-left text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded text-white truncate"
                      style={{ backgroundColor: speciesColorVar(e.species) }}
                      title={`${speciesLabel(e.species)} ${e.quantity} @ ${Number(e.avg_weight_lb).toFixed(1)}lb`}
                    >
                      {speciesLabel(e.species)} {e.quantity} @ {Number(e.avg_weight_lb).toFixed(1)}lb
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </ManagerLayout>
  );
}
