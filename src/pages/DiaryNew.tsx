import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Play, Bookmark, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import SetupCascade from "@/components/diary/SetupCascade";
import FlyPicker from "@/components/diary/FlyPicker";
import SpotPicker from "@/components/diary/SpotPicker";
import {
  createSession,
  addEvent,
  type CurrentSetup,
  type RodSetup,
  DEFAULT_SPECIES,
  SPECIES_LIST,
  formatWeight,
} from "@/services/diaryService";

type Phase = "header" | "setup";

const VENUE_TYPES: Record<string, "stillwater" | "river"> = {
  "Grafham Water": "stillwater",
  "Pitsford Water": "stillwater",
  "Rutland Water": "stillwater",
  "Ravensthorpe Reservoir": "stillwater",
  "Draycote Water": "stillwater",
};

const FISHING_TYPES = ["Bank", "Boat", "Both"] as const;
const WEATHER_CONDITIONS = [
  "Sunny", "Partly Cloudy", "Overcast", "Light Rain",
  "Heavy Rain", "Drizzle", "Fog/Mist", "Hail", "Snow",
] as const;
const WIND_DIRECTIONS = [
  "N", "NE", "E", "SE", "S", "SW", "W", "NW", "Variable", "Calm",
] as const;

const EMPTY_SETUP: CurrentSetup = {
  style: null,
  rig: null,
  line_type: null,
  retrieve: null,
  flies_on_cast: null,
  spot: null,
  depth_zone: null,
};

export default function DiaryNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("header");
  const [saving, setSaving] = useState(false);

  // --- Session Header fields ---
  const [venue, setVenue] = useState("");
  const [venueType, setVenueType] = useState<"stillwater" | "river">("stillwater");
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [arrivalTime, setArrivalTime] = useState("");
  const [fishingType, setFishingType] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [rods, setRods] = useState(1);

  // Weather
  const [weatherTemp, setWeatherTemp] = useState<string>("");
  const [weatherWindSpeed, setWeatherWindSpeed] = useState<string>("");
  const [weatherWindDir, setWeatherWindDir] = useState<string>("");
  const [weatherPressure, setWeatherPressure] = useState<string>("");
  const [weatherConditions, setWeatherConditions] = useState<string>("");

  // --- Setup fields ---
  const [setup, setSetup] = useState<CurrentSetup>(EMPTY_SETUP);

  // --- Saved setups ---
  const [savedSetups, setSavedSetups] = useState<RodSetup[]>([]);
  const [showSavedSetups, setShowSavedSetups] = useState(false);

  // Available venues from fishing_reports
  const [venues, setVenues] = useState<string[]>([]);

  useEffect(() => {
    async function loadVenues() {
      const { data } = await supabase
        .from("fishing_reports")
        .select("venue")
        .order("venue");
      if (data) {
        const unique = [...new Set(data.map((r: any) => r.venue))];
        setVenues(unique);
      }
    }
    loadVenues();
  }, []);

  useEffect(() => {
    if (!user) return;
    async function loadSetups() {
      const { data } = await supabase
        .from("user_rod_setups")
        .select("*")
        .eq("user_id", user!.id)
        .order("usage_count", { ascending: false });
      if (data) setSavedSetups(data as RodSetup[]);
    }
    loadSetups();
  }, [user]);

  // Update venue type when venue changes
  useEffect(() => {
    if (venue && VENUE_TYPES[venue]) {
      setVenueType(VENUE_TYPES[venue]);
    }
  }, [venue]);

  function handleApplySavedSetup(s: RodSetup) {
    setSetup({
      style: s.style || null,
      rig: s.rig || null,
      line_type: s.line_type || null,
      retrieve: s.retrieve || null,
      flies_on_cast: s.default_flies || null,
      spot: null, // spot is venue-specific, not preset
      depth_zone: s.depth_zone || null,
    });
    setShowSavedSetups(false);
    toast.success(`Loaded: ${s.name}`);

    // Increment usage count in background
    supabase
      .from("user_rod_setups")
      .update({ usage_count: (s.usage_count || 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", s.id)
      .then();
  }

  function canProceedToSetup(): boolean {
    return venue.trim().length > 0;
  }

  async function handleStartSession() {
    if (!user || !venue.trim()) return;
    setSaving(true);

    try {
      // Build start_time from date + arrival
      let startTime: string | null = null;
      if (arrivalTime) {
        startTime = new Date(`${sessionDate}T${arrivalTime}:00`).toISOString();
      }

      const session = await createSession({
        user_id: user.id,
        venue_name: venue,
        venue_type: venueType,
        session_date: sessionDate,
        start_time: startTime,
        fishing_type: fishingType,
        plan: plan || null,
        rods,
        weather_temp: weatherTemp ? parseFloat(weatherTemp) : null,
        weather_wind_speed: weatherWindSpeed ? parseFloat(weatherWindSpeed) : null,
        weather_wind_dir: weatherWindDir || null,
        weather_pressure: weatherPressure ? parseFloat(weatherPressure) : null,
        weather_conditions: weatherConditions || null,
        is_active: true,
      });

      // If setup has any fields filled, create an initial "change" event to record starting state
      const hasSetup = setup.style || setup.rig || setup.line_type || setup.retrieve || setup.spot;
      if (hasSetup) {
        await addEvent({
          session_id: session.id,
          event_type: "change",
          event_time: startTime || new Date().toISOString(),
          sort_order: 0,
          style: setup.style,
          rig: setup.rig,
          line_type: setup.line_type,
          retrieve: setup.retrieve,
          flies_on_cast: setup.flies_on_cast,
          spot: setup.spot,
          depth_zone: setup.depth_zone,
          change_from: null,
          change_to: { ...setup },
          change_reason: "Session start",
        });
      }

      toast.success("Session started!");
      navigate(`/diary/${session.id}`);
    } catch (err: any) {
      console.error("Failed to start session:", err);
      toast.error(err.message || "Failed to start session");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // RENDER: Phase 1 — Session Header
  // ============================================================
  if (phase === "header") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-[420px] mx-auto p-4 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/diary")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold font-diary">New Session</h1>
          </div>

          {/* Venue */}
          <div>
            <Label>Venue *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1.5"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            >
              <option value="">Select venue...</option>
              {venues.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Arrival Time</Label>
              <Input
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Fishing Type */}
          <div>
            <Label>Fishing Type</Label>
            <div className="flex gap-2 mt-1.5">
              {FISHING_TYPES.map((ft) => (
                <Button
                  key={ft}
                  variant={fishingType === ft ? "default" : "outline"}
                  size="sm"
                  className="flex-1 min-h-[44px]"
                  onClick={() => setFishingType(fishingType === ft ? null : ft)}
                >
                  {ft}
                </Button>
              ))}
            </div>
          </div>

          {/* Plan */}
          <div>
            <Label>Plan</Label>
            <Input
              placeholder="e.g. Buzzers on floater, try lures if slow"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {/* Rods */}
          <div>
            <Label>Rods</Label>
            <div className="flex gap-2 mt-1.5">
              {[1, 2, 3, 4].map((r) => (
                <Button
                  key={r}
                  variant={rods === r ? "default" : "outline"}
                  size="sm"
                  className="w-12 min-h-[44px]"
                  onClick={() => setRods(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>

          {/* Weather (collapsible) */}
          <details className="border rounded-md p-3">
            <summary className="text-sm font-medium cursor-pointer">
              Weather (optional)
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label className="text-xs">Temp (°C)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 12"
                  value={weatherTemp}
                  onChange={(e) => setWeatherTemp(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Wind (mph)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 15"
                  value={weatherWindSpeed}
                  onChange={(e) => setWeatherWindSpeed(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Wind Dir</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs mt-1"
                  value={weatherWindDir}
                  onChange={(e) => setWeatherWindDir(e.target.value)}
                >
                  <option value="">--</option>
                  {WIND_DIRECTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Pressure (hPa)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 1018"
                  value={weatherPressure}
                  onChange={(e) => setWeatherPressure(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Conditions</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs mt-1"
                  value={weatherConditions}
                  onChange={(e) => setWeatherConditions(e.target.value)}
                >
                  <option value="">--</option>
                  {WEATHER_CONDITIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </details>

          {/* Next button */}
          <Button
            onClick={() => setPhase("setup")}
            disabled={!canProceedToSetup()}
            className="w-full min-h-[48px] text-base"
          >
            Next: Choose Setup <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Phase 2 — Initial Fishing Setup
  // ============================================================
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[420px] mx-auto p-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setPhase("header")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold font-diary">Starting Setup</h1>
            <p className="text-sm text-muted-foreground">{venue} · {sessionDate}</p>
          </div>
        </div>

        {/* Saved Setups option */}
        {savedSetups.length > 0 && (
          <div>
            <Button
              variant="outline"
              className="w-full justify-between min-h-[48px]"
              onClick={() => setShowSavedSetups(!showSavedSetups)}
            >
              <span className="flex items-center gap-2">
                <Bookmark className="h-4 w-4" />
                Use saved setup
              </span>
              <ChevronRight className={`h-4 w-4 transition-transform ${showSavedSetups ? "rotate-90" : ""}`} />
            </Button>

            {showSavedSetups && (
              <div className="mt-2 space-y-2">
                {savedSetups.map((s) => (
                  <Card
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleApplySavedSetup(s)}
                  >
                    <CardContent className="p-3">
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[s.style, s.rig, s.line_type].filter(Boolean).join(" · ")}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!showSavedSetups && (
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or build from scratch</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
          </div>
        )}

        {/* Setup Cascade: Style → Rig → Line → Retrieve → Depth */}
        <SetupCascade
          venueType={venueType}
          value={setup}
          onChange={setSetup}
        />

        {/* Spot picker */}
        <SpotPicker
          value={setup.spot}
          onChange={(v) => setSetup({ ...setup, spot: v })}
          venueName={venue}
        />

        {/* Quick Start note */}
        <p className="text-xs text-muted-foreground text-center">
          You can skip optional fields and fill them when logging your first catch.
        </p>

        {/* Start Session button */}
        <Button
          onClick={handleStartSession}
          disabled={saving || !setup.style}
          className="w-full min-h-[52px] text-base bg-diary-catch hover:bg-diary-catch/90"
        >
          {saving ? (
            "Starting..."
          ) : (
            <>
              <Play className="h-5 w-5 mr-2" /> Start Fishing
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
