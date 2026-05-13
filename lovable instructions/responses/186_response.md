# 186 — Hide social entry points

## §1 Dashboard Social tab
- `src/pages/Dashboard.tsx` lines 283-286: Social `<Button>` deleted (replaced with comment).

## §2-3 DiaryEntry header + per-fish Trophy/Share
- `src/pages/DiaryEntry.tsx` lines 334-361: header Trophy + Share buttons removed.
- `src/pages/DiaryEntry.tsx` lines 644-654: per-fish Trophy button removed.
- State + dialog mounts left in place (dead but harmless; trims pending follow-up).

## §4-5 Page redirects
- `src/pages/SocialFeed.tsx` rewritten as `/diary` redirect.
- `src/pages/Leaderboard.tsx` rewritten as `/diary` redirect.

## §6 Deep-link landing
- `src/pages/GroupJoinView.tsx` + `src/pages/SessionShareView.tsx`: `navigate("/social")` → `navigate("/diary")` (post-join / post-view buttons). `/auth?redirect=…` strings untouched (per spec).

## Smoke
- Dashboard nav now Dashboard + My Diary only.
- `/social` and `/leaderboard` URLs silently redirect to `/diary`.
- External `/social/session/:token` and `/social/join/:code` still render previews.
