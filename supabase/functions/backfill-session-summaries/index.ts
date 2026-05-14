// Per prompt 201 §2.1 — admin-gated one-shot backfill of session_summaries
// for every ended diary session. Caps at MAX_SESSIONS per call.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { requireEnv } from "../_shared/env.ts";
import { requireAdmin } from "../_shared/admin_auth.ts";

const MAX_SESSIONS = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const userId = typeof body.user_id === "string" ? body.user_id : null;
  const since = typeof body.since === "string" ? body.since : null;

  let q = supabase
    .from("fishing_sessions")
    .select("id, user_id, venue_name, session_date")
    .eq("is_active", false)
    .not("user_id", "is", null)
    .limit(MAX_SESSIONS);
  if (userId) q = q.eq("user_id", userId);
  if (since) q = q.gte("session_date", since);

  const { data: sessions, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminSecret = Deno.env.get("ADMIN_API_SECRET") ?? "";
  const baseUrl = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const results = { attempted: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] as string[] };

  for (const s of sessions ?? []) {
    results.attempted++;
    try {
      const resp = await fetch(`${baseUrl}/functions/v1/compute-session-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({ session_id: s.id, _backfill: true }),
      });
      if (resp.ok || resp.status === 204) {
        results.succeeded++;
      } else {
        results.failed++;
        const errBody = await resp.text();
        results.errors.push(`${s.id}: HTTP ${resp.status} ${errBody.slice(0, 120)}`);
      }
    } catch (e) {
      results.failed++;
      results.errors.push(`${s.id}: ${(e as Error).message}`);
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
