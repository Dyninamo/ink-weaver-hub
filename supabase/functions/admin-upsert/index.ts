// Prompt 229: admin-gated upsert path for master writers.
// Mirrors admin-dump-diary (228) for auth/shape but performs writes via service_role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireEnv, envErrorResponse } from "../_shared/env.ts";
import { requireAdmin } from "../_shared/admin_auth.ts";

const ALLOWED_TABLES = new Set<string>([
  "venues_new",
  "weather_daily",
  "reports_enriched",
  "reports_raw",
  "flies",
  "fly_water_types",
  "fly_water_type_monthly",
  "report_seasonal_fly_rankings",
  "report_condition_fly_rankings",
  "stillwater_condition_modifiers",
  "river_condition_modifiers",
  "river_seasonal_baselines",
  "stocking_records",
  "venue_clubs",
  "method_canonical",
  "method_aliases",
  "weather_youtube",
  "fly_suitability_truth",
  "fly_monthly_availability",
  "fly_species_link",
  "fly_thumbnails",
  "pattern_fly_conditions",
  "wt_monthly_fly_advice",
  "venue_slices_cache",
  "venue_slices",
  "station_registry",
  "venue_station_map",
]);

const MAX_ROWS = 1000;

function jsonResp(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return jsonResp({ error: auth.error }, auth.status);
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResp({ error: "Invalid JSON body" }, 400);
    }

    const { table, rows, on_conflict, delete_where_not_null } = body ?? {};

    if (typeof table !== "string" || !table) {
      return jsonResp({ error: "table (string) required" }, 400);
    }
    if (!ALLOWED_TABLES.has(table)) {
      return jsonResp({ error: `table '${table}' not in allowlist` }, 400);
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return jsonResp({ error: "rows must be a non-empty array" }, 400);
    }
    if (rows.length > MAX_ROWS) {
      return jsonResp({ error: `rows exceeds MAX_ROWS (${MAX_ROWS})` }, 400);
    }
    if (on_conflict !== undefined && typeof on_conflict !== "string") {
      return jsonResp({ error: "on_conflict must be a string if provided" }, 400);
    }
    if (delete_where_not_null !== undefined) {
      if (typeof delete_where_not_null !== "string" || !/^[a-z_][a-z0-9_]*$/i.test(delete_where_not_null)) {
        return jsonResp({ error: "delete_where_not_null must be a plain column identifier" }, 400);
      }
    }

    const supabaseAdmin = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let deleted: number | null = null;
    if (delete_where_not_null) {
      const { error: delError, count: delCount } = await supabaseAdmin
        .from(table)
        .delete({ count: "exact" })
        .not(delete_where_not_null, "is", null);
      if (delError) {
        console.error(`[admin-upsert] ${table} delete error:`, delError);
        const status = /permission|denied|violat/i.test(delError.message) ? 400 : 500;
        return jsonResp({ error: delError.message, table, deleted: 0, upserted: 0 }, status);
      }
      deleted = delCount ?? 0;
    }


    const query = supabaseAdmin.from(table).upsert(
      rows,
      on_conflict ? { onConflict: on_conflict } : undefined,
    );
    const { error } = await query;

    if (error) {
      console.error(`[admin-upsert] ${table} error:`, error);
      const status = /permission|denied|violat/i.test(error.message) ? 400 : 500;
      return jsonResp({ error: error.message, table, deleted, upserted: 0 }, status);
    }

    return jsonResp({ table, deleted, upserted: rows.length }, 200);

  } catch (err) {
    const envResp = envErrorResponse(err, corsHeaders);
    if (envResp) return envResp;
    console.error("[admin-upsert] unexpected:", err);
    return jsonResp({ error: String(err) }, 500);
  }
});
