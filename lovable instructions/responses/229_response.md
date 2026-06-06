# 229 — admin-upsert edge function

## Created
- `supabase/functions/admin-upsert/index.ts` — mirrors `admin-dump-diary` (228): `requireAdmin` (X-Admin-Secret OR admin-email JWT), CORS + OPTIONS, service_role client, `requireEnv`/`envErrorResponse`.

## Contract
- POST `{ table, rows, on_conflict? }`.
- `table` must be in hard-coded `ALLOWED_TABLES` (22 entries per prompt) else 400 `table '...' not in allowlist`.
- `rows` non-empty array, capped at `MAX_ROWS = 1000` → 400 otherwise.
- `on_conflict` optional string → passed to `supabaseAdmin.from(table).upsert(rows, { onConflict })`; omitted → plain `.upsert(rows)`.
- Success: `{ table, upserted: rows.length }`. PostgREST errors surfaced 400 (permission/violation) or 500.

## Expected smoke
- No creds → 401 (admin_auth).
- Bogus `X-Admin-Secret` → 401.
- Valid secret + `table=station_registry`, 1 row → 200 `{upserted:1}`.
- `table=bobby_tables` → 400.
- 1001 rows → 400.

Edge fn auto-deploys. **230 must NOT be applied until master writers (`Database/sync/push_*.py`, `Database/upload_*.py`) are converted to call this fn and smoke-tested.**
