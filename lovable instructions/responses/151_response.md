# 151 — PWA: default time to now, capture GPS, drop fishing-type toggle

## Pre-flight
- `fishing_type` writers in PWA: only `src/pages/DiaryNew.tsx` (line 161). Render consumers (`Diary.tsx:451`, `DiaryEntry.tsx:293,724`) are already null-tolerant via `&&` / template guards — safe to stop writing.
- `gps_start_lat / gps_start_lon`: only present in `src/integrations/supabase/types.ts`. No PWA writers.
- `navigator.geolocation`: used in `VenueSearch.tsx` for venue search, not session start. No prior `getBrowserGps` helper.

## Changes (`src/pages/DiaryNew.tsx`)
- **§1** — Added `nowHHMM()` helper; `arrivalTime` state initialised to `nowHHMM()` instead of `""`. Resolves once at mount.
- **§2** — Added `getBrowserGps()` module-level helper (8s timeout, `enableHighAccuracy`, silent on deny). `handleCommit` calls it before `createSession`, logs `diary.gps_capture { granted }`, and writes `gps_start_lat / gps_start_lon` (nullable on deny).
- **§3** — Removed `FISHING_TYPES` const, `fishingType / setFishingType` state, the Bank/Boat/Both chip block, the `fishing_type` field from the `createSession` payload, and the `fishingType` key from the `diary.build_rig_clicked` event.

## Out of scope
- No schema changes; `fishing_sessions.fishing_type` stays nullable, historic rows untouched.
- No PermissionWarmupModal — browser native prompt only.
- Render guards in `Diary.tsx` / `DiaryEntry.tsx` already handle the now-null `fishing_type`; no edits needed.
