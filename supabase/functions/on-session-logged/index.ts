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

    const { user_id, venue_id, session_date } = await req.json();

    if (!user_id || !venue_id) {
      return new Response(
        JSON.stringify({ error: "user_id and venue_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get or backfill user_profiles row
    let { data: profile } = await supabase
      .from("user_profiles")
      .select("profile_id")
      .eq("id", user_id)
      .single();

    if (!profile || !profile.profile_id) {
      // Backfill profile_id for users created before social layer
      const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
      const displayName =
        authUser?.user?.user_metadata?.display_name ||
        authUser?.user?.email?.split("@")[0] ||
        "Angler";

      const newProfileId = crypto.randomUUID();
      const { data: newProfile, error: profileError } = await supabase
        .from("user_profiles")
        .update({ profile_id: newProfileId, display_name: displayName })
        .eq("id", user_id)
        .select("profile_id")
        .single();

      if (profileError) {
        console.error("Profile backfill error:", profileError);
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      profile = newProfile;
    }

    // 2. Check existing affiliation
    const { data: existing } = await supabase
      .from("venue_affiliations")
      .select("affiliation_id, status, is_welcome_back_pending")
      .eq("profile_id", profile!.profile_id)
      .eq("venue_id", venue_id)
      .single();

    let result: Record<string, unknown> = {};

    if (!existing) {
      // No record — create new active affiliation
      const { error } = await supabase.from("venue_affiliations").insert({
        profile_id: profile!.profile_id,
        venue_id,
        status: "active",
        last_session_at: session_date,
      });
      if (error) console.error("Insert affiliation error:", error);
      result = { action: "joined", welcome_back: false };
    } else if (existing.status === "active") {
      // Already active — just update last_session_at
      await supabase
        .from("venue_affiliations")
        .update({ last_session_at: session_date })
        .eq("affiliation_id", existing.affiliation_id);
      result = { action: "updated", welcome_back: false };
    } else if (existing.status === "lapsed") {
      // Lapsed — set welcome_back_pending, do NOT auto-rejoin
      await supabase
        .from("venue_affiliations")
        .update({ is_welcome_back_pending: true, last_session_at: session_date })
        .eq("affiliation_id", existing.affiliation_id);
      result = { action: "welcome_back_pending", welcome_back: true };
    } else if (existing.status === "opted_out") {
      // Opted out — respect the user's choice
      result = { action: "opted_out_unchanged", welcome_back: false };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("on-session-logged error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
