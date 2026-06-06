# 225 — Storage bucket hardening

One migration per finding, copying the avatars `(storage.foldername(name))[1] = auth.uid()::text` pattern.

## #9 diary-logs ownership
Dropped legacy `diary_logs_user_upload` / `diary_logs_user_update` (bucket-only check). Recreated with owner path check on both INSERT `WITH CHECK` and UPDATE `USING` + `WITH CHECK`.

## #10 diary-logs SELECT/DELETE
Added `diary_logs_user_select` and `diary_logs_user_delete` to authenticated, both gated on `bucket_id='diary-logs' AND foldername[1]=auth.uid()::text`.

## #11 session-transcripts owner-only
Dropped `Anon can insert into session-transcripts` and `Anon can upsert into session-transcripts`. Added owner-scoped `session_transcripts_user_{insert,select,update,delete}` (authenticated, path-ownership predicate).

**RN dependency (explicit)**: the React-Native companion app currently PUTs to `session-transcripts` with the anon key via `FishingDiary/src/network/supabaseClient.ts` (`putStorageObject`). Those uploads will **fail** until RN:
1. Uses the user's session JWT (not the anon key) for storage PUTs.
2. Uploads under an `${user.id}/...` path so the policy predicate matches.

This PWA codebase (`src/`) does not write to `session-transcripts`, so the live web app is unaffected.

## #21 avatars listing
Dropped `avatars_public_read` (was `USING (bucket_id='avatars')` → listed all files). Direct public-URL reads bypass storage RLS on public buckets, so avatar `<img>` tags continue to work; only anonymous *listing* of the bucket is now blocked.

## Verify
- Linter delta: 84 → 83 issues. No new ERRORs introduced.
- Owner-scoped pattern matches the existing `notable-fish` and `avatars_auth_*` policies.
- All four buckets (`avatars`, `diary-logs`, `session-transcripts`, `notable-fish`) now have only path-scoped writes from authenticated; only the public-bucket CDN path for `avatars` is anonymous.
