# Lovable Prompt 152 — ground `ask-ghillie` recommendations in `fly_water_type_monthly`

**Date:** 2026-05-10
**Branch / repo:** `Dyninamo/ink-weaver-hub`

**The bug:** Nick asked the in-session ghillie for fly recommendations on the **River Wensum, mid-May**. The response listed Olive Dun, Grannom Sedge, Hare's Ear Nymph, "Dry Fly Upstream", and "Look for rising fish" — **no Mayfly**. Mid-May on a UK chalk-influenced river is the iconic Mayfly hatch. Missing Mayfly is a content-quality failure.

**The cause:** `supabase/functions/ask-ghillie/index.ts` builds a context block (venue name, weather, month) and sends it to Gemini 2.5 Flash with a system prompt asking for narrative + chips. **It never queries the seasonality data we already have.** The model relies on its general knowledge of UK fly fishing — which is variable.

**The data already exists** on master and on Supabase (mirrored via prompt 94/96/97/98 in Session 14):
- `fly_water_type_monthly` — 53,004 rows of (pattern_name, water_type_id, month, suitability ['main'|'secondary'|'occasional'|'never'], evidence_count, source). Hardened in master Session 26 Phase 3 with referential-integrity triggers.
- `venues_new.water_type_id` — every venue resolves to a water type.

**The fix:** `ask-ghillie` should look up the venue's `water_type_id`, pull the top patterns for `(water_type_id, current_month)` from `fly_water_type_monthly`, and inject them as ground truth into the LLM prompt. The model's job becomes "explain and present these patterns with practical tactical advice", not "guess the patterns".

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/152_response.md`.

---

## File targets

- `supabase/functions/ask-ghillie/index.ts` — the only file. ~60 lines added.

No schema changes. No frontend changes. The response shape stays identical (`{ narrative, chips, confidence, query_id, model, created_at }`).

---

## Pre-flight greps

```bash
grep -n "water_type_id\|fly_water_type_monthly" supabase/functions/ask-ghillie/index.ts
# expect: zero hits — confirms the edge function isn't using this data today

grep -rIn "fly_water_type_monthly" supabase/functions/
# expect: zero hits across all edge functions — or, if any consumer exists
# already (e.g. get-ai-advice-v2), surface its query for cross-reference
```

If `get-ai-advice-v2` already queries `fly_water_type_monthly` for the archetype path (146 §6), reuse the same query shape so both functions stay aligned.

---

## Implementation

### 1. Resolve venue → water_type_id

After parsing the request body and authenticating (current lines 28-50), look up the water type:

```ts
let waterTypeId: number | null = null;
let waterTypeLabel: string | null = null;

if (body.venue_id) {
  const { data: vRow } = await supabase
    .from("venues_new")
    .select("water_type_id, water_types(water_type)")
    .eq("venue_id", body.venue_id)
    .maybeSingle();
  waterTypeId = (vRow as any)?.water_type_id ?? null;
  waterTypeLabel = (vRow as any)?.water_types?.water_type ?? null;
} else if (body.venue_name && body.venue_name !== "Home") {
  // Fallback by name (case-insensitive) — covers sessions started before
  // venue_id was wired (some legacy rows) and free-text dashboard queries.
  const { data: vRow } = await supabase
    .from("venues_new")
    .select("water_type_id, water_types(water_type)")
    .ilike("name", body.venue_name)
    .limit(1)
    .maybeSingle();
  waterTypeId = (vRow as any)?.water_type_id ?? null;
  waterTypeLabel = (vRow as any)?.water_types?.water_type ?? null;
}
```

### 2. Pull top patterns for the resolved water type + current month

```ts
const monthIdx = new Date().getMonth() + 1; // 1..12
let groundedFlies: { pattern_name: string; suitability: string; evidence_count: number }[] = [];

if (waterTypeId) {
  const { data: flies } = await supabase
    .from("fly_water_type_monthly")
    .select("pattern_name, suitability, evidence_count")
    .eq("water_type_id", waterTypeId)
    .eq("month", monthIdx)
    .eq("suitability", "main")
    .order("evidence_count", { ascending: false })
    .limit(15);
  groundedFlies = (flies as any[]) ?? [];
}
```

`suitability='main'` is the gold-tier set. There are typically 30-60 `main` patterns per (water_type, month). 15 is enough breadth without bloating the prompt.

### 3. Inject the grounded fly list into the system prompt

Replace the existing system prompt build with a context-aware variant:

```ts
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

When recommending flies, draw FROM THE GROUND TRUTH LIST above where possible. If the question is genuinely off-topic from the ground truth (e.g. about presentation, not patterns), you can answer normally without citing flies.

Output ONLY this exact JSON shape (no markdown):
{"narrative": "...", "chips": [...], "confidence": "high"|"medium"|"low"}`;
```

### 4. Set `confidence` based on grounding

If `groundedFlies.length > 0`, the post-LLM `confidence` value should default to `"high"` (we're grounded in real data). Without grounding, fall back to `"medium"` or `"low"`.

After parsing the LLM response:

```ts
if (typeof parsed.narrative === "string") narrative = parsed.narrative;
if (Array.isArray(parsed.chips)) chips = parsed.chips.slice(0, 5);

// Confidence: grounded → high (override the model's guess unless it explicitly says low)
const grounded = groundedFlies.length > 0;
if (parsed.confidence === "low") {
  confidence = "low";
} else {
  confidence = grounded ? "high" : (parsed.confidence === "high" ? "medium" : "medium");
}
```

The model is good at explaining; it's not good at judging its own confidence. Override with the grounding signal.

### 5. Persist the grounding signal

Add the grounding info to the `user_queries` insert so the log captures whether ground truth was used:

```ts
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
  // NEW — grounding metadata for debugging quality
  grounding: grounded ? {
    water_type_id: waterTypeId,
    water_type: waterTypeLabel,
    month: monthIdx,
    fly_count: groundedFlies.length,
  } : null,
})
```

If `user_queries.grounding` column doesn't exist yet, **add it via a quick migration** (it's a debug column, not critical-path):

```sql
ALTER TABLE public.user_queries ADD COLUMN IF NOT EXISTS grounding JSONB;
```

Apply the ALTER alongside the function deploy.

---

## Verification

1. **Build / deploy:** edge function deploys cleanly. Schema migration runs.
2. **Wensum + mid-May test (the original bug):**
   - On the live preview, log in. Open an active session at River Wensum (or trigger a Dashboard query for "River Wensum" + a mid-May date).
   - Ask the ghillie: "What flies should I try mid-May here?"
   - Confirm the narrative includes **Mayfly** (any of: Natural Mayfly / Mayfly Spinner / Spent Mayfly Dapping Pattern / Gosling). Plus other `main` chalkstream-May patterns: Parachute Adams, Pheasant Tail, Black Gnat, Klinkhamer, Hopper, etc.
   - Confirm the response chips include at least one fly from the ground-truth list.
   - Confirm `confidence: "high"` on the response.
3. **Ground-truth metadata in `user_queries`:**
   ```sql
   SELECT venue_name, confidence, grounding, answer_narrative, answer_chips
   FROM user_queries
   WHERE user_id = auth.uid()
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   Expect `grounding` to be a JSON object with `water_type_id: 4, water_type: "River - Chalkstream", month: 5, fly_count: 15`.
4. **Stillwater test:**
   - Ask about Grafham Water in May. Expect Buzzer / Diawl Bach / Cormorant / Booby / Pheasant Tail Nymph in the recommendations (stillwater-May `main` patterns).
   - Confirm the response is grounded for `water_type_id: 2, month: 5`.
5. **Home / no venue:**
   - Open the AskGhillieOverlay from a Home session. Ask a generic question.
   - The edge function won't resolve a `water_type_id` (no venue). Confirm it falls through to ungrounded mode — narrative still renders but `confidence: "medium"` or `"low"`, no `grounding` metadata in the persisted row.
6. **Off-topic question:**
   - Ask "How do I tie a clinch knot?" on a Wensum session.
   - Confirm the response answers the knot question (using the model's knowledge) without forcing a fly recommendation.

---

## Out of scope

- Per-fly `evidence_count` and `source` are pulled but not surfaced to the LLM beyond ranking. If you want richer prompts ("Mayfly has 47 confirmed catches in May on chalkstream over the last 5 seasons"), separate prompt later.
- Real-time hatch detection from `weather_snapshot` (e.g. "warm overnight + bright morning = strong olive hatch") — out of scope; ground truth alone is the win.
- Mayfly-specific seasonality nuance (peak May 15-25 on chalkstreams, earlier on freestone) — the LLM can pick this up from the grounded list + month context.
- Pre-session vs mid-session prompt differentiation — same grounding works for both.
- Caching: there's already a `cached_until` field on `user_queries`. Not changed in this prompt.
- The `archetype` path in `get-ai-advice-v2` (146 §6) — that already aggregates from `reports_enriched` which is sparser than `fly_water_type_monthly`. After this prompt lands, consider switching the archetype path to also use `fly_water_type_monthly` for richer recommendations on Home queries. Separate prompt.

---

## Response capture

Per protocol 128, write to `lovable instructions/responses/152_response.md`:

- Pre-flight grep findings + the migration SQL applied for `user_queries.grounding` (or "column already exists" if it does).
- Diff summary: full before/after of the systemPrompt build, the venue-lookup block, and the persistence change.
- **The Wensum test** — paste the full request/response from §Verification.2 verbatim (raw JSON request body, raw response narrative + chips). This is the artefact that proves the bug is fixed.
- DB row from §Verification.3 showing `grounding` populated with the chalkstream-May metadata.
- One regression check: a stillwater query (Grafham Water + May) — confirm the response shifts to stillwater `main` patterns (Buzzer, Diawl Bach, etc.) and `grounding.water_type_id = 2`.
- Anywhere the prompt template needed adjustment — show the actual final systemPrompt content.
