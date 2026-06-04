# 214 — `delete-diary-events`: open the JWT path to the session's owner

Follow-up to **213**. The `delete-diary-events` function currently gates with
`requireAdmin`, whose Bearer-JWT path only admits emails in `ADMIN_EMAILS`
(today just `nick.dyne@gmail.com`). That's fine while the diary is single-user,
but the moment a **non-admin angler** edits a session and removes a catch, the
RN app's delete call 403s ("Not an admin"), the deletion stays queued in
`storage/pendingDeletes.ts` **forever**, and orphaned `session_events` rows
accumulate silently on the backend.

Fix: let **any signed-in user delete events from their OWN session**, while
keeping the back-office admin-secret path intact. The ownership guard added in
213 already does the safety work — we just need to stop rejecting non-admin
JWTs before we reach it.

## The change (auth gate only — behaviour is otherwise unchanged)

Replace the single `requireAdmin(req)` call with a two-path gate:

1. **Admin-secret path (back-office, unchanged).** If the request carries an
   `X-Admin-Secret` header, validate it against `ADMIN_API_SECRET` exactly as
   `requireAdmin` does today. Valid → treat as **admin** (skip the ownership
   check, as now). Present-but-wrong → **401**. This keeps master-side scripts
   working.
2. **User-JWT path (NEW — any authenticated user).** If there's no admin secret,
   use the shared **`requireUser`** helper (`_shared/user_auth.ts`) instead of
   `requireAdmin`. ANY valid Bearer JWT is accepted (no `ADMIN_EMAILS` check).
   Missing/invalid token → **401**.

Then keep the **existing ownership guard** from 213, applied to the user-JWT
path only:
- Load the `fishing_sessions` row for `session_id`. Missing → **404**.
- If authed as a **user** (not the admin secret): require
  `fishing_sessions.user_id === <auth user id>`. Mismatch → **403**. This is
  what makes opening the gate safe — a user can only ever delete events from a
  session they own.
- If authed via the **admin secret**: skip the uid check (back-office).

Everything else stays exactly as 213 shipped it:
- Input validation: `session_id` (non-empty string) + `event_ids` (non-empty
  array of strings) → **400** otherwise.
- Delete **double-scoped**: `.eq("session_id", session_id).in("id", event_ids)` —
  never by `id` alone.
- Idempotent: deleting already-gone ids → `{ deleted: 0 }`, still **200**.
- Standard CORS + `OPTIONS` preflight. Service-role client for the delete.
  Env via `requireEnv` — no sandbox defaults.

> Note on the helper signatures: `requireAdmin` returns `{ ok, via, user }`;
> `requireUser(req, corsHeaders)` returns `{ user }` or `{ error: Response }`.
> Pick whichever composition is cleanest, but the resulting logic MUST be:
> admin-secret ⇒ skip ownership; any-valid-user-JWT ⇒ enforce ownership. Do not
> reintroduce an `ADMIN_EMAILS` restriction on the JWT path.

## After deploy — verify (don't trust the response log)

1. Pull `ink-weaver-hub`; in `supabase/functions/delete-diary-events/index.ts`
   confirm the `ADMIN_EMAILS` JWT restriction is gone (no `requireAdmin` on the
   no-secret path), the ownership guard is still present, and the delete is
   still double-scoped by `session_id` AND `id`.
2. **No creds → 401.** **Bogus Bearer → 401.** **Bogus admin secret → 401.**
3. With a **non-admin** test user's JWT: insert a throwaway catch into THAT
   user's session (via `upload-diary-events` admin path or a direct insert),
   then call `delete-diary-events` with `{session_id, event_ids:[thatId]}` →
   expect `{ deleted: 1 }`. Re-call → `{ deleted: 0 }`, still 200.
4. **Cross-user negative (the whole point):** with the non-admin user's JWT,
   target a `session_id` owned by a DIFFERENT user → must **403**, and confirm
   nothing was deleted.

## Related — NOT in this prompt (flagging for the record)

`upload-diary-sessions` and `upload-diary-events` share the identical
admin-only-JWT limitation: a non-admin angler can't push sessions/events at all
today. Before the diary actually goes multi-user, those two need the same
owner-scoped treatment (a user may only upsert rows where `user_id` is their
own). That's a larger review (the rows carry `user_id`, so the guard must reject
spoofed ids) and is deliberately out of scope here — this prompt only unblocks
the **delete** path that 213 introduced.
