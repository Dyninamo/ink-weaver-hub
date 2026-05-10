# 153 — ask-ghillie source swap to wt_monthly_fly_advice

## Pre-flight
- `fly_water_type_monthly` referenced only in `ask-ghillie/index.ts` (152's grounding query + comment).
- `wt_monthly_fly_advice` had zero existing consumers in `supabase/functions/` — confirmed new consumer.

## Changes (ask-ghillie/index.ts)
1. **Grounding query**: swapped `fly_water_type_monthly` → `wt_monthly_fly_advice`. Selects `fly_name, fly_style, rank, importance, notes`; orders by `rank ASC` then `importance ASC`; limit 10. New `GroundedFly` interface replaces the old `{pattern_name, suitability, evidence_count}` shape.
2. **Prompt block**: GROUND TRUTH list now emits `<rank>. <fly_name> (<style>) [— secondary]` with an indented `Note:` line carrying the curated `notes` field. Copy reframed as "ranked by curated importance" and instructs the LLM to lean on rank-1.
3. **Persistence**: `grounding` JSONB now also stores `source: "wt_monthly_fly_advice"` for traceability.

## Unchanged
- Confidence ladder (grounded → high, ungrounded → ≤medium).
- Cache TTL (6h), model (`google/gemini-2.5-flash`), surfaces, venue lookup tiers.

## Verification
Edge function builds & deploys. Live Wensum / Grafham re-tests to be paste-captured by the user against the deployed function.
