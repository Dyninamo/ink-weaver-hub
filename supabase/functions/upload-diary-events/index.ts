import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireEnv, envErrorResponse } from "../_shared/env.ts";
import { requireAdmin } from "../_shared/admin_auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseAdmin = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { events } = await req.json();

    if (!Array.isArray(events)) {
      return new Response(JSON.stringify({ error: "events must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Explicitly pass through new fields added in prompts 111 + earlier schema.
    const rows = events.map((event: any) => ({
      ...event,
      // GPS quality
      gps_accuracy: event.gps_accuracy ?? null,
      gps_altitude: event.gps_altitude ?? null,
      // Phone sensor snapshot
      sensor_pressure_hpa: event.sensor_pressure_hpa ?? null,
      sensor_light_lux: event.sensor_light_lux ?? null,
      sensor_compass_deg: event.sensor_compass_deg ?? null,
      // Weather at event time
      event_wind_gusts: event.event_wind_gusts ?? null,
      event_rain_mm: event.event_rain_mm ?? null,
      event_cloud_pct: event.event_cloud_pct ?? null,
      event_pressure_trend: event.event_pressure_trend ?? null,
      // Measurement fields
      weight_display: event.weight_display ?? null,
      measurement_mode: event.measurement_mode ?? null,
      length_inches: event.length_inches ?? null,
    }));

    const { error } = await supabaseAdmin
      .from("session_events")
      .upsert(rows, { onConflict: "id" });

    if (error) {
      console.error("Upsert error:", error);
      return new Response(JSON.stringify({ error: error.message, inserted: 0, failed: events.length }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ inserted: events.length, failed: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const envResp = envErrorResponse(err, corsHeaders);
    if (envResp) return envResp;
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
