// Admin-gated dump of app_events. Per prompt 200 §2.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { corsHeaders } from "../_shared/cors.ts";
import { requireEnv } from "../_shared/env.ts";
import { requireAdmin } from "../_shared/admin_auth.ts";

const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 200;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { body = {}; }
  }
  const param = (k: string): string | null => {
    const fromBody = body[k];
    if (typeof fromBody === "string" && fromBody.length > 0) return fromBody;
    return url.searchParams.get(k);
  };

  const userEmail = param("user_email");
  const userIdParam = param("user_id");
  const since = param("since");
  const until = param("until");
  const eventType = param("event_type");
  const route = param("route");
  const rawLimit = param("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(rawLimit ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT),
  );

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  let userId = userIdParam;
  if (!userId && userEmail) {
    const target = userEmail.toLowerCase();
    let found: { id: string; email: string | null } | null = null;
    // Paginate auth.admin.listUsers until we find the email or run out.
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        return new Response(JSON.stringify({ error: `user lookup failed: ${error.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
      if (match) { found = { id: match.id, email: match.email ?? null }; break; }
      if (data.users.length < 200) break;
    }
    if (!found) {
      return new Response(JSON.stringify({ error: `no user with email ${userEmail}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = found.id;
  }

  let q = supabase.from("app_events").select("*").order("server_time", { ascending: false }).limit(limit);
  if (userId) q = q.eq("user_id", userId);
  if (since) q = q.gt("server_time", since);
  if (until) q = q.lt("server_time", until);
  if (eventType) q = q.eq("event_type", eventType);
  if (route) q = q.eq("route", route);

  const { data, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    user_id: userId,
    user_email: userEmail,
    count: data?.length ?? 0,
    rows: data ?? [],
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
