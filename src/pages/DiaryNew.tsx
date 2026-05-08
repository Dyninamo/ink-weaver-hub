import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveSession } from "@/contexts/ActiveSessionContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play } from "lucide-react";
import { toast } from "sonner";
import { createSession } from "@/services/diaryService";
import LeaderPicker, { EMPTY_LEADER, LeaderValue } from "@/components/diary/LeaderPicker";

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

export default function DiaryNew() {
  const { user } = useAuth();
  const { refresh: refreshActiveSession } = useActiveSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [keepLimit, setKeepLimit] = useState<string>("");
  const [leader, setLeader] = useState<LeaderValue>(EMPTY_LEADER);

  // Weather
  const [weatherTemp, setWeatherTemp] = useState<string>("");
  const [weatherWindSpeed, setWeatherWindSpeed] = useState<string>("");
  const [weatherWindDir, setWeatherWindDir] = useState<string>("");
  const [weatherPressure, setWeatherPressure] = useState<string>("");
  const [weatherConditions, setWeatherConditions] = useState<string>("");

  const [venues, setVenues] = useState<string[]>([]);

  useEffect(() => {
    async function loadVenues() {
      const { data } = await supabase
        .from("reports_enriched")
        .select("venue")
        .order("venue");
      if (data) {
        const unique = [...new Set(data.map((r: any) => r.venue))];
        setVenues(unique);
      }
    }
    loadVenues();
  }, []);

  // Pre-fill venue from ?venue= querystring (e.g., from VenueDetail CTA)
  useEffect(() => {
    const v = searchParams.get("venue");
    if (v) setVenue(v);
  }, [searchParams]);

  useEffect(() => {
    if (venue && VENUE_TYPES[venue]) {
      setVenueType(VENUE_TYPES[venue]);
    }
  }, [venue]);

  async function handleStartSession() {
    if (!user) {
      toast.error("Please sign in again");
      navigate("/auth");
      return;
    }
    if (!venue.trim()) {
      toast.error("Pick a venue first");
      return;
    }
    setSaving(true);

    try {
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
        keep_limit: keepLimit ? parseInt(keepLimit, 10) : null,
        leader_material: leader.material,
        leader_length_ft: leader.length_ft,
        leader_strength_lb: leader.strength_lb,
        leader_id: leader.leader_id,
      } as any);

      // Resolve venue_id from venues_new (needed for affiliation + email lookup)
      const { data: matchedVenue } = await supabase
        .from("venues_new")
        .select("venue_id, contact_email")
        .ilike("name", venue)
        .limit(1)
        .maybeSingle();

      if (matchedVenue?.venue_id) {
        try {
          await supabase.functions.invoke("on-session-logged", {
            body: {
              user_id: user.id,
              venue_id: matchedVenue.venue_id,
              session_date: sessionDate,
            },
          });
        } catch (affiliationErr) {
          console.warn("Affiliation call failed (non-critical):", affiliationErr);
        }
      }

      if (matchedVenue && !matchedVenue.contact_email) {
        supabase.functions
          .invoke("find-venue-email", {
            body: { venue_id: matchedVenue.venue_id, session_id: session.id },
          })
          .catch(() => {});
      }

      toast.success("Session started!");
      refreshActiveSession();
      navigate(`/diary/${session.id}`);
    } catch (err: any) {
      console.error("Failed to start session:", err);
      toast.error(err.message || "Failed to start session");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[420px] mx-auto p-4 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/diary")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold font-diary">New Session</h1>
        </div>

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

        <div>
          <Label>Plan</Label>
          <Input
            placeholder="e.g. Buzzers on floater, try lures if slow"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="mt-1.5"
          />
        </div>

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

        <div>
          <Label>Keep limit</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            placeholder="0 = catch & release"
            value={keepLimit}
            onChange={(e) => setKeepLimit(e.target.value)}
            className="mt-1.5"
          />
        </div>

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

        <Button
          onClick={handleStartSession}
          disabled={saving}
          className="w-full min-h-[48px] text-base"
        >
          <Play className="h-4 w-4 mr-2" />
          {saving ? "Starting..." : "Start Session"}
        </Button>
      </div>
    </div>
  );
}
