import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface AskBody {
  question: string;
  surface?: "queries_tab" | "pre_session" | "mid_session" | "venue_detail";
  venue_id?: string | null;
  venue_name?: string | null;
  session_id?: string | null;
  weather_snapshot?: Record<string, unknown> | null;
}

interface ChipAction {
  category: "swap_in" | "change_line" | "retrieve" | "spot" | "method";
  label: string;
  detail?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing bearer token" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const user = userData.user;

    const body = (await req.json()) as AskBody;
    const question = (body.question ?? "").trim();
    if (question.length < 3 || question.length > 500) {
      return jsonResponse({ error: "Question must be 3-500 characters" }, 400);
    }

    const surface = body.surface ?? "queries_tab";

    // ─── Resolve venue → water_type_id (prompt 152) ──────────────────────
    // Use service-role client for the lookup so RLS doesn't block (venues_new
    // and water_types are public-read but fly_water_type_monthly may be
    // service-only). Auth has already been validated above.
    const adminClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? SUPABASE_ANON_KEY,
    );

    let waterTypeId: number | null = null;
    let waterTypeLabel: string | null = null;

    if (body.venue_id) {
      const { data: vRow } = await adminClient
        .from("venues_new")
        .select("water_type_id, water_types(water_type)")
        .eq("venue_id", body.venue_id)
        .maybeSingle();
      waterTypeId = (vRow as any)?.water_type_id ?? null;
      waterTypeLabel = (vRow as any)?.water_types?.water_type ?? null;
    } else if (body.venue_name && body.venue_name !== "Home") {
      const { data: vRow } = await adminClient
        .from("venues_new")
        .select("water_type_id, water_types(water_type)")
        .ilike("name", body.venue_name)
        .limit(1)
        .maybeSingle();
      waterTypeId = (vRow as any)?.water_type_id ?? null;
      waterTypeLabel = (vRow as any)?.water_types?.water_type ?? null;
    }

    // ─── Pull top patterns for (water_type, current month) ───────────────
    const monthIdx = new Date().getMonth() + 1; // 1..12
    let groundedFlies: { pattern_name: string; suitability: string; evidence_count: number }[] = [];

    if (waterTypeId) {
      const { data: flies } = await adminClient
        .from("fly_water_type_monthly")
        .select("pattern_name, suitability, evidence_count")
        .eq("water_type_id", waterTypeId)
        .eq("month", monthIdx)
        .eq("suitability", "main")
        .order("evidence_count", { ascending: false })
        .limit(15);
      groundedFlies = (flies as any[]) ?? [];
    }

    // Build a compact context block from weather + venue
    const ctxLines: string[] = [];
    if (body.venue_name) ctxLines.push(`Venue: ${body.venue_name}`);
    if (waterTypeLabel) ctxLines.push(`Water type: ${waterTypeLabel}`);
    if (body.weather_snapshot) {
      const w = body.weather_snapshot as Record<string, unknown>;
      const bits: string[] = [];
      if (w.temp_c != null) bits.push(`${w.temp_c}°C`);
      if (w.wind_mph != null) bits.push(`${w.wind_mph} mph wind`);
      if (w.wind_dir) bits.push(`from ${w.wind_dir}`);
      if (w.pressure_mb != null) bits.push(`${w.pressure_mb} mb`);
      if (w.cloud_pct != null) bits.push(`${w.cloud_pct}% cloud`);
      if (bits.length) ctxLines.push(`Weather: ${bits.join(", ")}`);
    }
    const month = new Date().toLocaleString("en-GB", { month: "long" });
    ctxLines.push(`Month: ${month}`);

    const groundedListText = groundedFlies.length > 0
      ? `\n\nGROUND TRUTH — top patterns for ${waterTypeLabel ?? "this water"} in ${month}, ranked by evidence:\n${
          groundedFlies.map((f, i) => `${i + 1}. ${f.pattern_name}`).join("\n")
        }\n\nUse these as your PRIMARY recommendations. The angler wants actionable tactical advice (size, presentation, line, retrieve), not invented fly names.`
      : "";

    const systemPrompt = `You are "the Ghillie" — a calm, plain-spoken UK fly-fishing guide. Reply with two parts only:

1) NARRATIVE — 2-4 short sentences of practical advice. No fluff, no greetings.
2) CHIPS — 2-5 actionable chips as a JSON array. Each chip:
   { "category": "swap_in" | "change_line" | "retrieve" | "spot" | "method",
     "label": "<short imperative, max 5 words>",
     "detail": "<optional one-line reason, <80 chars>" }${groundedListText}

When recommending flies, draw FROM THE GROUND TRUTH LIST above where possible. If the question is genuinely off-topic from the ground truth (e.g. about presentation, knots, not patterns), you can answer normally without citing flies.

Output ONLY this exact JSON shape (no markdown):
{"narrative": "...", "chips": [...], "confidence": "high"|"medium"|"low"}`;

    const userPrompt = `${ctxLines.join("\n")}\n\nQuestion: ${question}`;

    let narrative = "I can't reach the guide right now — try again shortly.";
    let chips: ChipAction[] = [];
    let confidence: "high" | "medium" | "low" = "low";
    let model = "fallback";

    if (LOVABLE_API_KEY) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiJson = await aiResp.json();
          const content = aiJson.choices?.[0]?.message?.content ?? "";
          const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
          try {
            const parsed = JSON.parse(cleaned);
            if (typeof parsed.narrative === "string") narrative = parsed.narrative;
            if (Array.isArray(parsed.chips)) chips = parsed.chips.slice(0, 5);
            // Grounded → bias toward "high"; ungrounded → cap at "medium".
            const grounded = groundedFlies.length > 0;
            if (parsed.confidence === "low") {
              confidence = "low";
            } else if (grounded) {
              confidence = "high";
            } else {
              confidence = parsed.confidence === "high" ? "medium" : "medium";
            }
            model = "google/gemini-2.5-flash";
          } catch {
            // Couldn't parse strict JSON — fall back to narrative only
            narrative = cleaned || narrative;
            confidence = "low";
            model = "google/gemini-2.5-flash";
          }
        } else if (aiResp.status === 429) {
          narrative = "The guide's busy — try again in a minute.";
        } else if (aiResp.status === 402) {
          narrative = "AI credits need topping up — ask an admin.";
        }
      } catch (err) {
        console.error("AI call failed", err);
      }
    }

    // Persist
    const { data: saved, error: saveErr } = await supabase
      .from("user_queries")
      .insert({
        user_id: user.id,
        surface,
        question,
        venue_id: body.venue_id ?? null,
        venue_name: body.venue_name ?? null,
        session_id: body.session_id ?? null,
        weather_snapshot: body.weather_snapshot ?? null,
        answer_narrative: narrative,
        answer_chips: chips,
        confidence,
        model,
        cached_until: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
      })
      .select()
      .single();

    if (saveErr) {
      console.error("Save query failed", saveErr);
      return jsonResponse(
        {
          query_id: null,
          narrative,
          chips,
          confidence,
          model,
          warning: "Answer not saved",
        },
        200
      );
    }

    return jsonResponse({
      query_id: saved.query_id,
      narrative,
      chips,
      confidence,
      model,
      created_at: saved.created_at,
    });
  } catch (err) {
    console.error("ask-ghillie error", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
