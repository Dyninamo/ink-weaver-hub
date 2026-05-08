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

const VENUE_TYPES: Record<string, "stillwater" | "river"> = {
  "Grafham Water": "stillwater",
  "Pitsford Water": "stillwater",
  "Rutland Water": "stillwater",
  "Ravensthorpe Reservoir": "stillwater",
  "Draycote Water": "stillwater",
};

const FISHING_TYPES = ["Bank", "Boat", "Both"] as const;

export default function DiaryNew() {
  const { user } = useAuth();
  const { refresh: refreshActiveSession } = useActiveSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [venue, setVenue] = useState("");
  const [venueType, setVenueType] = useState<"stillwater" | "river">("stillwater");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [arrivalTime, setArrivalTime] = useState("");
  const [fishingType, setFishingType] = useState<string>("Bank");
  const [venues, setVenues] = useState<string[]>([]);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    async function loadVenues() {
      const { data } = await supabase.from("reports_enriched").select("venue").order("venue");
      if (data) setVenues([...new Set(data.map((r: any) => r.venue))]);
    }
    loadVenues();
  }, []);

  useEffect(() => {
    const v = searchParams.get("venue");
    if (v) setVenue(v);
  }, [searchParams]);

  useEffect(() => {
    if (venue && VENUE_TYPES[venue]) setVenueType(VENUE_TYPES[venue]);
  }, [venue]);

  // venueType (set above from the VENUE_TYPES map) is the canonical PWA water-type.
  // venues_new exposes water_type_id (FK), not a string column, so we don't query it here —
  // venueType is already the right "stillwater" | "river" value for the preset filter.
  const venueWaterType = venueType;

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
            venueWaterType={venueWaterType}
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
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1.5"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          >
            <option value="">Select venue…</option>
            {venues.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

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
