// Prompt 213 — delete specific session_events rows (scoped by session_id),
// the missing delete path matched to upload-diary-events' upsert-only contract.
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
    const body = await req.json().catch(() => ({}));
    const session_id = typeof body.session_id === "string" ? body.session_id.trim() : "";
    const event_ids: unknown = body.event_ids;

    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (
      !Array.isArray(event_ids) ||
      event_ids.length === 0 ||
      !event_ids.every((x) => typeof x === "string" && x.length > 0)
    ) {
      return new Response(
        JSON.stringify({ error: "event_ids must be a non-empty array of strings" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Ownership guard
    const { data: sessionRow, error: sessErr } = await supabaseAdmin
      .from("fishing_sessions")
      .select("id, user_id")
      .eq("id", session_id)
      .maybeSingle();

    if (sessErr) {
      console.error("session lookup error", sessErr);
      return new Response(JSON.stringify({ error: sessErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!sessionRow) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (auth.via === "user" && auth.user && sessionRow.user_id !== auth.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: deleted, error: delErr } = await supabaseAdmin
      .from("session_events")
      .delete()
      .eq("session_id", session_id)
      .in("id", event_ids as string[])
      .select("id");

    if (delErr) {
      console.error("delete error", delErr);
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ deleted: deleted?.length ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const envResp = envErrorResponse(err, corsHeaders);
    if (envResp) return envResp;
    console.error("delete-diary-events error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
