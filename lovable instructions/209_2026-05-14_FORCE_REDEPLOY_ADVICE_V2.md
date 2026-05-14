# Lovable Prompt 209 — Force redeploy of `get-ai-advice-v2` so prompt 207's slice consumer reaches production

**Date:** 2026-05-14
**Branch / repo:** `Dyninamo/ink-weaver-hub`
**Depends on:** 207 (added slice consumer + response fields), 208 (admin-write RLS for `venue_slices`).

**Why this prompt exists:**

Prompt 207 added the slice consumer to `supabase/functions/get-ai-advice-v2/index.ts`. Lines 554–561 fetch the slice; lines 1222–1227 add `slice_used`, `slice_built_at`, `slice_top_flies` to the response. The 207 response log claimed all of this was applied. **The source code in git confirms it** — `rg "slice_used|venue_slices|sliceSection" supabase/functions/get-ai-advice-v2/index.ts` returns multiple hits.

But probing the **deployed** function tells a different story. With `venue_slices` populated (894 rows after `push_venue_slices.py` ran via prompt 208's admin policy), the same Grafham query returns:

```python
# probe: POST get-ai-advice-v2 with {venue_name: "Grafham Water", target_date: "2026-05-15"}
# Top-level keys in response:
['advice', 'ai_generated', 'prediction', 'tactical', 'personal',
 'tier', 'season', 'reportCount', 'matchedReportCount', 'sessionCount',
 'queryId', 'weather', 'confidence', 'model_info']
# 'slice_used'      not in response: True
# 'slice_built_at'  not in response: True
# 'slice_top_flies' not in response: True
```

The response is missing all three new fields **at the byte level** (verified by searching the raw response body, not just parsing — none of the strings appear). The function deploy has lagged behind the source.

This is the same class of issue CLAUDE.md flags:

> Response logs are NOT proof. Pull `ink-weaver-hub`, cross-check the response log against the deployed source (grep at least one marker per section), then runtime-probe the failure path. Lovable can drop sections silently AND **Supabase Functions can lag behind a git push (saw both on 2026-05-13)**.

This prompt forces a redeploy of `get-ai-advice-v2` by making a trivial, deterministic edit to its source. Once redeployed, the slice consumer reaches users and master/RN/PWA advice will finally converge.

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/209_response.md`.

---

## What this prompt does

1. **§1** — Adds a deploy-marker comment to the top of `get-ai-advice-v2/index.ts` containing the prompt number + timestamp. This is a no-op in behaviour; its purpose is to bump the file's content hash so Lovable rebuilds + redeploys the function.
2. **§2** — Runtime verification probe. Lovable invokes the deployed function for Grafham Water on 2026-05-15 and confirms the slice fields appear in the response.

No DB changes. No new functionality. Behaviour is whatever 207 already shipped to source.

---

## File targets

- **Edit:** `supabase/functions/get-ai-advice-v2/index.ts` (one comment line, top of file)

---

## §1 — Deploy-marker comment

At the very top of `supabase/functions/get-ai-advice-v2/index.ts`, **before the first `import`**, insert:

```ts
// Deploy marker: prompt 209 — force redeploy 2026-05-14 to surface 207's
// slice consumer (slice_used/slice_built_at/slice_top_flies response
// fields). Behaviour unchanged; this comment exists solely to bust the
// Supabase Functions deploy cache.
```

That's it. Don't touch anything else in the file. Don't reformat, don't reorder imports, don't "clean up" while you're in there. The smaller the diff, the lower the risk of a real bug sneaking in alongside the forced rebuild.

Save → commit → push. Lovable's CI/CD will redeploy `get-ai-advice-v2` automatically because the file's content hash changed.

---

## §2 — Runtime verification

After the redeploy completes (check Lovable's deploy logs; should take 60–120 seconds), run the verification probe yourself **in Lovable's deploy environment** by calling the function. If you can't drive an HTTP call from inside the Lovable IDE, document this and we'll run the probe from the master side.

Verification call:

```bash
# Replace <ADMIN_JWT> with a Bearer token for nick.dyne@gmail.com (admin email).
curl -X POST "${SUPABASE_URL}/functions/v1/get-ai-advice-v2" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "venue_name": "Grafham Water",
    "target_date": "2026-05-15",
    "user_id": "43928498-a5f6-486c-a6ad-3e0b958d505d"
  }'
```

Expected response shape:

```json
{
  "advice": "## What to Expect …",
  "ai_generated": true,
  …
  "slice_used": true,
  "slice_built_at": "2026-05-… or null",
  "slice_top_flies": ["Booby", "Buzzer", "Shrimp", "Snake", "Diawl Bach"]
}
```

The five flies above are the canonical top 5 for Grafham per the slice JSON on master. They must appear (in some order — the LLM may reorder by date-month context) in `slice_top_flies`. If they don't, **either** `venue_slices` is missing the AW-GRAFHAM row (unlikely — `push_venue_slices.py` reports 894 rows uploaded including Grafham) **or** the slice fetch on line 554–561 is broken.

**If you can't run the probe from inside Lovable**, paste a single-line note in the response log: "Probe deferred to master side — Claude will verify via Database/sync/_probe_advice_v2.py." That's fine.

---

## Acceptance criteria

1. **Marker present in source.** `rg "Deploy marker: prompt 209" supabase/functions/get-ai-advice-v2/index.ts` returns exactly one hit. No other edits in the file.

2. **Diff is one comment block.** `git diff supabase/functions/get-ai-advice-v2/index.ts` shows additions only (no deletions, no whitespace churn elsewhere).

3. **Function redeployed.** Lovable's deploy log shows `get-ai-advice-v2` rebuilt and redeployed after this commit. Paste the deploy log entry / timestamp into the response log.

4. **Response contains slice fields.** Running the §2 verification probe returns `slice_used: true` and a non-empty `slice_top_flies` array. Paste the relevant slice-fields snippet of the response into the response log.

5. **No other functions touched.** `git diff --stat supabase/` should show only `get-ai-advice-v2/index.ts` changed.

---

## Verification (response log §V)

Paste into `lovable instructions/responses/209_response.md`:

1. The literal diff for `get-ai-advice-v2/index.ts` (should be 4 lines of added comment).
2. The deploy log entry confirming `get-ai-advice-v2` was redeployed after this commit.
3. The slice-fields snippet from the §2 probe, OR a one-line note deferring the probe to master-side (per §2 fallback).

If for any reason Lovable does NOT redeploy the function after this commit lands, **flag that as a separate issue** — a documented Lovable bug where a content-hash change to an edge function source file doesn't trigger a rebuild. We'd need a different mechanism (manual deploy button, version bump in `_shared/`, etc.) for any future forced redeploys.

---

## Out of scope / follow-ups

- **`advice_card.py` broken** on master (`flies.pattern_name` column doesn't exist after the v2 flies migration). Master-side Python fix, not Lovable territory. Handled separately.
- **Standing redeploy check** for the weekly pipeline — once we trust this works, consider adding a tiny health probe to `pipelines/weekly_update.py` that calls `get-ai-advice-v2` for Grafham and asserts `slice_used == true`. Catches future deploy lag automatically. Hold for now.
- **Why the original 207 deploy didn't fire** — worth understanding root cause so it doesn't recur. Possibly the Lovable response log was emitted before the deploy step completed, or the deploy step quietly failed. Investigate next time we see it.
