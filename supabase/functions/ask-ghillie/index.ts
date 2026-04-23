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

    // Build a compact context block from weather + venue
    const ctxLines: string[] = [];
    if (body.venue_name) ctxLines.push(`Venue: ${body.venue_name}`);
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

    const systemPrompt = `You are "the Ghillie" — a calm, plain-spoken UK fly-fishing guide. Reply with two parts only:

1) NARRATIVE — 2-4 short sentences of practical advice. No fluff, no greetings.
2) CHIPS — 2-5 actionable chips as a JSON array. Each chip:
   { "category": "swap_in" | "change_line" | "retrieve" | "spot" | "method",
     "label": "<short imperative, max 5 words>",
     "detail": "<optional one-line reason, <80 chars>" }

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
            if (parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low") {
              confidence = parsed.confidence;
            } else {
              confidence = "medium";
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
