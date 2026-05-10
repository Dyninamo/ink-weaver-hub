import { corsHeaders } from "../_shared/cors.ts";
import { callAnthropic } from "../_shared/anthropic.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface AskBody {
  question: string;
  surface?: "queries_tab" | "pre_session" | "mid_session" | "venue_detail";
  venue_id?: string | null;
  venue_name?: string | null;
  venue_type?: "stillwater" | "river" | null;
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

    const ARCHETYPE_DEFAULTS: Record<string, { water_type_id: number; label: string }> = {
      river:      { water_type_id: 4, label: "River - Chalkstream" },
      stillwater: { water_type_id: 2, label: "Large Reservoir" },
    };

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

    // Home sessions: fall back to archetype default keyed off venue_type
    if (waterTypeId === null && body.venue_type) {
      const archetype = ARCHETYPE_DEFAULTS[body.venue_type];
      if (archetype) {
        waterTypeId = archetype.water_type_id;
        waterTypeLabel = `${archetype.label} (archetype)`;
      }
    }

    // ─── Pull top patterns for (water_type, current month) ───────────────
    const monthIdx = new Date().getMonth() + 1; // 1..12
    interface GroundedFly {
      fly_name: string;
      fly_style: string | null;
      rank: number | null;
      importance: string | null;
      notes: string | null;
    }
    let groundedFlies: GroundedFly[] = [];

    if (waterTypeId) {
      const { data: flies } = await adminClient
        .from("wt_monthly_fly_advice")
        .select("fly_name, fly_style, rank, importance, notes")
        .eq("water_type_id", waterTypeId)
        .eq("month", monthIdx)
        .order("rank", { ascending: true })
        .order("importance", { ascending: true })
        .limit(10);
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
      ? `\n\nGROUND TRUTH — top patterns for ${waterTypeLabel ?? "this water"} in ${month}, ranked by curated importance:\n${
          groundedFlies.map((f) => {
            const styleNote = f.fly_style ? ` (${f.fly_style})` : "";
            const importanceNote = f.importance === "secondary" ? " — secondary" : "";
            const richNote = f.notes ? `\n   Note: ${f.notes}` : "";
            return `${f.rank ?? "?"}. ${f.fly_name}${styleNote}${importanceNote}${richNote}`;
          }).join("\n")
        }\n\nUse these as your PRIMARY recommendations, especially the top-ranked ones. Lean on the rank-1 pattern unless the angler's question explicitly steers elsewhere. The angler wants actionable tactical advice (size, presentation, line, retrieve), not invented fly names.`
      : "";

    const grounded = groundedFlies.length > 0;

    const groundingInstruction = grounded
      ? `\n\nWhen recommending flies, draw FROM THE GROUND TRUTH LIST above where possible. Lean on the rank-1 pattern unless the question explicitly steers elsewhere. If the question is genuinely off-topic (presentation, knots, not patterns), answer normally without citing flies.`
      : `\n\nWe have no curated fly data for this water-type and month. Be honest about that uncertainty: recommend conservative generalist patterns (e.g. Pheasant Tail Nymph, Klinkhammer, Cormorant) rather than confidently specific picks, and prefer presentation / method advice over fly names. Do not invent local hatch information.`;

    const systemPrompt = `You are "the Ghillie" — a calm, plain-spoken UK fly-fishing guide. Reply with two parts only:

1) NARRATIVE — 2-4 short sentences of practical advice. No fluff, no greetings.
2) CHIPS — 2-5 actionable chips as a JSON array. Each chip:
   { "category": "swap_in" | "change_line" | "retrieve" | "spot" | "method",
     "label": "<short imperative, max 5 words>",
     "detail": "<optional one-line reason, <80 chars>" }${groundedListText}${groundingInstruction}

Output ONLY this exact JSON shape (no markdown):
{"narrative": "...", "chips": [...], "confidence": "high"|"medium"|"low"}`;

    const userPrompt = `${ctxLines.join("\n")}\n\nQuestion: ${question}`;

    let narrative = "I can't reach the guide right now — try again shortly.";
    let chips: ChipAction[] = [];
    let confidence: "high" | "medium" | "low" = "low";
    let model = "fallback";

    try {
      const result = await callAnthropic({
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        maxTokens: 1024,
        temperature: 0.4,
      });
      const cleaned = result.text.replace(/```json\s*|\s*```/g, "").trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed.narrative === "string") narrative = parsed.narrative;
        if (Array.isArray(parsed.chips)) chips = parsed.chips.slice(0, 5);
        if (parsed.confidence === "low") {
          confidence = "low";
        } else if (grounded) {
          confidence = "high";
        } else {
          confidence = "medium";
        }
        model = result.model;
      } catch (parseErr) {
        console.warn("ask-ghillie JSON parse failed", {
          model: result.model,
          stop_reason: (result as any).stop_reason,
          raw_preview: cleaned.slice(0, 200),
          parse_error: String(parseErr),
        });
        narrative = "I had a hiccup parsing the guide's reply — please try again.";
        chips = [];
        confidence = "low";
        model = result.model;
      }
    } catch (err) {
      console.error("Anthropic call failed", err);
      narrative = "I can't reach the guide right now — try again shortly.";
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
        grounding: groundedFlies.length > 0 ? {
          water_type_id: waterTypeId,
          water_type: waterTypeLabel,
          month: monthIdx,
          fly_count: groundedFlies.length,
          source: "wt_monthly_fly_advice",
          archetype: !body.venue_id && (body.venue_name === "Home" || !body.venue_name),
        } : null,
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
