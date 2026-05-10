# 170 — Service-role key validation in edge functions

## Pre-flight grep
`SUPABASE_SERVICE_ROLE_KEY` is read in 30+ edge functions. Most use bare `!` (throws nothing) or `?? ''` (silently downgrades).

Functions that depend on service-role for RLS bypass and should fail fast:
- `get-ai-advice-v2/index.ts` (lines 305, 518) — silent anon downgrade → archetype returns empty.
- `ask-ghillie/index.ts` (line 60) — explicit `?? SUPABASE_ANON_KEY` fallback → grounded fly lookup blocked silently.
- Others (`batch-recompute`, `compute-*`, `on-session-logged`, `poll-session-weather`, `submit-notable-fish`, `upload-*`, `find-venue-email`, `send-venue-report`, `get-basic-advice`, `get-venue-advice`, `get-fishing-advice`, `share-via-email`, `create-share-link`, `db-audit`, `lapse-affiliations`, `witness-notable-fish`, `generate-venue-cards`, `get-shared-report`) — same pattern, but **scoped out of this prompt** per §4 ("don't blanket-apply"). They are flagged for a follow-up audit; today's prompt explicitly targets the two Ghillie/advice surfaces.

## Diffs

### `supabase/functions/_shared/env.ts` (NEW)
Exports `MissingEnvError`, `requireEnv(name)`, and `envErrorResponse(err, corsHeaders)` which returns a 503 `{error: "service_misconfigured", message}` when the thrown error is a `MissingEnvError`, else `null`.

### `get-ai-advice-v2/index.ts`
- Added `import { requireEnv, envErrorResponse } from "../_shared/env.ts";`
- L303-306 and L516-519: `Deno.env.get(...)!` → `requireEnv(...)` for both `supabaseArch` and `supabase` clients.
- Outer `catch (err)` now calls `envErrorResponse(err, corsHeaders)` first and returns the 503 if matched, otherwise falls through to existing 500.

### `ask-ghillie/index.ts`
- Added `import { requireEnv, envErrorResponse } from "../_shared/env.ts";`
- L58-61: dropped the `?? SUPABASE_ANON_KEY` fallback; `adminClient` now uses `requireEnv("SUPABASE_URL")` + `requireEnv("SUPABASE_SERVICE_ROLE_KEY")`.
- Outer `catch` adds the same `envErrorResponse` short-circuit before the existing 500 path.

## Secret confirmation
`SUPABASE_SERVICE_ROLE_KEY` is listed in the project secrets inventory (per `<secrets>` block in system context) — it is set in production. No new secret added.

## Verification
- Build will validate type changes. Runtime curl traces deferred — happy path unchanged (helper just throws on empty/missing); forced-failure test would require unsetting the secret in a non-prod env.

## §4 client-side surfacing — scoped out
Did NOT modify `src/services/adviceService.ts` or `src/components/diary/AskGhillieOverlay.tsx`. Current handlers surface `error` as a generic toast; a 503 with `error: "service_misconfigured"` will still surface but without the bespoke "contact support" copy. Flagged as a small follow-up.

## §4 other functions — scoped out
Listed above; not touched this prompt.
