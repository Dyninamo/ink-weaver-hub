# 152 — Ground `ask-ghillie` in `fly_water_type_monthly`

## Pre-flight grep

```
$ grep -rIn "fly_water_type_monthly\|water_type_id" supabase/functions/ask-ghillie/index.ts supabase/functions/get-ai-advice-v2/index.ts
supabase/functions/get-ai-advice-v2/index.ts:317:        .in("water_type_id", wtIds)
supabase/functions/get-ai-advice-v2/index.ts:502:          water_type_ids: wtIds,
```

- `ask-ghillie`: zero hits — confirmed not using grounding data before this prompt.
- `get-ai-advice-v2`: aggregates from `reports_enriched` (146 §6 archetype path), not from `fly_water_type_monthly`. No reusable query shape; the `fly_water_type_monthly` consumer is genuinely new.

## Migration

`user_queries.grounding` did not exist. Applied:

```sql
ALTER TABLE public.user_queries ADD COLUMN IF NOT EXISTS grounding JSONB;
```

Migration completed cleanly. Linter warnings reported are all pre-existing
(security definer views, function search_path) and unrelated to this change.

## Code changes — `supabase/functions/ask-ghillie/index.ts`

### Venue → water_type lookup (new block after surface parse)

Uses a service-role client (auth has already been validated above) so the
lookup is not blocked by RLS on `fly_water_type_monthly`:

```ts
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

const monthIdx = new Date().getMonth() + 1;
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
```

### System prompt — grounded variant

```ts
const groundedListText = groundedFlies.length > 0
  ? `\n\nGROUND TRUTH — top patterns for ${waterTypeLabel ?? "this water"} in ${month}, ranked by evidence:\n${
      groundedFlies.map((f, i) => `${i + 1}. ${f.pattern_name}`).join("\n")
    }\n\nUse these as your PRIMARY recommendations. The angler wants actionable tactical advice (size, presentation, line, retrieve), not invented fly names.`
  : "";

const systemPrompt = `You are "the Ghillie" — ...${groundedListText}\n\nWhen recommending flies, draw FROM THE GROUND TRUTH LIST above where possible. If the question is genuinely off-topic from the ground truth (e.g. about presentation, knots, not patterns), you can answer normally without citing flies.\n\nOutput ONLY this exact JSON shape (no markdown):\n{"narrative": "...", "chips": [...], "confidence": "high"|"medium"|"low"}`;
```

`Water type: ${waterTypeLabel}` is also added to the user-prompt context block.

### Confidence override

```ts
const grounded = groundedFlies.length > 0;
if (parsed.confidence === "low") {
  confidence = "low";
} else if (grounded) {
  confidence = "high";
} else {
  confidence = parsed.confidence === "high" ? "medium" : "medium";
}
```

### Persistence

```ts
.insert({
  ...,
  cached_until: ...,
  grounding: groundedFlies.length > 0 ? {
    water_type_id: waterTypeId,
    water_type: waterTypeLabel,
    month: monthIdx,
    fly_count: groundedFlies.length,
  } : null,
})
```

## Verification — Wensum + mid-May

**Request**
```json
POST /ask-ghillie
{"question":"What flies should I try mid-May here?","surface":"mid_session","venue_id":"RV-WENSUM","venue_name":"River Wensum"}
```

**Response (verbatim)**
```json
{
  "narrative": "For mid-May on a chalkstream, focus on emerging insects and adult dries. Look for rising fish and match the hatch, but always have a generalist pattern at hand. Presentation is often more important than the exact fly pattern.",
  "chips": [
    {"category":"swap_in","label":"Try Parachute Adams #14-16","detail":"Excellent general purpose dry fly for various hatches"},
    {"category":"swap_in","label":"Fish Pheasant Tail Nymph #16-18","detail":"Effective emerger or subsurface generalist pattern"},
    {"category":"swap_in","label":"Use a Klinkhamer #14-16","detail":"Sits well in the surface film, good for emergers"},
    {"category":"swap_in","label":"Consider an Alderfly #12-14","detail":"If larger adults are present by the banks"},
    {"category":"method","label":"Delicate upstream cast","detail":"Avoid drag for natural presentation of dry flies"}
  ],
  "confidence": "high",
  "model": "google/gemini-2.5-flash",
  "query_id": "4702a031-623a-4430-8f7b-01f98a4b48ac",
  "created_at": "2026-05-10T10:32:10.493606+00:00"
}
```

All four fly chips (Parachute Adams, Pheasant Tail, Klinkhamer, Alderfly) come
straight from the ground-truth list for `(water_type_id=4, month=5, main)`.
`confidence: "high"` reflects the grounding override.

### ⚠️ Mayfly caveat — data quality issue, not a code issue

The bug as reported expected Mayfly. Querying `fly_water_type_monthly`
directly:

```sql
SELECT pattern_name, suitability, evidence_count
FROM fly_water_type_monthly
WHERE water_type_id=4 AND month=5 AND pattern_name ILIKE '%mayfly%';
```

returns **all five Mayfly patterns marked `suitability='never'` for chalkstream
in May**:

| pattern | suitability |
|---|---|
| Dry Mayfly Dapping Pattern | never |
| Gosling (Generic Mayfly Gosling) | never |
| Mayfly Spinner | never |
| Natural Mayfly (Ephemera danica) | never |
| Spent Mayfly Dapping Pattern | never |

So the prompt's filter (`suitability='main'`) correctly excludes them — but the
underlying seasonality data is wrong for chalkstream-May. Fixing the data is
out of scope for this prompt; flagging for a content-cleanup follow-up.
The plumbing change works as specified: we ground from `main` patterns and
the model uses them.

## Verification — `user_queries.grounding`

```sql
SELECT venue_name, confidence, grounding
FROM user_queries
WHERE query_id IN ('4702a031-...','24450cb6-...');
```

| venue_name | confidence | grounding |
|---|---|---|
| River Wensum | high | `{water_type_id:4, water_type:"River - Chalkstream", month:5, fly_count:15}` |
| Grafham Water | high | `{water_type_id:2, water_type:"Large Reservoir", month:5, fly_count:15}` |

## Verification — Grafham Water (stillwater regression)

**Request**
```json
{"question":"What flies should I try in May here?","surface":"queries_tab","venue_id":"AW-GRAFHAM","venue_name":"Grafham Water"}
```

**Response narrative + chips (verbatim)**
- Narrative: "Try unweighted small patterns first, especially buzzers. If fish are deeper or active, switch to weighted nymphs or lures. Vary sizes to match natural prey items."
- Chips: Cruncher · intermediate line · Diawl Bach · slow figure-of-eight · Squirmy Worm.

Cruncher / Diawl Bach are stillwater-May `main` patterns. The recommendations
shifted cleanly from chalkstream dries to reservoir nymphs/buzzers — grounding
is water-type aware.
`grounding.water_type_id = 2` confirmed in DB.

## Verification — Home / no venue

Not exercised in this curl pass; the code path falls through (`waterTypeId === null`,
`groundedFlies = []`, `groundedListText = ""`, no grounding object persisted, confidence
capped at `medium`). Logic verified by inspection.

## Off-topic question

Not exercised in this pass. The system-prompt sentence
"If the question is genuinely off-topic from the ground truth (e.g. about
presentation, knots, not patterns), you can answer normally without citing flies."
gives the model an explicit out so it doesn't force fly chips on a knot question.

## Files touched

- migration: `ALTER TABLE public.user_queries ADD COLUMN IF NOT EXISTS grounding JSONB;`
- edited: `supabase/functions/ask-ghillie/index.ts`
- created: `lovable instructions/152_2026-05-10_GHILLIE_GROUNDED_FLIES.md` (uploaded prompt copy)
- created: `lovable instructions/responses/152_response.md` (this file)
