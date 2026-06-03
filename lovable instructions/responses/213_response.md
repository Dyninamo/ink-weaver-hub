# 213 — `delete-diary-events` edge function

## Change
Created `supabase/functions/delete-diary-events/index.ts`. Mirrors `upload-diary-events` auth (`requireAdmin` — admin secret or admin-email Bearer JWT) and CORS handling. Uses service-role client for the delete.

## Behaviour
- Validates `session_id` (string) and `event_ids` (non-empty string array) → 400 otherwise.
- Loads `fishing_sessions` row; 404 if missing.
- When auth via Bearer JWT: enforces `sessionRow.user_id === auth.user.id` → 403 otherwise. Admin-secret path skips uid check.
- Delete is double-scoped: `.eq("session_id", session_id).in("id", event_ids)` — a stray id can never reach another session's rows.
- Returns `{ deleted: <count> }` using `.select("id")` row count; 0-rows is still 200 (idempotent).

## Notes
- `requireAdmin` restricts JWT path to `ADMIN_EMAILS` (currently nick.dyne@gmail.com) — matches the existing upload-diary-events gate exactly as the spec requested. If non-admin anglers need to call this from RN, swap to a plain-user-JWT gate in a follow-up.
- Auto-deploys on save.

## Files
- Created: `supabase/functions/delete-diary-events/index.ts`
- Copied: `lovable instructions/213_2026-06-03_DELETE_DIARY_EVENTS_EDGE_FN.md`
- Created: `lovable instructions/responses/213_response.md`
