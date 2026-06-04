# 215 — `session_trails` backend: RLS + `upload-diary-trail` edge fn

Groundwork for **GPS-derived catch placement** in the PWA (matches a feature
just built in the RN app). When an angler adds or edits a catch *after the fact*,
we place it on the map by interpolating the session's **GPS trail** against the
catch time. The `session_trails` table already exists in the schema but **nothing
reads or writes it** — it has no data and (almost certainly) no RLS policies.
This prompt makes the trail writable from both surfaces and readable by the
owner.

Two consumers will feed/read this table:
- **RN app** (records on the phone, trail lives in its local blob) → pushes the
  whole trail to Supabase via a new **`upload-diary-trail`** edge function on
  session sync.
- **PWA** (records in-browser, or edits later from a PC) → writes its own trail
  via RLS (prompt 216) and reads any session's trail via RLS (prompt 217).

## Part A — RLS on `session_trails`

`session_trails` columns (existing): `id, session_id, timestamp, latitude,
longitude, accuracy, altitude, compass_deg, light_lux, pressure_hpa, sort_order`.

Enable RLS and add **owner-scoped** policies, keyed through the parent session:
- **SELECT / INSERT / DELETE** allowed when the row's `session_id` belongs to a
  `fishing_sessions` row whose `user_id = auth.uid()`. Use an `EXISTS (SELECT 1
  FROM fishing_sessions s WHERE s.id = session_trails.session_id AND s.user_id =
  auth.uid())` predicate (the table has no own `user_id` column).
- No UPDATE policy needed (trail points are immutable; we replace, not edit).
- Service-role (the edge fn below) bypasses RLS as usual — fine.

Mirror however the project already scopes child-table RLS (check
`session_events`' policies and copy that pattern exactly).

## Part B — Edge function `upload-diary-trail`

Create `supabase/functions/upload-diary-trail/index.ts`. **Replace-semantics**:
a trail is a whole-track snapshot with no stable per-point id, so re-uploading
(e.g. after an edit) must be idempotent. So: **delete the session's existing
trail, then insert the supplied points** — inside the owner guard.

### Auth & CORS — match `upload-diary-events` / prompt 214 exactly
- Gate: accept **`X-Admin-Secret`** (back-office) OR **any signed-in user's
  Bearer JWT** (`requireUser` from `_shared/user_auth.ts`). Missing/invalid → 401.
  *(Same owner-or-admin model 214 applies to delete-diary-events — do NOT restrict
  the JWT path to `ADMIN_EMAILS`; the RN client sends a plain user token.)*
- Standard CORS + `OPTIONS`. Service-role client for the writes. Env via
  `requireEnv` — no sandbox defaults.

### Input (POST JSON)
```json
{ "session_id": "uuid", "points": [
  { "timestamp": "ISO", "latitude": 51.1, "longitude": -1.2, "accuracy": 8, "altitude": null }
]}
```
- `session_id` (required string).
- `points` (required array; **may be empty** = "this session has no trail",
  which still clears any stale trail). Cap at **MAX_POINTS = 5000** — reject 400
  if longer (a passive 30s-cadence trail never approaches this; the cap bounds a
  malformed payload). Each point: `latitude`/`longitude` finite numbers and
  `timestamp` a parseable string, else skip that point. `accuracy`/`altitude`
  optional → null.

### Behaviour
1. **Ownership guard** (same as 214): load `fishing_sessions` for `session_id`;
   404 if missing; if authed via user JWT, require `user_id === auth.uid()` else
   403; admin-secret skips the check.
2. `DELETE FROM session_trails WHERE session_id = <session_id>`.
3. Insert the validated points with `sort_order` = array index (after sorting by
   `timestamp` ascending, so order is chronological regardless of input order).
4. Return `{ "inserted": <n> }`, 200. Empty `points` → `{ "inserted": 0 }`, 200.

## After deploy — verify (don't trust the response log)
1. Pull `ink-weaver-hub`; confirm `supabase/functions/upload-diary-trail/` exists;
   grep for `requireUser`/admin-secret gate, the ownership 403, the delete-then-
   insert, and the `MAX_POINTS` cap. Confirm `session_trails` RLS policies exist
   (and reference `fishing_sessions.user_id = auth.uid()`).
2. **No creds → 401. Bogus Bearer → 401.**
3. With a user JWT: upload 3 points to that user's session → `{inserted:3}`;
   re-upload 2 points → `{inserted:2}` and exactly 2 rows remain (replace worked);
   upload `points:[]` → `{inserted:0}` and 0 rows remain.
4. **Cross-user negative:** user JWT targeting another user's `session_id` → 403,
   nothing written. And confirm RLS: a direct PostgREST `select` on
   `session_trails` as user A returns only A's sessions' rows.

## Context
- RN feeds this from `network/uploadTrail.ts` on sync (`EF_UPLOAD_TRAIL =
  'upload-diary-trail'`); failure is best-effort/queued, so the trail self-heals
  onto the backend once deployed — no migration.
- Consumed by PWA prompt 217 (`getSessionTrail` + `deriveFixFromTrail`).
