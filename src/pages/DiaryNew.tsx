import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveSession } from "@/contexts/ActiveSessionContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { createSession, endSession } from "@/services/diaryService";
import SetupWizard, { type WizardCommit } from "@/components/diary/setup/SetupWizard";
import { positionsForFlyCount } from "@/components/diary/setup/vocabulary";
import { logEvent } from "@/services/eventLogger";
import DiaryAutocomplete, { type AutocompleteOption } from "@/components/diary/DiaryAutocomplete";

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

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function getBrowserGps(timeoutMs = 8000): Promise<{ lat: number; lon: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(t);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs - 500, maximumAge: 60_000 }
    );
  });
}

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
  const [arrivalTime, setArrivalTime] = useState(nowHHMM());
  const [venues, setVenues] = useState<VenueOption[]>([]);
  
  const [showWizard, setShowWizard] = useState(false);
  const [pendingActiveConflict, setPendingActiveConflict] = useState<{
    id: string;
    venue_name: string | null;
    start_time: string | null;
    created_at: string;
  } | null>(null);
  const [pendingCommit, setPendingCommit] = useState<WizardCommit | null>(null);

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

  // Log venue selection
  useEffect(() => {
    if (!venue) return;
    logEvent("diary.venue_selected", { venue, isHome: venue === "Home" });
  }, [venue]);

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

  const venueOptions: AutocompleteOption[] = [
    {
      value: "Home",
      label: "Home (practice / no real venue)",
      category: "Practice",
      pinned: true, // always visible regardless of search query (prompt 144)
    },
    ...realVenues.map((v) => ({
      value: v.name,
      label: v.name,
      category: "Venues",
      meta: v.waterType ?? undefined,
    })),
  ];

  const canBuildRig = !!venue.trim() && (venue !== "Home" || venueTypeManual);

  async function handleCommit(commit: WizardCommit) {
    if (!user) {
      toast.error("Please sign in again");
      navigate("/auth");
      return;
    }

    // Preflight: refuse to start a new session if an active one already exists.
    // (Belt + braces — DB also enforces via uniq_user_active_diary_session.)
    const { data: existingActive } = await supabase
      .from("fishing_sessions")
      .select("id, venue_name, start_time, created_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("source", "diary")
      .limit(1)
      .maybeSingle();

    if (existingActive) {
      setPendingCommit(commit);
      setPendingActiveConflict(existingActive as any);
      return;
    }

    await proceedWithCreate(commit);
  }

  async function proceedWithCreate(commit: WizardCommit) {
    if (!user) return;

    // Best-effort GPS capture. Browser prompt fires on first call.
    const gps = await getBrowserGps();
    logEvent("diary.gps_capture", { granted: !!gps });

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
        gps_start_lat: gps?.lat ?? null,
        gps_start_lon: gps?.lon ?? null,
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

      logEvent("diary.session_started", {
        session_id: session.id,
        venue,
        venueType,
        has_real_venue_match: !!matchedVenue?.venue_id,
        rod_weight: rod.rodWeight,
        fly_count: rod.flyCount,
        saved_preset: !!commit.savePreset,
      }, session.id);

      toast.success("Session started!");
      refreshActiveSession();
      navigate(`/diary/${session.id}`);
    } catch (err: any) {
      console.error("Failed to start session:", err);
      logEvent("error", { context: "session_start", message: err?.message ?? String(err) }, createdSessionId ?? null);
      // Rollback
      if (createdRodId) {
        await supabase.from("session_rods" as any).delete().eq("id", createdRodId);
      }
      if (createdSessionId) {
        await supabase.from("fishing_sessions").delete().eq("id", createdSessionId);
      }
      // Race: another tab/device started one between preflight and insert.
      if (err?.code === "23505" && String(err?.message ?? "").includes("uniq_user_active_diary_session")) {
        toast.error("Another active session was started elsewhere. Tap 'Resume' on /diary.");
        navigate("/diary");
        return;
      }
      toast.error(err.message || "Failed to start session");
      throw err;
    }
  }

  const conflictModal = pendingActiveConflict ? (
    <AlertDialog open onOpenChange={(o) => { if (!o) { setPendingActiveConflict(null); setPendingCommit(null); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>You already have an active session</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingActiveConflict.venue_name ?? "Untitled"} — started{" "}
            {formatDistanceToNow(
              new Date(pendingActiveConflict.start_time ?? pendingActiveConflict.created_at),
              { addSuffix: true }
            )}.
            Finish that one first, or resume it to keep logging.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => { setPendingActiveConflict(null); setPendingCommit(null); }}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const id = pendingActiveConflict.id;
              setPendingActiveConflict(null);
              setPendingCommit(null);
              navigate(`/diary/${id}`);
            }}
          >
            Resume existing
          </Button>
          <Button
            onClick={async () => {
              const conflict = pendingActiveConflict;
              const commit = pendingCommit;
              setPendingActiveConflict(null);
              setPendingCommit(null);
              try {
                await endSession(conflict.id, {});
                refreshActiveSession();
              } catch (e: any) {
                toast.error(e?.message || "Failed to end existing session");
                return;
              }
              if (commit) {
                await proceedWithCreate(commit);
              } else {
                toast.info("Previous session ended. Tap Build your rig to start a new one.");
              }
            }}
          >
            End existing &amp; start new
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

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
        {conflictModal}
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

        <DiaryAutocomplete
          label="Venue"
          value={venue || null}
          options={venueOptions}
          onChange={(v) => {
            setVenue(v);
            setVenueTypeManual(false);
          }}
          placeholder="Search venues or pick Home…"
          required
          showAllLabel="Show all venues"
        />

        {venue && (
          <div>
            <Label>Water type</Label>
            <div className={`flex gap-2 mt-1.5 ${!venueTypeResolved && !venueTypeManual ? "ring-1 ring-amber-500/50 rounded-md p-1" : ""}`}>
              {(["stillwater", "river"] as const).map((wt) => {
                const isChosen = (venueTypeResolved || venueTypeManual) && venueType === wt;
                return (
                <Button
                  key={wt}
                  variant={isChosen ? "default" : "outline"}
                  size="sm"
                  className="flex-1 min-h-[44px] capitalize"
                  onClick={() => {
                    setVenueType(wt);
                    setVenueTypeManual(true);
                    logEvent("diary.water_type_override", { venue, water_type: wt, was_resolved: venueTypeResolved });
                  }}
                >
                  {wt}
                </Button>
                );
              })}
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



        <Button
          onClick={() => {
            if (!canBuildRig) {
              toast.error(
                venue === "Home"
                  ? "Pick Stillwater or River for your home session"
                  : "Pick a venue first"
              );
              return;
            }
            logEvent("diary.build_rig_clicked", { venue, venueType, sessionDate });
            setShowWizard(true);
          }}
          disabled={!canBuildRig}
          className="w-full min-h-[52px] text-base"
        >
          Build your rig <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
      {conflictModal}
    </div>
  );
}
