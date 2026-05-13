import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv, envErrorResponse } from "../_shared/env.ts";
import { requireUser, forbiddenResponse } from "../_shared/user_auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Convert wind degrees to 16-point compass direction */
function degreesToCompass(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const idx = Math.round(((deg % 360 + 360) % 360) / 22.5) % 16;
  return dirs[idx];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Per prompt 190: require authenticated user
    const auth = await requireUser(req, corsHeaders);
    if (auth.error) return auth.error;
    const user = auth.user;

    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // ── Fetch session ──────────────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from("fishing_sessions")
      .select("id, user_id, venue_name, weather_log, is_active")
      .eq("id", session_id)
      .single();

    if (sessionErr || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!session.is_active) {
      return new Response(
        JSON.stringify({ error: "Session is not active — weather polling skipped" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Look up venue coordinates (venues_new is canonical; venue_metadata fallback) ─
    let venue: { latitude: number | null; longitude: number | null } | null = null;
    {
      const { data } = await supabase
        .from("venues_new")
        .select("latitude, longitude")
        .ilike("name", session.venue_name)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(1)
        .maybeSingle();
      venue = data;
    }
    if (!venue?.latitude || !venue?.longitude) {
      const { data } = await supabase
        .from("venues_new")
        .select("latitude, longitude")
        .ilike("name", `%${session.venue_name}%`)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(1)
        .maybeSingle();
      venue = data;
    }
    if (!venue?.latitude || !venue?.longitude) {
      const { data } = await supabase
        .from("venue_metadata")
        .select("latitude, longitude")
        .ilike("name", `%${session.venue_name}%`)
        .limit(1)
        .maybeSingle();
      venue = data;
    }

    if (!venue?.latitude || !venue?.longitude) {
      return new Response(
        JSON.stringify({ error: `No coordinates for venue: ${session.venue_name}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Call OpenWeatherMap Current Weather API ─────────────────
    const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENWEATHER_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const owmUrl =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${venue.latitude}&lon=${venue.longitude}&units=metric&appid=${apiKey}`;

    const owmRes = await fetch(owmUrl);
    const owm = await owmRes.json();

    if (!owmRes.ok) {
      return new Response(
        JSON.stringify({ error: "Weather API error", details: owm.message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build weather snapshot (local UK time) ─────────────────
    const now = new Date();
    const localTime = now.toLocaleString("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const snapshot = {
      time: localTime,                                                 // "HH:MM" local
      temp: Math.round(owm.main.temp * 10) / 10,                      // Celsius
      wind_speed: Math.round(owm.wind.speed * 2.237 * 10) / 10,       // m/s → mph
      wind_dir: degreesToCompass(owm.wind?.deg ?? 0),                  // 16-point compass
      precip: owm.rain?.["1h"] ?? 0,                                   // mm in last hour
      pressure: owm.main.pressure,                                     // hPa
      humidity: owm.main.humidity,                                     // %
      conditions: owm.weather?.[0]?.description ?? null,               // "overcast clouds" etc.
    };

    // ── Append to weather_log ──────────────────────────────────
    const currentLog: any[] = session.weather_log || [];
    const updatedLog = [...currentLog, snapshot];

    const { error: updateErr } = await supabase
      .from("fishing_sessions")
      .update({ weather_log: updatedLog })
      .eq("id", session_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: "Failed to update weather_log", details: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Weather logged for session ${session_id}: ${snapshot.temp}°C, ${snapshot.wind_speed}mph ${snapshot.wind_dir} (entry #${updatedLog.length})`);

    return new Response(
      JSON.stringify({ success: true, snapshot, total_entries: updatedLog.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const envResp = envErrorResponse(err, corsHeaders);
    if (envResp) return envResp;
    console.error("poll-session-weather error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
