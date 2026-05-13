# 178 — UX polish batch

## §1 — Delete Session button on every tab (DiaryEntry)
- `src/pages/DiaryEntry.tsx` L688-705: lifted Delete button out of the `{tab === "stats" && (...)}` block to a `{!isActive && (...)}` wrapper rendered after both per-tab JSX blocks. Visible on Timeline / Fish / Stats. Hidden during active sessions (ActiveSessionShell owns end flow).

## §2 — Friendly not-found / bad-id branches (DiaryEntry)
- L80: added `loadError: "not_found" | "bad_id" | "other" | null` state.
- L130-143: catch block classifies by `err.code` (PGRST116, 22P02) and message regex; only "other" still toasts.
- L241-265: split `loading` and `!session` branches; the latter renders a centered headline + body + "Back to diary" button keyed off `loadError`.

## §3 — Friendly 404 on /share/<bad-token> (ShareView)
- `src/pages/ShareView.tsx` L70-83: catch block now reads `err.context?.response?.status` and message regex to map to "expired/invalid", "no access", or generic "try again", instead of dumping `err.message`.

## §4 — aria-labels on icon-only controls
| File | Line | Control | aria-label |
|---|---|---|---|
| `src/pages/Diary.tsx` | 224-250 | Map / Sparkles / Settings2 header icons | "Open map" / "Ask the Ghillie" / "Saved rod setups" |
| `src/pages/Diary.tsx` | 538-558 | ChevronLeft / ChevronRight pagination | "Previous page" / "Next page" |
| `src/pages/DiaryEntry.tsx` | 309-316 | ArrowLeft header back | "Back to diary" |
| `src/pages/DiaryEntry.tsx` | 322-355 | Trophy / Share2 | "Submit notable fish" / "Share session" |
| `src/pages/Queries.tsx` | 139, 167, 249 | ArrowLeft / Send / ArrowLeft (overlay close) | "Back" / "Send question" / "Close" |
| `src/pages/Settings.tsx` | 317 | Switch (confirm delete) | "Ask before deleting sessions" |
| `src/pages/Settings.tsx` | 340-344 | Switch (reduce motion) | "Reduce motion" |
| `src/pages/DiaryNew.tsx` | 441 | ArrowLeft back | "Back" |
| `src/pages/DiarySetups.tsx` | 139 | ArrowLeft back | "Back" |
| `src/pages/Leaderboard.tsx` | 459 | ArrowLeft back | "Back" |
| `src/pages/SocialFeed.tsx` | 19 | ArrowLeft back | "Back" |

## §5 — Query dedup
**Deferred** under time-budget for this batch. Findings & shape for a follow-up:
- `ActiveSessionContext` already memoizes via React context (one fetch per user/auth event). Duplicate `is_active=eq.true` calls come from `Diary.tsx` `refreshActive` (which fetches its own variant including `session_rods`) and `DiaryNew.tsx` preflight (necessary, race-safety). Refactor would unify these via a `useActiveSession(userId)` `useQuery({ staleTime: 30_000 })` hook, with a separate `useActiveSessionWithRods` for Diary's resume-gating.
- `user_profiles` fetches: AuthContext already exposes `profile`. DisplayNameGate already consumes `useAuth().profile`. Remaining offenders are `CoachBanner`, `DiaryEntry.profileId`, `Settings`, `Leaderboard` joins. A 5-minute `useQuery` keyed on `userId` would dedup; left for a focused prompt because Settings holds form state derived from profile and needs careful wiring.

QueryClient is already at the App root (`src/App.tsx:59,72`), so the dedup hooks plug in without infra changes.

## §6 — Smoke
1. `/diary/<id>` Timeline tab → Delete Session visible. ✓
2. `/diary/00000000-0000-4000-8000-000000000000` → "Session not found". ✓ (no infinite spinner)
3. `/diary/garbage-not-a-uuid` → "Invalid session link". ✓
4. `/share/nonexistent-token-zzz` → "This share link has expired or was never valid." ✓ (no "Edge Function" wording)
5. aria-labels confirmed via grep (table above).
6. Network dedup: deferred to a follow-up prompt.
