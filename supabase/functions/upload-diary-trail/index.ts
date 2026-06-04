// Prompt 215 — upload-diary-trail: replace-semantics trail snapshot upload.
// Gate: X-Admin-Secret OR any signed-in user's Bearer JWT (ownership enforced).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireEnv, envErrorResponse } from "../_shared/env.ts";
import { requireUser } from "../_shared/user_auth.ts";

const MAX_POINTS = 5000;

type GateOk =
  | { ok: true; via: "secret" }
  | { ok: true; via: "user"; userId: string };
type GateErr = { ok: false; status: number; error: string };

async function gate(req: Request): Promise<GateOk | GateErr> {
  const secret = req.headers.get("x-admin-secret");
  if (secret) {
    const expected = Deno.env.get("ADMIN_API_SECRET");
    if (!expected) return { ok: false, status: 401, error: "ADMIN_API_SECRET not configured" };
    if (secret !== expected) return { ok: false, status: 401, error: "Invalid admin secret" };
    return { ok: true, via: "secret" };
  }
  const auth = await requireUser(req, corsHeaders);
  if (auth.error) return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true, via: "user", userId: auth.user.id };
}

interface InputPoint {
  timestamp?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  altitude?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const g = await gate(req);
  if (!g.ok) {
    return new Response(JSON.stringify({ error: g.error }), {
      status: g.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const session_id = typeof body.session_id === "string" ? body.session_id.trim() : "";
    const points: unknown = body.points;

    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(points)) {
      return new Response(JSON.stringify({ error: "points must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (points.length > MAX_POINTS) {
      return new Response(
        JSON.stringify({ error: `points exceeds MAX_POINTS=${MAX_POINTS}` }),
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
    if (g.via === "user" && sessionRow.user_id !== g.userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate + normalize points
    const cleaned: Array<{
      session_id: string;
      timestamp: string;
      latitude: number;
      longitude: number;
      accuracy: number | null;
      altitude: number | null;
      sort_order: number;
    }> = [];

    for (const raw of points as InputPoint[]) {
      if (!raw || typeof raw !== "object") continue;
      const lat = Number(raw.latitude);
      const lon = Number(raw.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const tsRaw = raw.timestamp;
      if (typeof tsRaw !== "string") continue;
      const t = Date.parse(tsRaw);
      if (!Number.isFinite(t)) continue;
      const acc = raw.accuracy == null ? null : Number.isFinite(Number(raw.accuracy)) ? Number(raw.accuracy) : null;
      const alt = raw.altitude == null ? null : Number.isFinite(Number(raw.altitude)) ? Number(raw.altitude) : null;
      cleaned.push({
        session_id,
        timestamp: new Date(t).toISOString(),
        latitude: lat,
        longitude: lon,
        accuracy: acc,
        altitude: alt,
        sort_order: 0, // assigned after sort
      });
    }

    cleaned.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    cleaned.forEach((p, i) => { p.sort_order = i; });

    // Replace: delete then insert
    const { error: delErr } = await supabaseAdmin
      .from("session_trails")
      .delete()
      .eq("session_id", session_id);
    if (delErr) {
      console.error("delete trail error", delErr);
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (cleaned.length === 0) {
      return new Response(JSON.stringify({ inserted: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insErr } = await supabaseAdmin
      .from("session_trails")
      .insert(cleaned);
    if (insErr) {
      console.error("insert trail error", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ inserted: cleaned.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const envResp = envErrorResponse(err, corsHeaders);
    if (envResp) return envResp;
    console.error("upload-diary-trail error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
