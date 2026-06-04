# 214 — delete-diary-events open to session owners

## Diff: `supabase/functions/delete-diary-events/index.ts`
- Replaced single `requireAdmin` call with a `gate(req)` helper that returns
  `{ ok:true, via:'secret' }` for `X-Admin-Secret` match (presented-but-wrong →
  401, missing-env → 401) or `{ ok:true, via:'user', userId }` via `requireUser`
  (no `ADMIN_EMAILS` restriction; missing/invalid Bearer → 401).
- Ownership guard from 213 retained verbatim: load `fishing_sessions`; 404 if
  missing; `g.via === 'user'` requires `sessionRow.user_id === g.userId`, else
  403. Admin-secret skips uid check.
- Validation, double-scoped delete (`session_id` AND `id`), idempotent
  `{ deleted: 0 }`, CORS, service-role client — all unchanged.

Edge function redeployed.
