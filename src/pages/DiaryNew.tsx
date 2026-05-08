import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveSession } from "@/contexts/ActiveSessionContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { createSession } from "@/services/diaryService";
import SetupWizard, { type WizardCommit } from "@/components/diary/setup/SetupWizard";
import { positionsForFlyCount } from "@/components/diary/setup/vocabulary";

/**
 * Map descriptive water_types.water_type values onto the PWA's binary
 * stillwater | river vocabulary used by SavedRigsBanner / wizard defaults.
 *
 * NOTE (prompt 141a discovery): the prompt assumed water_types.water_type
 * was literally 'stillwater' | 'river'. It isn't — values are descriptive
 * (e.g. 'River - Chalkstream', 'Small Stillwater', 'Large Reservoir',
 * 'Loch/Lough', 'Both - Stillwater', 'Universal'). We classify here.
 */
function classifyWaterType(raw: string | null | undefined): "stillwater" | "river" | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.includes("river")) return "river"; // includes "Both - River"
  if (v.includes("stillwater") || v.includes("reservoir") || v.includes("loch") || v.includes("lough")) {
    return "stillwater";
  }
  return null; // 'Universal' or anything unknown
}

interface VenueOption {
  name: string;
  waterType: "stillwater" | "river" | null;
}

const FISHING_TYPES = ["Bank", "Boat", "Both"] as const;

export default function DiaryNew() {
  const { user } = useAuth();
  const { refresh: refreshActiveSession } = useActiveSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [venue, setVenue] = useState("");
  const [venueType, setVenueType] = useState<"stillwater" | "river">("stillwater");
  const HOME_OPTION: VenueOption = { name: "Home", waterType: null };
  const [venueTypeResolved, setVenueTypeResolved] = useState(false);
  const [venueTypeManual, setVenueTypeManual] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [arrivalTime, setArrivalTime] = useState("");
  const [fishingType, setFishingType] = useState<string>("Bank");
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [venueFilter, setVenueFilter] = useState("");
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    async function loadVenues() {
      const { data } = await supabase
        .from("venues_new")
        .select("name, water_types(water_type)")
        .eq("is_active", true)
        .eq("is_searchable", true)
        .order("name")
        .limit(2000);
      if (!data) return;
      const realVenues: VenueOption[] = data.map((v: any) => ({
        name: v.name,
        waterType: classifyWaterType(v.water_types?.water_type),
      }));
      setVenues([HOME_OPTION, ...realVenues]);
    }
    loadVenues();
  }, []);

  useEffect(() => {
    const v = searchParams.get("venue");
    if (v) setVenue(v);
  }, [searchParams]);

  // When venue changes, resolve water type. Prefer in-memory match (no round-trip);
  // fall back to a DB lookup for venues set via ?venue= querystring or fuzzy hits.
  useEffect(() => {
    if (!venue) return;
    if (venueTypeManual) return; // user override wins
    if (venue === "Home") {
      setVenueTypeResolved(false); // forces user to pick via the toggle
      return;
    }
    const inMemory = venues.find((v) => v.name === venue);
    if (inMemory) {
      if (inMemory.waterType) {
        setVenueType(inMemory.waterType);
        setVenueTypeResolved(true);
      } else {
        setVenueTypeResolved(false);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("venues_new")
        .select("water_types(water_type)")
        .ilike("name", venue)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const wt = classifyWaterType((data as any)?.water_types?.water_type);
      if (wt) {
        setVenueType(wt);
        setVenueTypeResolved(true);
      } else {
        setVenueTypeResolved(false);
      }
    })();
    return () => { cancelled = true; };
  }, [venue, venues, venueTypeManual]);

  const venueWaterType = venueType;

  const realVenues = venues.filter((v) => v.name !== "Home");
  const filteredRealVenues = venueFilter.trim()
    ? realVenues.filter((v) => v.name.toLowerCase().includes(venueFilter.toLowerCase()))
    : realVenues;

  const canBuildRig = !!venue.trim() && (venue !== "Home" || venueTypeManual);

  async function handleCommit(commit: WizardCommit) {
    if (!user) {
      toast.error("Please sign in again");
      navigate("/auth");
      return;
    }

    let startTime: string | null = null;
    if (arrivalTime) startTime = new Date(`${sessionDate}T${arrivalTime}:00`).toISOString();

    const { rod } = commit;
    let createdSessionId: string | null = null;
    let createdRodId: string | null = null;

    try {
      // ---- 8a. fishing_sessions ----
      const session = await createSession({
        user_id: user.id,
        source: "diary",
        venue_name: venue,
        venue_type: venueType,
        session_date: sessionDate,
        start_time: startTime,
        fishing_type: fishingType,
        plan: commit.plan,
        rods: 1,
        keep_limit: commit.keepLimit,
        rod_weight: rod.rodWeight,
        rod_length_ft: rod.rodLengthFt,
        line_profile: rod.lineProfile,
        leader_id: rod.leaderId,
        leader_material: rod.leaderMaterial,
        leader_length_ft: rod.leaderLengthFt,
        leader_strength_lb: rod.leaderStrengthLb,
        spot_name: commit.spotName,
        is_active: true,
        // NOTE: fishing_style intentionally NOT written to fishing_sessions
        // (column doesn't exist; style lives on session_rods.style only — see prompt 141 decisions §1)
      } as any);
      createdSessionId = session.id;

      // ---- 8b. session_rods ----
      const validFlies = Object.fromEntries(
        positionsForFlyCount(rod.flyCount)
          .map((pos) => [pos, rod.flies[pos]])
          .filter(([, v]) => !!(v as any)?.name)
      );
      const { data: rodRow, error: rodErr } = await supabase
        .from("session_rods" as any)
        .insert({
          session_id: session.id,
          rod_index: 0,
          name: "Rod 1",
          rod_weight: rod.rodWeight,
          rod_length_ft: rod.rodLengthFt,
          line_profile: rod.lineProfile,
          line_name: rod.lineProfile,
          leader_id: rod.leaderId,
          style: rod.style,
          dropper_count: Math.max(0, rod.flyCount - 1),
          flies_on_cast: validFlies,
          started_at: new Date().toISOString(),
          is_active: true,
        })
        .select("id")
        .single();
      if (rodErr) throw rodErr;
      createdRodId = (rodRow as any)?.id ?? null;

      // ---- 8c. user_presets (optional) ----
      if (commit.savePreset) {
        const presetId = crypto.randomUUID();
        const rodBlob = {
          id: presetId,
          name: commit.savePreset.name,
          rodWeight: rod.rodWeight,
          rodLength: rod.rodLengthFt ? `${rod.rodLengthFt}ft` : null,
          line: rod.lineProfile,
          leaderId: rod.leaderId,
          leaderMaterial: rod.leaderMaterial,
          leaderLength: rod.leaderLengthFt ? `${rod.leaderLengthFt}ft` : null,
          leaderStrengthLb: rod.leaderStrengthLb,
          style: rod.style,
          retrieve: null,
          depth: null,
          flyCount: rod.flyCount,
          flies: commit.savePreset.includeFlies ? validFlies : {},
        };
        const { error: presetErr } = await supabase.from("user_presets").insert({
          id: presetId,
          user_id: user.id,
          name: commit.savePreset.name,
          rod: rodBlob as any,
          water_type: venueWaterType,
          include_flies: commit.savePreset.includeFlies,
        });
        if (presetErr) throw presetErr;
      }

      // Resolve venue_id (non-critical)
      const { data: matchedVenue } = await supabase
        .from("venues_new")
        .select("venue_id, contact_email")
        .ilike("name", venue)
        .limit(1)
        .maybeSingle();
      if (matchedVenue?.venue_id) {
        supabase.functions.invoke("on-session-logged", {
          body: { user_id: user.id, venue_id: matchedVenue.venue_id, session_date: sessionDate },
        }).catch(() => {});
        if (!matchedVenue.contact_email) {
          supabase.functions.invoke("find-venue-email", {
            body: { venue_id: matchedVenue.venue_id, session_id: session.id },
          }).catch(() => {});
        }
      }

      toast.success("Session started!");
      refreshActiveSession();
      navigate(`/diary/${session.id}`);
    } catch (err: any) {
      console.error("Failed to start session:", err);
      // Rollback
      if (createdRodId) {
        await supabase.from("session_rods" as any).delete().eq("id", createdRodId);
      }
      if (createdSessionId) {
        await supabase.from("fishing_sessions").delete().eq("id", createdSessionId);
      }
      toast.error(err.message || "Failed to start session");
      throw err;
    }
  }

  // --- Wizard view ---
  if (showWizard && user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-[420px] mx-auto p-4">
          <SetupWizard
            userId={user.id}
            venueName={venue}
            venueWaterType={venue === "Home" && !venueTypeManual ? null : venueWaterType}
            onCancel={() => setShowWizard(false)}
            onComplete={handleCommit}
          />
        </div>
      </div>
    );
  }

  // --- Session basics view ---
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[420px] mx-auto p-4 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/diary")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold font-diary">Session basics</h1>
        </div>

        <div>
          <Label>Venue *</Label>
          <Input
            type="text"
            placeholder="Filter venues…"
            value={venueFilter}
            onChange={(e) => setVenueFilter(e.target.value)}
            className="mt-1.5"
          />
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
            value={venue}
            onChange={(e) => {
              setVenue(e.target.value);
              setVenueTypeManual(false); // new venue → re-enable auto-detect
            }}
          >
            <option value="">Select venue…</option>
            {filteredVenues.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        </div>

        {venue && (
          <div>
            <Label>Water type</Label>
            <div className={`flex gap-2 mt-1.5 ${!venueTypeResolved && !venueTypeManual ? "ring-1 ring-amber-500/50 rounded-md p-1" : ""}`}>
              {(["stillwater", "river"] as const).map((wt) => (
                <Button
                  key={wt}
                  variant={venueType === wt ? "default" : "outline"}
                  size="sm"
                  className="flex-1 min-h-[44px] capitalize"
                  onClick={() => {
                    setVenueType(wt);
                    setVenueTypeManual(true);
                  }}
                >
                  {wt}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {venueTypeManual
                ? "Manual override active"
                : venueTypeResolved
                  ? "Auto-detected — tap to override"
                  : "Couldn't detect water type — please choose"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date *</Label>
            <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Arrival</Label>
            <Input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} className="mt-1.5" />
          </div>
        </div>

        <div>
          <Label>Fishing type</Label>
          <div className="flex gap-2 mt-1.5">
            {FISHING_TYPES.map((ft) => (
              <Button
                key={ft}
                variant={fishingType === ft ? "default" : "outline"}
                size="sm"
                className="flex-1 min-h-[44px]"
                onClick={() => setFishingType(ft)}
              >
                {ft}
              </Button>
            ))}
          </div>
        </div>

        <Button
          onClick={() => {
            if (!venue.trim()) {
              toast.error("Pick a venue first");
              return;
            }
            setShowWizard(true);
          }}
          disabled={!venue.trim()}
          className="w-full min-h-[52px] text-base"
        >
          Build your rig <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
