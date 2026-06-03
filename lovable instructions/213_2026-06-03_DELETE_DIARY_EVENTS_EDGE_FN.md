# 213 — Edge function: `delete-diary-events`

Create a new Supabase Edge Function **`delete-diary-events`** that deletes
specific `session_events` rows from a diary session. The mobile app needs this
because the angler can now **edit a past session and remove a catch** — and the
existing `upload-diary-events` UPSERTS by `id` (it never deletes), so a re-push
of the remaining events would leave the removed catch **orphaned** on the
backend. This function is the missing delete path.

## Auth & CORS (do NOT skip — match `upload-diary-events` exactly)

- **`requireAdmin`** — the SAME gate as `upload-diary-events` /
  `upload-diary-sessions` (accept EITHER an `X-Admin-Secret` header OR a Bearer
  JWT for an admin-email user). Reject with 401 otherwise. The RN client sends
  the signed-in user's access token (it does not ship the secret), so the JWT
  path must work.
- Standard CORS headers + `OPTIONS` preflight handling, identical to the other
  diary functions in this project.
- Read the Supabase URL + **service-role** key from env (`Deno.env.get`) for the
  actual delete, exactly as the upload functions do. No sandbox defaults / no
  hard-coded localhost.

## Input (POST JSON)

```json
{ "session_id": "uuid-of-the-session", "event_ids": ["uuid1", "uuid2"] }
```
- `session_id` (required) — the `fishing_sessions.id` the events belong to.
- `event_ids` (required, non-empty array) — the `session_events.id` values to
  delete. Validate: reject 400 if missing/empty or not strings.

## Behaviour

1. **Ownership guard.** Load `fishing_sessions` row for `session_id`.
   - If the request authenticated via **Bearer JWT** (not the admin secret):
     require `fishing_sessions.user_id == auth.uid()`. If it doesn't match,
     **403** (don't let one user delete another user's events). Return 404 if the
     session row doesn't exist.
   - If the request used the **admin secret**, skip the uid check (back-office).
2. **Scoped delete.** Delete from `session_events` WHERE
   `session_id = <session_id>` **AND** `id = ANY(<event_ids>)`. Always scope by
   BOTH columns — never delete by `id` alone — so a stray id can't reach another
   session's rows.
3. Idempotent: deleting ids that are already gone is fine (0 rows) — still 200.

## Response

```json
{ "deleted": 2 }
```
- `deleted` = number of rows actually removed. HTTP 200 on success (including
  the 0-rows case). 400 on bad input, 401 unauth, 403 wrong owner, 404 no session.

## After deploy — verify (do this, don't trust the response log)

1. Pull `ink-weaver-hub`, confirm `supabase/functions/delete-diary-events/`
   exists and grep for `requireAdmin`, `session_events`, `event_ids`, and that the
   delete is scoped by BOTH `session_id` and `id`.
2. Runtime probe **no-JWT / no-secret → must 401**.
3. With Nick's JWT: insert a throwaway catch into a test session via
   `upload-diary-events`, confirm it's there, then call `delete-diary-events`
   with that `{session_id, event_ids:[thatId]}` → expect `{ deleted: 1 }` and the
   row gone. Re-call the same payload → `{ deleted: 0 }`, still 200 (idempotent).
4. Negative: call with a `session_id` that isn't the caller's (and no admin
   secret) → must 403, and confirm nothing was deleted.

## Why this matters / context

- The app deletes locally immediately and **queues** the remote delete
  (`storage/pendingDeletes.ts`, calling this function as
  `EF_DELETE_EVENTS = 'delete-diary-events'`). Until this function exists, those
  calls 404 and the deletion stays queued; once deployed, the next edit/open
  flushes the backlog and orphans disappear — no migration needed.
- Pairs with the post-session catch-editing feature (add/edit ride the existing
  `upload-diary-events` upsert-by-id; only delete needed a new path).
