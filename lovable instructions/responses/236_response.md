# 236 — Friendly Home pseudo-venue label (display-only)

## Diff
- **Created** `src/lib/venueLabel.ts` — exports `displayVenue(venue)`; maps `__home__` / `__home__:river` / `__home__:stillwater` to `Home`, `Home (River)`, `Home (Stillwater)`. Real venue names pass through unchanged. Null/undefined → `"Unknown"`.
- `src/pages/Dashboard.tsx:412` — `{query.venue}` → `{displayVenue(query.venue)}`; import added.
- `src/pages/Results.tsx:207` — `{state.venue}` → `{displayVenue(state.venue)}`; import added.

## Not changed
- DB persistence (`queries.venue`, navigation state) still stores `__home__:<wt>` per response 146.
- `SessionShareView` renders `snap.venue_name` (real venue captured at session start, never a sentinel) — no change.
- `ShareView` renders `report.venue` from `shared_reports` (real venue rows) — no change.

## Verify
- Recent Queries card for a Home query renders "Home (River)" / "Home (Stillwater)".
- Opening that query → Results header shows the same friendly label.
- Real venue names unchanged.
