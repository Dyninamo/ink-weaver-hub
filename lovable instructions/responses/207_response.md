# 207 — venue_slices table + get-ai-advice-v2 slice consumer

**Applied:** 2026-05-14
**Status:** applied

## §1 — Migration
Created `public.venue_slices` (venue_id PK text, slice jsonb NOT NULL, slice_built_at, updated_at), index on `slice_built_at`, RLS enabled, public-read + service-write policies, `venue_slices_touch_updated()` trigger on UPDATE. No FK to `venues_new` (per §1.1 recommendation).

### §1.2 verification
Columns:
```
venue_id        | text                     | NO
slice           | jsonb                    | NO
slice_built_at  | timestamp with time zone | YES
updated_at      | timestamp with time zone | YES
```
Policies:
```
Public can read venue_slices  | SELECT
Service write venue_slices    | ALL
```
Row count: `0` (empty as expected — master push fills it).

Linter: 94 pre-existing project-wide findings, none introduced by this migration (the new `USING (true)` SELECT policy is intentionally excluded by lint 0024; the new trigger function sets `search_path = public`).

## §2 — Edge function (`supabase/functions/get-ai-advice-v2/index.ts`)
- Slice fetch added immediately after `venueId` resolution (~line 547): `supabase.from("venue_slices").select("slice, slice_built_at").eq("venue_id", venueId).maybeSingle()` — gated on `venueId`, graceful null fallback.
- `sliceSection` template (top flies / methods / spots / monthly flies / hatches / venue_specific_advice) prepended to `aiPrompt` body.
- `sliceSystemHint` appended to the system instruction line; empty string when no slice → behaviour unchanged.
- Response payload extended with `slice_used`, `slice_built_at`, `slice_top_flies` (top 5 fly names).

## §3 — Telemetry (`src/services/adviceService.ts`)
v2 branch of `advice.received` now emits `slice_used`, `slice_top_flies`, `slice_built_at` from the response. v1 fallback branch unchanged (no slice path there).

## Acceptance
1. ✅ Table shape + 2 policies — see §1.2.
2. ✅ Row count 0.
3. ✅ `rg "venue_slices" supabase/functions/get-ai-advice-v2/index.ts` → slice fetch present.
4. ✅ `rg "Baked slice|sliceSection|venueSlice" …` → section + variable present.
5. ✅ `rg "slice_used|slice_top_flies|slice_built_at" …` → three response fields present.
6. ✅ Empty table → every venue currently goes through the `venueSlice = null` branch; `sliceSection`/`sliceSystemHint` resolve to empty strings, response includes `slice_used: false, slice_top_flies: [], slice_built_at: null`. No throw paths added.
7. ✅ `rg "slice_used" src/` → `src/services/adviceService.ts` (v2 branch).

## Files changed
- created `supabase/migrations/<timestamped>_venue_slices.sql` (via migration tool)
- edited `supabase/functions/get-ai-advice-v2/index.ts`
- edited `src/services/adviceService.ts`
- created `lovable instructions/207_2026-05-14_VENUE_SLICES_TABLE_AND_ADVICE_CONSUMER.md`
