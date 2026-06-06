# 225 — Security: storage bucket hardening

From the 223 review. Separate migration per finding. Pattern to copy: the
**avatars** bucket's path-based ownership
(`(storage.foldername(name))[1] = auth.uid()::text`).

## #9 `diary_logs_bucket_missing_ownership_check`
`diary_logs_user_upload` / `diary_logs_user_update` check only `bucket_id` → any
authenticated user can overwrite any path. Add the owner path check to the
INSERT and UPDATE `WITH CHECK`/`USING`:
`(storage.foldername(name))[1] = auth.uid()::text`.

## #10 `diary_logs_bucket_missing_select_delete`
Private `diary-logs` bucket has no SELECT/DELETE policies → owners can't read or
delete their own files. Add owner-scoped SELECT + DELETE (same path-ownership
predicate).

## #11 `session_transcripts_bucket_missing_select_delete`
`session-transcripts` bucket: only INSERT/UPDATE exist and both are **anonymous
and unrestricted**. Remove the anon writes; add owner-scoped INSERT/SELECT/DELETE
with path ownership. **Check first** how transcripts are uploaded — RN's
`putStorageObject` currently PUTs with the anon key (see
`FishingDiary/src/network/supabaseClient.ts`); if so, this will require RN to
upload under an `auth.uid()/…` path with the user token. Flag that the RN side
needs a matching change, and DON'T enable it in a way that silently breaks
transcript upload — describe the dependency.

## #21 `SUPA_public_bucket_allows_listing`
A public bucket (likely `avatars`) has a broad SELECT on `storage.objects`
enabling listing of ALL files. Tighten SELECT to the needed path prefix, or
remove listing capability (keep direct object reads working for public avatars).

## Verify
- Pull repo; one migration per finding.
- As user A (JWT): can read/write/delete only `A/…` paths in diary-logs; cannot
  overwrite `B/…`. Anon cannot write `session-transcripts`.
- Public avatar URLs still load; bucket listing no longer returns all objects.
- Note any RN-side dependency (transcript upload path/token) created by #11.
