# 176 — Prevent concurrent active sessions

## Migration
- Single migration: cleanup CTE → partial unique index `uniq_user_active_diary_session ON fishing_sessions(user_id) WHERE is_active=true AND source='diary'`.
- Pre-cleanup row counts: 1 affected user (`43928498-…`) had 2 active diary sessions; older one closed (is_active=false, end_time/duration backfilled). Post: 0 users with >1 active.

## Code
- `src/pages/DiaryNew.tsx`
  - Imports: added `AlertDialog*`, `formatDistanceToNow`, `endSession`.
  - State (~L79): `pendingActiveConflict`, `pendingCommit`.
  - L183-208: `handleCommit` now does an `is_active=true` preflight per user before any GPS/insert work; on conflict it stashes the commit and opens the modal.
  - L210-onwards: extracted `proceedWithCreate(commit)` containing the original insert flow.
  - Catch block: added 23505 / `uniq_user_active_diary_session` branch → toast + redirect to `/diary` instead of generic error.
  - Modal (`conflictModal`) rendered in both wizard and basics views: Cancel / Resume existing (`navigate(/diary/:id)`) / End existing & start new (`endSession` + `proceedWithCreate(pendingCommit)`).
- `src/pages/Diary.tsx` L326-339: "New" button onClick checks `activeSession`; if present, toast.info instead of navigating, since the Resume/Discard banner above already provides the resolution UI.

## Smoke test (expected)
1. No active → New → form loads. ✓
2. Start session, return to `/diary` → banner appears. ✓
3. Tap New on `/diary` → toast "You already have an active session…". ✓
4. Reach `/diary/new` directly + complete wizard → preflight modal opens with 3 options.
5. End existing & start new → previous flips `is_active=false`, new session inserts cleanly.
6. Two-tab race → DB unique index throws 23505 → toast + redirect to `/diary`.

## Verification
`SELECT user_id, count(*) FROM fishing_sessions WHERE is_active=true AND source='diary' GROUP BY user_id HAVING count(*)>1;` → 0 rows.
