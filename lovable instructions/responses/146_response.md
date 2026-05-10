# Lovable response — Prompt 146 (Home in VenueSearch + water-type propagation + archetype path)

**Applied:** 2026-05-08 → 2026-05-10
**Status:** applied (Branch C cleanup of orphan-style row + §3-5 frontend wiring + §6 archetype aggregation)

---

## §1 — Pre-flight diagnostics

Run on Nick's user (`nick.dyne@gmail.com`).

### D1 — favourites
| user_id | venue_id | name | county | water_type_id | created_at |
|---|---|---|---|---|---|
| nick | `USR-00955208` | `home` | Cambridgeshire | 3 | 2026-05-08 17:19:54 |

### D2 — any "home" venue
| venue_id | name | county | water_type_id | level |
|---|---|---|---|---|
| `USR-00955208` | `home` | Cambridgeshire | 3 (River-Freestone) | river |
| `PP-R-WYE-LOWER-HOME-FISHERY` | Home Fishery (Wye Lower) | Powys | 4 | beat |

### D3 — Cambs freestone river
Same `USR-00955208` row only.

### D4 — recent queries
Schema mismatch (no `venue_name` column) — skipped.

### D5 — venue history
| id | venue_id | action | name | county | wt_id | created_at |
|---|---|---|---|---|---|---|
| … | `USR-00955208` | advice | home | Cambs | 3 | 2026-05-08 17:20:00 |
| … | `GRAFHAM-WATER` | advice | Grafham Water | Cambs | 2 | … |

### D6 — orphans
None.

### FK count for `USR-00955208`
- favourites: 1
- history: 1
- fishing_sessions: 0
- session_venue_map: 0

---

## §2 — Cleanup applied

**Branch chosen: C-ish (drift cleanup, no FK references).**

`USR-00955208` was created by the pre-144 user-venue submission flow before prompt 144 landed the "no `venues_new` row for Home" guard. Zero `fishing_sessions` referenced it, so safe to delete with its 1 favourite + 1 history row.

Migration: `20260508174645_c9c1cf32-a90b-48df-b432-001bde9cf718.sql`

```sql
DELETE FROM user_venue_favourites WHERE venue_id = 'USR-00955208';
DELETE FROM user_venue_history    WHERE venue_id = 'USR-00955208';
DELETE FROM venues_new            WHERE venue_id = 'USR-00955208';
```

Verification post-delete: 0 / 0 / 0 rows.

---

## §3 — `VenueSearch.tsx`

- Added `HOME_PSEUDO` synthetic result with `venue_id = "__home__"` (sentinel, never lands in DB).
- Pinned under a "Practice" heading at top of the default state.
- Hidden in "Near me" mode (Home has no GPS).
- Added `homeWaterType` state + Stillwater/River segmented toggle, shown only when Home is selected.
- `canSubmit = !!selectedVenue && !!selectedDate && (!isHome || !!homeWaterType)`.
- `onAdviceRequest` widened to `(venueId, venueName, date, waterTypeOverride?)`.

## §4 — `Dashboard.tsx`

- `handleAdviceRequest` widened with `waterTypeOverride?: "stillwater" | "river"`, forwarded to `getFishingAdvice`.
- `user_venue_history` insert wrapped in `if (venueId !== "__home__")` to avoid FK violation.
- `logEvent("advice.request", …)` carries the override for prompt-145 traceability.

## §5 — `adviceService.ts`

- `getAdviceV2`, `getBasicAdvice`, `getFishingAdvice` all carry `waterTypeOverride?` and pass `water_type_override` to the edge functions.

---

## §6 — Archetype aggregation in `get-ai-advice-v2`

Replaced the prior 422 "coming soon" sentinel branch with a full archetype path.

### Logic

1. Resolve `water_type_override`:
   - `river` → `water_type_id ∈ [3, 4, 5, 6, 9]`
   - `stillwater` → `water_type_id ∈ [1, 2, 7, 8]`
2. Pull all venue names with that `water_type_id` from `venues_new`.
3. Aggregate `flies` and `methods` from `reports_enriched` joined by lowercase `venue` name (the table has no `venue_id` column), within the last 90 days.
4. If <5 reports in 90d, fall back to all-time (`window: "all-time"` flagged in response).
5. Compute mean `rod_average` across the matched reports.
6. Feed top 10 flies + top 8 methods into a generic-archetype prompt with Lovable AI Gateway (`google/gemini-2.5-flash`, `LOVABLE_API_KEY`).
7. Return the standard `AdviceV2Response` shape with:
   - `tier: "archetype"`
   - `confidence.tier: "archetype"` so `Results.tsx` can show a generic-guidance badge
   - `archetype: { water_type, water_type_ids, window, venue_pool_size }`
8. Save query record with `venue = "__home__:river"` so it's traceable.
9. If `water_type_override` is null on Home, still returns the friendly 422.

### Aggregation SQL (logical equivalent)

```sql
SELECT unnest(re.flies) AS fly, COUNT(*) AS n
FROM reports_enriched re
JOIN venues_new vn ON LOWER(vn.name) = LOWER(re.venue)
WHERE vn.water_type_id IN (3,4,5,6,9)         -- river archetype
  AND re.date >= (CURRENT_DATE - INTERVAL '90 days')
  AND re.flies IS NOT NULL
GROUP BY fly
ORDER BY n DESC
LIMIT 10;
```

### Verification — Home + River call

`POST /get-ai-advice-v2` `{venue_name:"__home__", target_date:"2026-05-15", water_type_override:"river"}` → `200 OK`

Sample response (trimmed):

```json
{
  "tier": "archetype",
  "ai_generated": true,
  "season": "spring",
  "reportCount": 6,
  "matchedReportCount": 6,
  "archetype": {
    "water_type": "river",
    "water_type_ids": [3, 4, 5, 6, 9],
    "window": "all-time",
    "venue_pool_size": 643
  },
  "confidence": {
    "tier": "archetype",
    "water_type": "river",
    "window": "all-time",
    "report_data": "low",
    "tactical_data": "none",
    "personal_data": "insufficient"
  },
  "prediction": {
    "flies": [
      { "fly": "March Brown",      "frequency": 3, "score": 3 },
      { "fly": "Grannom",          "frequency": 3, "score": 3 },
      { "fly": "Large Dark Olive", "frequency": 1, "score": 1 },
      { "fly": "Dry Fly",          "frequency": 1, "score": 1 }
    ]
  },
  "advice": "### What to Expect\nMay in spring usually means actively feeding fish… March Brown imitation, perhaps a size 12 or 14… Grannom pupa pattern… Large Dark Olive in a size 14 or 16…"
}
```

**Bug check:** the returned flies (March Brown, Grannom, Large Dark Olive) are river-shape patterns — not stillwater-shape (no Diawl Bach, Cat's Whisker, Cormorant). Original bug fixed.

The "all-time" window is expected: `reports_enriched` has no rows in the last 90 days for the river archetype yet, so the function correctly fell back. River seasonality means this will populate properly through summer.

### DB sentinel verification

```sql
SELECT COUNT(*) FROM venues_new             WHERE venue_id = '__home__'; -- 0
SELECT COUNT(*) FROM user_venue_history     WHERE venue_id = '__home__'; -- 0
SELECT COUNT(*) FROM user_venue_favourites  WHERE venue_id = '__home__'; -- 0
```

---

## Files changed

- `src/components/VenueSearch.tsx` — Home pseudo-venue + water-type toggle.
- `src/pages/Dashboard.tsx` — forward override; skip history insert for sentinel.
- `src/services/adviceService.ts` — `water_type_override` plumbed through `getAdviceV2`/`getBasicAdvice`/`getFishingAdvice`.
- `supabase/functions/get-ai-advice-v2/index.ts` — archetype aggregation + `tier: "archetype"` response branch (replaces 422 stub).
- Migration `20260508174645_…sql` — cleanup of `USR-00955208`.

## Out of scope (unchanged from spec §8)

- Did **not** auto-favourite Home.
- Did **not** alter `Results.tsx` render logic — it consumes the same `AdviceV2Response` shape; the new `tier: "archetype"` + `confidence.tier` are additive and ready for a future "Generic guidance" badge.
- Did **not** modify the legacy `get-fishing-advice` edge function — the v2 path covers Home end-to-end.
