# 199 — Map fixes

## §1 — Dead Search button
Variant chosen: **hidden** (replaced with comment). `Search` import removed from `lucide-react`.

## §2 — Size filter river-aware
- `types.ts` `filterVenues`: wrapped size predicate in `if (isStill) { ... }`. Rivers no longer rejected by Size.
- `FilterSheet.tsx`: extended `FacetGroup` with optional `disabled` prop (`opacity:0.5; pointer-events:none`); Size group now `disabled={filters.waterType === 'River'}`.

## §3 — History layer: catch pins only
- `HistoricalLayer.tsx`: added `catchPoints: [number, number][]` to `HistoricalSession`; marker loop iterates `s.catchPoints` instead of `s.trail`.
- `MapPage.tsx` history projection: builds `catchPoints` from `pts.filter(p => p.isCatch)`.

## §4 — Marker thrash
- `MapPage.tsx`: added `const handleSelectVenue = useCallback((v: VenuePin) => setSelected(v), []);` and passed it to `VenuePinMarkers`.
- `VenuePinMarker.tsx`: split into two effects. Effect 1 creates markers on `[map, venues, onSelect]`; Effect 2 toggles `.selected` className on `[selectedId]`. `elsRef` keeps `venue_id → HTMLDivElement` map for O(1) class flips.

## §5 — venue_id matching
- `diaryService.ts`: added `venue_id: string | null` to `FishingSession` (was missing — confirmed by file inspection).
- `MapPage.tsx` startCoords: prefer `byId` lookup, fall back to name match.
- `MapPage.tsx` history query: select `venue_id`, `.eq('venue_id', ...)` if present, else `.eq('venue_name', ...)`.

## §6 — STILLWATER_TYPES
`Set([1, 2, 7])` → `Set([1, 2, 7, 8, 10])` with comment block explaining each id.

## §7 — Smoke test
Static review only (no runtime walkthrough performed in this loop):
- 1 ✓ Search button removed; build clean after `Search` import drop.
- 2 ✓ Filter logic skips size when not stillwater; FacetGroup dims when waterType=River.
- 4 ✓ Effect deps no longer include `selectedId`/inline `onSelect` → marker DOM stable across taps.
- 5 ✓ `venue_id` column requested in select; eq predicate prefers id.
- 6 ✓ Constant updated; downstream `STILLWATER_TYPES.has(...)` callers (filterVenues, VenuePinMarker) inherit automatically.
- 3, 7 — not exercised against a live session in this loop. Flag for Alun's first end-to-end.

## Out of scope
Marker clustering, search wiring, per-event-type history pins — tracked for prompt 200+.
