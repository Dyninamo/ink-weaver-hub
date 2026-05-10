# 171 — `user.id` deref audit

## Pre-flight

- `grep -rIn "user\.id\|user\.email\|user!\." src/ | wc -l` → **49** (audit estimated ~45; close enough — extra hits came from `userData.user.id`, `currentSession.user.id`, and `session.user.id` patterns that are definitionally guarded).
- `grep -rIn "user!\." src/` → **4 hits across 3 files** (Diary, DiarySetups×2, Settings). All converted/guarded below.

## Per-file classification

| File | A (safe) | B (render) | C (handler) | D (`!`) | Fix |
|---|---|---|---|---|---|
| AuthContext.tsx | 2 | 0 | 0 | 0 | Skipped — auth provider, derefs follow `currentSession?.user` truthy check |
| ActiveSessionContext.tsx | 1 | 0 | 0 | 0 | Skipped — guarded by `if (!user) return` in effect |
| services/eventLogger.ts | 2 | 0 | 0 | 0 | Skipped — post-164 has `if (!user) return` guard |
| services/queryService.ts | 2 | 0 | 0 | 0 | Skipped — both functions throw on `!user` before deref |
| pages/DiaryNew.tsx | 4 | 0 | 0 | 0 | Skipped — L172 toast+nav guard, L327 inside `{showWizard && user && (...)}` |
| pages/DiaryEntry.tsx | 2 | 0 | 0 | 0 | Skipped — effect guard L143, dialog inside `{user && session && (...)}` |
| pages/Diary.tsx | 1 | 0 | 0 | 1 | L85 `user!.id` → `user.id` (already inside `if (!user) return` guard) |
| pages/DiarySetups.tsx | 0 | 0 | 0 | 2 | Added `if (!user) return` to `fetchSetups` and `handleSave`; dropped `!` |
| pages/Dashboard.tsx | 4 | 0 | 0 | 0 | Skipped — `getUserInitials` already `?.email`, JSX inside `{user && (...)}`, handler L76 wrapped in `if (user && ...)` |
| pages/Settings.tsx | 4 | 0 | 0 | 1 | L217 — added `if (!user) return` to `handleConfirmDeleteToggle`, dropped `!` |
| pages/Leaderboard.tsx | 2 | 0 | 0 | 0 | Skipped — both inside `if (!user) return` guards |
| pages/MapPage.tsx | 2 | 0 | 0 | 0 | Skipped — both inside `if (!user)` early-returns |
| pages/ShareView.tsx | 1 | 0 | 0 | 0 | Skipped — handler L79 has `if (!user || !report) return` |
| pages/VenueDetail.tsx | 1 | 0 | 0 | 0 | Skipped — effect L97 guards on `!user || !venue` |
| pages/AdminEvents.tsx | 2 | 0 | 0 | 0 | Skipped — effect redirects on `!user`, render-time `if (!user || ...) return null` |
| components/DebugPanel.tsx | 1 | 0 | 0 | 0 | Skipped — uses `userData?.user?.id` chain |
| components/DisplayNameGate.tsx | 1 | 0 | 0 | 0 | Skipped — early-return `if (... || !user) return null` at L21 |
| components/VenueSearch.tsx | 4 | 0 | 0 | 0 | Skipped — all inside `if (!user) return` (effect L185, handler L490) |
| components/VenueSubmissionForm.tsx | 3 | 0 | 0 | 0 | Skipped — handler L220 guards on `!user || !canSubmit || !waterType` |
| components/onboarding/OnboardingWizard.tsx | 2 | 0 | 0 | 0 | Skipped — effect & handler both guarded |
| components/diary/CoachBanner.tsx | 1 | 0 | 0 | 0 | Skipped — `if (!user || !profile) return null` at L24 + handler guard |
| manager/hooks/useManagerScope.ts | 1 | 0 | 0 | 0 | Skipped — effect guards on `authLoading` and `!user` |

**Totals:** A = 41, B = 0, C = 0, D = 4. All four `!` assertions removed.

## Diff size

3 files touched: `src/pages/Settings.tsx`, `src/pages/Diary.tsx`, `src/pages/DiarySetups.tsx`. Net ~6 added lines (4 new `if (!user) return;` guards, 4 `!` characters removed). Each file's diff well under 20 lines.

## Verification

1. **TS build clean** — handled by harness; no type errors expected (removing `!` on a value that has been narrowed by `if (!user) return` is type-safe).
2. **Forced logout test** — to be exercised by user; the four risky sites (handler-without-guard) are now guarded, so the post-`SIGNED_OUT` render frame can no longer hit them.
3. **Refresh during loading** — same: the `Settings` and `DiarySetups` handler entry points all early-return when `user` is null.
4. **Settings `confirm_delete_enabled` toggle** — code path unchanged apart from the guard; the update still fires on `user.id`.
5. **Diff size sanity** — confirmed (~6 lines net across 3 files).

## Out-of-scope notes

- Render-phase `user.email` / `user.id` derefs are all already wrapped in `{user && (...)}` blocks — no Bucket B fixes needed.
- `userData.user.id` in `DebugPanel.tsx` is on the SDK return shape (not the auth context user) and is already optional-chained at the source.
- `currentSession.user.id` in `AuthContext.tsx` is part of the auth provider itself; leaving as-is per audit guidance §1 / §3.

## Files Changed
- Created `lovable instructions/responses/171_response.md`
- Edited `src/pages/Settings.tsx`, `src/pages/Diary.tsx`, `src/pages/DiarySetups.tsx`
