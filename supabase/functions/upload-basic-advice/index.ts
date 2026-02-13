import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_KEYS = [
  "venue","season","weather_category","temp_range_min","temp_range_max",
  "temp_label","report_count","expected_rod_average","rod_average_range",
  "methods_ranked","flies_ranked","spots_ranked","latest_similar","advice_text",
];

function pick(obj: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED_KEYS) {
    if (k in obj) out[k] = obj[k];
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { records } = await req.json();
    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: "records must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cleaned = records.map(pick);

    const { data, error } = await supabase
      .from("basic_advice")
      .upsert(cleaned, { onConflict: "venue,season,weather_category" })
      .select();

    if (error) {
      console.error("Upsert error:", error);
      return new Response(
        JSON.stringify({ inserted: 0, failed: cleaned.length, errors: [error.message] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ inserted: data?.length ?? cleaned.length, failed: 0, errors: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("upload-basic-advice error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
