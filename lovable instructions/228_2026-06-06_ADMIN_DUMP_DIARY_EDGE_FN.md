# 228 — Edge function: `admin-dump-diary` (master pull-back path for locked tables)

Prerequisite for **227**. Once 227 makes the diary tables owner-only, the master
pipeline can no longer read them with the anon key. Master has **no service_role
key and no Supabase dashboard access** — it authenticates to admin edge functions
with `X-Admin-Secret` (`ADMIN_API_SECRET`). This is the read-back path.

**Mirror the existing `admin-dump-app-events` function exactly** (prompt 200,
gated by 194's `requireAdmin`) — same auth, same pagination shape, same service_role
client.

## Auth & CORS
- `requireAdmin` (X-Admin-Secret OR admin-email JWT). Reject 401 otherwise.
- Standard CORS + `OPTIONS`.
- service_role client (bypasses RLS) for the reads — env via `requireEnv`, no
  sandbox defaults.

## Input (GET query params, like admin-dump-app-events)
- `table` (required) — **allowlist ONLY**: `fishing_sessions`, `session_events`,
  `session_trails`. Reject anything else with 400 (never interpolate an arbitrary
  table name).
- `limit` (default 1000, **`Math.min(limit, 5000)`** cap).
- `offset` (default 0) — keyset/offset paging; offset is fine here (master pulls
  the full table and inserts new-by-id).

## Behaviour
- `SELECT *` from the allowlisted table, `ORDER BY id`, `LIMIT`/`OFFSET`.
- Return `{ rows: [...], table, limit, offset }`. Master pages until a short page.
- No filtering by user — this is the admin/service back-office dump (same trust
  model as admin-dump-app-events).

## Verify (don't trust the apply log)
1. Pull `ink-weaver-hub`; confirm `supabase/functions/admin-dump-diary/` exists;
   grep `requireAdmin`, the table **allowlist**, and the `Math.min(...,5000)` cap.
2. No creds → **401**. Bogus secret → **401**.
3. With `X-Admin-Secret`: `?table=fishing_sessions&limit=2` returns rows;
   `?table=session_events&limit=2` returns rows; `?table=bobby_tables` → **400**.

## Context
Consumed by master `Database/sync/pull_diary.py` (to be converted from anon
PostgREST to this fn). After this is deployed + pull_diary converted + smoke-
tested, prompt **227** can safely drop the public-read policies.
