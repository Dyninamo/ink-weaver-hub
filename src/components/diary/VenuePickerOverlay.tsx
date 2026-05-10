// VenuePickerOverlay — mid-session venue switch (prompt 149 §6).
// Mirrors the AskGhillieOverlay phase pattern: full-page body mounted by
// ActiveSessionShell with the EndPill still visible at z-60.
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logEvent } from "@/services/eventLogger";

interface VenueOption {
  name: string;
  waterType: "stillwater" | "river" | null;
}

function classifyWaterType(raw: string | null | undefined): "stillwater" | "river" | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.includes("river")) return "river";
  if (v.includes("stillwater") || v.includes("reservoir") || v.includes("loch") || v.includes("lough")) {
    return "stillwater";
  }
  return null;
}

interface Props {
  sessionId: string;
  currentVenueName: string;
  onClose: () => void;
  onSwitched: (newVenueName: string, newVenueType: "stillwater" | "river" | null) => void;
}

export default function VenuePickerOverlay({
  sessionId, currentVenueName, onClose, onSwitched,
}: Props) {
  const [search, setSearch] = useState("");
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("venues_new")
        .select("name, water_types(water_type)")
        .eq("is_active", true)
        .eq("is_searchable", true)
        .order("name")
        .limit(2000);
      if (cancelled) return;
      const list: VenueOption[] = (data ?? []).map((v: any) => ({
        name: v.name,
        waterType: classifyWaterType(v.water_types?.water_type),
      }));
      setVenues([{ name: "Home", waterType: null }, ...list]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredVenues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return venues.slice(0, 200);
    return venues.filter((v) => v.name.toLowerCase().includes(q)).slice(0, 200);
  }, [venues, search]);

  async function handlePick(venue: VenueOption) {
    if (picking) return;
    if (venue.name === currentVenueName) return;
    setPicking(true);
    try {
      const { error } = await supabase
        .from("fishing_sessions")
        .update({
          venue_name: venue.name,
          ...(venue.waterType ? { venue_type: venue.waterType } : {}),
        })
        .eq("id", sessionId);
      if (error) throw error;

      // Emit a Change event so the journal reflects the switch.
      const nowIso = new Date().toISOString();
      await supabase.from("session_events").insert({
        session_id: sessionId,
        event_type: "change",
        event_time: nowIso,
        change_from: { venue: currentVenueName } as any,
        change_to: { venue: venue.name } as any,
        change_reason: "mid-session venue switch",
      } as any);

      logEvent("venue.switched", {
        session_id: sessionId,
        from: currentVenueName,
        to: venue.name,
      }, sessionId);

      toast.success(`Switched to ${venue.name}`);
      onSwitched(venue.name, venue.waterType);
    } catch (err: any) {
      console.error("venue switch failed", err);
      toast.error(err?.message || "Couldn't switch venue");
    } finally {
      setPicking(false);
    }
  }

  return (
    <div className="max-w-[440px] mx-auto p-4 space-y-4 pb-32">
      <div className="flex items-center gap-3">
        <button onClick={onClose} aria-label="Close" className="p-2 -ml-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold font-diary">Switch venue</h2>
      </div>

      <Input
        placeholder="Filter venues…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />

      {loading && (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading venues…</p>
      )}

      {!loading && (
        <ul className="space-y-1">
          {filteredVenues.map((v) => {
            const isCurrent = v.name === currentVenueName;
            return (
              <li key={v.name}>
                <button
                  type="button"
                  onClick={() => handlePick(v)}
                  className="w-full text-left rounded-md border px-3 py-2 hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isCurrent || picking}
                >
                  <div className="text-sm font-medium">
                    {v.name}
                    {isCurrent && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">current</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{v.waterType ?? "—"}</div>
                </button>
              </li>
            );
          })}
          {filteredVenues.length === 0 && (
            <li className="text-sm text-muted-foreground py-6 text-center">No venues match.</li>
          )}
        </ul>
      )}
    </div>
  );
}
