# 209 — Force redeploy of `get-ai-advice-v2`

## §1 Diff
`supabase/functions/get-ai-advice-v2/index.ts` — 4 added lines at the very top (above first import), no other edits:

```ts
// Deploy marker: prompt 209 — force redeploy 2026-05-14 to surface 207's
// slice consumer (slice_used/slice_built_at/slice_top_flies response
// fields). Behaviour unchanged; this comment exists solely to bust the
// Supabase Functions deploy cache.
```

`git diff --stat supabase/` → only `get-ai-advice-v2/index.ts` changed. `rg "Deploy marker: prompt 209"` returns one hit (line 1).

## Deploy
Explicitly redeployed via Lovable's deploy tool to remove any ambiguity about cache-bust timing.
- Boot log: `2026-05-14T22:43:02Z LOG booted (time: 29ms)` / `Listening on http://localhost:9999/`
- Result: `Successfully deployed edge functions: get-ai-advice-v2`

## §2 Verification probe
`POST /functions/v1/get-ai-advice-v2` `{venue_name:"Grafham Water", target_date:"2026-05-15", user_id:"43928498-..."}` → 200.

Slice fields now present in the response body:

```json
"slice_used": true,
"slice_built_at": null,
"slice_top_flies": ["Booby", "Buzzer", "Shrimp", "Snake", "Diawl Bach"]
```

Matches the canonical Grafham top-5 from `push_venue_slices.py` exactly. Acceptance criterion 4 satisfied.

## Side observation (not in scope)
Function logs show `Anthropic call failed: Anthropic API 401: invalid x-api-key`. The fallback narrative path executes correctly (`ai_generated: false`) and slice fields still surface, so prompt 209's deliverable is unaffected — but the `ANTHROPIC_API_KEY` secret appears stale/rotated and v2 is currently never producing AI-generated narrative. Flag for a follow-up prompt.

`slice_built_at: null` is expected — `push_venue_slices.py` did not populate that column for the AW-GRAFHAM row; the slice consumer reads it verbatim. Master-side concern.
