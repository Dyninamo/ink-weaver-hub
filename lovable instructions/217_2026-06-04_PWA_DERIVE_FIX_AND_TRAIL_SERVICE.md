# 217 — PWA: `deriveFixFromTrail` helper + `getSessionTrail` service

The consumer for the GPS trail (prompts 215/216). Pure logic + a data fetch, no
UI — wired into the catch editor in prompt 218. This is a direct port of the RN
app's `src/location/deriveFix.ts` (shipped yesterday), adapted to the PWA's
`session_trails` columns and flat `latitude`/`longitude` event fields.

## Part A — `getSessionTrail(sessionId)` in `diaryService`
Add to `src/services/diaryService.ts`:
```ts
export async function getSessionTrail(sessionId: string): Promise<TrailPoint[]>
```
- Selects `timestamp, latitude, longitude, accuracy` from `session_trails` where
  `session_id = sessionId`, ordered by `sort_order` (fallback `timestamp`) asc.
- `TrailPoint = { timestamp: string; latitude: number; longitude: number; accuracy: number | null }`.
- RLS handles auth (owner-scoped, prompt 215). Returns `[]` on no trail.

## Part B — `deriveFixFromTrail` in `src/lib/deriveFix.ts`
Pure, deterministic (no clock/IO) so it's unit-testable.

```ts
export type DerivedConfidence = 'high' | 'approx' | 'low' | 'edge' | 'none';
export interface DerivedFix {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;   // widened to reflect interpolation gap
  confidence: DerivedConfidence;
  bracketDistanceM: number;  // metres between the two bracketing fixes
  note: string;              // short human label for the UI
}
export function deriveFixFromTrail(trail: TrailPoint[] | null | undefined, timestampISO: string): DerivedFix
```

**Algorithm (copy RN exactly):**
1. Parse target time `t`. Invalid → `{null,null,null,'none',0,'Invalid time.'}`.
2. Keep only finite-lat/lon, parseable-timestamp points; sort by time asc.
3. 0 points → `confidence:'none'`, note "No GPS track for this session."
4. 1 point → place there, `confidence:'edge'`, note "Only one GPS point — placed there."
5. `t <= first` or `t >= last` → clamp to that endpoint, `confidence:'edge'`,
   note "before the track started"/"after the track ended — placed at the
   first/last point."
6. Otherwise **binary-search** the bracket (largest i with `pts[i].time <= t`),
   take points `a` (=pts[i]) and `b` (=pts[i+1]). Interpolate fraction
   `f = (t - a.time)/(b.time - a.time)`:
   - `latitude = a.lat + (b.lat - a.lat)*f`, same for longitude.
   - `bracketDistanceM` = Haversine(a,b) in metres.
   - **accuracy = max(a.accuracy, b.accuracy) + bracketDistanceM/2** (widen by
     half the bracket span — the true spot is somewhere along the segment). Treat
     null point-accuracy as 0 for this max.
7. **Confidence by bracket DISTANCE, not time** (a long stationary gap = high
   confidence): `<=15m` → `'high'` ("Placed from your GPS track."); `<=75m` →
   `'approx'` ("Approximate — placed between two track points."); else `'low'`
   ("Rough — you were on the move and the track was sparse here.").

Use a shared Haversine — reuse one if the PWA already has it (grep `distance`,
`haversine`); otherwise add a small local one.

## Part C — tests
Port `FishingDiary/__tests__/deriveFix.test.ts` to the PWA's test setup
(`src/lib/__tests__/deriveFix.test.ts` or repo convention). Cover: empty trail,
single point, before/after span (edge), interior high/approx/low by bracket
distance, and the accuracy-widening assertion.

## Verify
- `npm test` (or the repo's runner) — new deriveFix tests pass.
- Quick console check: a 2-point trail 10m apart spanning 10:00–10:10, query
  10:05 → midpoint, `confidence:'high'`, accuracy ≈ max(acc)+5.

## Context
Consumed by prompt 218 (CatchEditForm shows the derived location + confidence,
and stores `latitude`/`longitude` onto the event on save).
