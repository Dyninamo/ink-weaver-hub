// Admin-gated dump of diary tables. Per prompt 228.
// Mirrors admin-dump-app-events. Required because prompt 227 locks the
// diary tables to owner-only, removing the anon read path master used.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { corsHeaders } from "../_shared/cors.ts";
import { requireEnv } from "../_shared/env.ts";
import { requireAdmin } from "../_shared/admin_auth.ts";

const ALLOWED_TABLES = new Set([
  "fishing_sessions",
  "session_events",
  "session_trails",
]);

const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 1000;

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

  const table = param("table");
  if (!table || !ALLOWED_TABLES.has(table)) {
    return new Response(
      JSON.stringify({ error: `table must be one of: ${[...ALLOWED_TABLES].join(", ")}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const rawLimit = param("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(rawLimit ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT),
  );
  const rawOffset = param("offset");
  const offset = Math.max(0, parseInt(rawOffset ?? "0", 10) || 0);

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    table,
    limit,
    offset,
    rows: data ?? [],
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
