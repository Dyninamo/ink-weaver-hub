# 222 — PWA polish: 4 small independent fixes

Found via live testing on 2026-06-04. Four unrelated small fixes — implement
ALL four; each is self-contained. Checklist at the bottom for verification.

## Fix A — Settings: replace placeholder toasts with real content
`src/pages/Settings.tsx` (~lines 366–380). Two rows currently fire only a
transient `toast.info(...)`:
- **"How this works"** → `toast.info("Quick tour coming soon.")` — a dead
  placeholder; the tour was never built.
- **"What we store"** → a one-line privacy toast that's easy to miss.

Replace both with a proper **modal/sheet** (reuse the app's Dialog/Sheet):
- *What we store* → a short panel listing what's stored (sessions, events,
  weather snapshots, fly choices) and what isn't (no tracking/location-selling).
  A privacy disclosure shouldn't be a 4s toast.
- *How this works* → a brief static explainer of the diary (start a session →
  log catches → review timeline/stats → get advice). Static content is fine;
  drop "coming soon".

## Fix B — Diary timeline: header fish count is page-local
`src/pages/Diary.tsx`. The header uses `totalFishAcrossLoaded` (line ~200, a
`reduce` over the **currently loaded page's** sessions), so it reads "7 fish" on
page 1 and "2 fish" on page 2 while "sessions" is the global total. Use the
**global** stat instead — there's already a fetched `stats.totalFish`
(lines ~33/154). Show `{totalSessions} sessions · {stats.totalFish} fish` so both
halves are global and consistent across pages.

## Fix C — Dialog/Sheet accessibility (Radix warnings)
Two console errors from missing Radix labels:
- `src/components/map/VenuePeekSheet.tsx` — `SheetContent` has **no
  `SheetTitle`**. Add one (the venue name), wrapped in a visually-hidden
  component if you don't want it shown. (cf. `FilterSheet.tsx` which has one.)
- `src/pages/DiaryEntry.tsx` add/edit-catch dialog (~line 912) — `DialogContent`
  has a `DialogTitle` but **no `DialogDescription`** → "Missing Description or
  aria-describedby". Add a `DialogDescription` (or `aria-describedby`).

## Fix D — Invalid share link refetches ~4× on a 404
`src/pages/ShareView.tsx` — `fetchSharedReport()` runs in a `useEffect` keyed on
`[token, user]`, so it re-fires several times as auth state settles, each hitting
the permanent 404 and logging `404` + `FunctionsHttpError`. The UI already shows
the correct "Unable to Load Report" state. Fix:
- Don't refetch once a definitive result (incl. a 404/expired) is reached — gate
  the effect so a known-bad token isn't retried on every auth tick.
- Downgrade the `console.error` for the expired/not-found case (it's a normal
  user condition, not an app error).

## Verify (check ALL four)
- [ ] A: "What we store" and "How this works" open real panels (no bare toast; no "coming soon").
- [ ] B: header fish count is identical on diary page 1, 2, and 3.
- [ ] C: opening the map venue-peek sheet and the add-catch dialog produces **no** Radix a11y console errors.
- [ ] D: visiting an invalid `/share/<bad>` makes a single failed call (not ~4) and shows the error state with minimal console noise.
