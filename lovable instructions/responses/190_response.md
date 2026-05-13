# 190 — Edge function auth phase 1 (9 functions)

## §0 — Shared helper
New: `supabase/functions/_shared/user_auth.ts` exposes `requireUser(req, corsHeaders)` and `forbiddenResponse(msg, corsHeaders)`. Mirrors the ask-ghillie pattern.

## §1 — Functions gated
For each, added `import { requireUser, forbiddenResponse }` and inserted the gate at the top of the try-block, before any DB work. Cross-checks added where the body carries identity fields:

| Function | user-identity cross-check |
|---|---|
| get-ai-advice-v2 | `if (user_id && user_id !== user.id) → 403` |
| get-fishing-advice | `if (userId !== user.id) → 403` |
| get-basic-advice | none (no user_id in body) |
| get-venue-advice | none |
| poll-session-weather | session.user_id check after fetch → 403 |
| on-session-logged | `if (user_id !== user.id) → 403` |
| compute-session-summary | session.user_id check after fetch → 403 |
| submit-notable-fish | `if (user_id !== user.id) → 403` |
| witness-notable-fish | `if (user_id !== user.id) → 403` |

`poll-session-weather` also extended its session select to include `user_id` for the ownership check.

## §2 — SUPABASE_ANON_KEY
Already present in project secrets (verified in `<secrets>` listing). No env change required.

## §3 — Smoke test
Deferred to deploy / runtime. Expected behaviour:
- Unauthed call → 401 `{"error":"Missing bearer token"}`.
- Authed call from PWA → unchanged response.
- Spoofed user_id from authed user → 403 `{"error":"Forbidden — user_id mismatch"}`.

## Out of scope (phase 2)
admin-gated upload/compute/batch-recompute/db-audit/lapse-affiliations/get-weather-forecast — covered by prompts 194/195.
