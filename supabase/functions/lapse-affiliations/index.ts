import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find all active affiliations where last session was > 12 months ago
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const cutoffDate = twelveMonthsAgo.toISOString();

    const { data: toLapse, error: fetchError } = await supabase
      .from("venue_affiliations")
      .select("affiliation_id")
      .eq("status", "active")
      .lt("last_session_at", cutoffDate);

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!toLapse || toLapse.length === 0) {
      return new Response(JSON.stringify({ lapsed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = toLapse.map((r) => r.affiliation_id);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("venue_affiliations")
      .update({ status: "lapsed", lapsed_at: now })
      .in("affiliation_id", ids);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ lapsed: ids.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("lapse-affiliations error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
