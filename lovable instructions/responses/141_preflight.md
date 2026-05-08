# Prompt 141 — PWA Setup Wizard: Lovable pre-flight findings

**Date:** 2026-05-08
**Author:** Lovable (pre-build pre-flight, per prompt §"Pre-flight greps" — line 64: "stop and report back")
**Status:** Build paused pending decisions on the items below.

---

## Pre-flight grep results

| Check | Result |
|---|---|
| `DiaryNew` route | `src/App.tsx:97` mounts `<DiaryNew />` at `/diary/new`. Single owner. ✅ |
| `user_presets` readers/writers in PWA | **Zero.** Only appears in `src/integrations/supabase/types.ts:4579`. RN-only writer today, as the prompt expected. ✅ |
| `user_rod_setups` legacy | Read+written by `src/pages/DiarySetups.tsx` (lines 54, 96, 106, 121). Will leave alone with TODO per §"Out of scope". ✅ |
| `session_rods` consumers | `src/components/diary/RodPickerSheet.tsx:55` (cast as `any`). No other writers. ✅ |
| `user_profiles` defaults present | `default_rod_weight`, `default_rod_length_ft`, `default_line_profile`, `default_keep_limit`, `default_leader_id` — all present. ✅ |

**Bonus columns on `user_profiles`** the prompt didn't reference but exist:
`default_line` (legacy text — separate from `default_line_profile`), plus a seasonal pair `stillwater_default_line` / `stillwater_default_rod_weight` and `river_default_line` / `river_default_rod_weight`. Prompt §9 picks `default_line_profile` which is the right modern one. Flagging the seasonal pair only because if you want venue-aware defaults, the data is already there — currently unused by the wizard plan.

---

## Schema drift vs. the prompt

### 🔴 BLOCKER 1 — `fishing_sessions.fishing_style` does not exist

`fishing_sessions` columns (verified from `src/integrations/supabase/types.ts:611-668`):

```
angler_location, angler_name, area, beat, created_at, dropper_count,
duration_minutes, end_latitude, end_longitude, end_time, fishing_type,
fishing_type_raw, gps_altitude, gps_start_lat, gps_start_lon, id,
is_active, keep_limit, latitude, leader_id, leader_length_ft,
leader_material, leader_strength_lb, line_profile, longitude, notes,
plan, rod_length_ft, rod_weight, rods, satisfaction_score,
session_date, size_mode, size_units, source, source_id, spot_name,
start_time, submission_due, submission_status, tippet_length_ft,
tippet_strength, tippet_unit, updated_at, user_id, venue_id,
venue_name, venue_type, weather_conditions, weather_log,
weather_pressure, weather_temp, weather_wind_dir, weather_wind_speed,
would_return
```

**No `fishing_style` column.** Style only lives on `session_rods.style` (verified at `src/integrations/supabase/types.ts:3315`).

§8a writes `fishing_style: style` to the session insert — that field will be silently dropped by PostgREST or, depending on the client, throw. Either way, style won't land on the session row.

**Options:**

1. **Add the column** — small migration:
   ```sql
   ALTER TABLE public.fishing_sessions ADD COLUMN fishing_style text;
   NOTIFY pgrst, 'reload schema';
   ```
   Mirrors the prompt as written. Out-of-scope per the prompt header ("No master / Supabase schema changes are needed") but the spec contradicts itself here.

2. **Skip the session-level write** — only persist style on `session_rods.style`. Prompt 142's catch flow reads from `session_rods` anyway per §8b ("This row is what the catch flow will read"). Zero schema change. Only loss: queries that aggregate sessions by style would need to join through `session_rods`.

**My recommendation:** Option 2. The prompt itself says session_rods is the read source for downstream features. Avoids a migration, keeps the data model clean (style is a per-rod concept in a multi-rod future).

---

### 🟡 BLOCKER 2 — `fishing_type` ('Bank' / 'Boat' / 'Both') has no wizard step

§8a writes `fishing_type` but no phase in §1–§8 captures it. Column is nullable. The RN `SetupScreen.tsx` does capture it.

**Options:**

1. **Add a small toggle on SpotStep** — three chips (Bank / Boat / Both) above the spot input. Defaults to Bank. Tiny addition, keeps the column populated.
2. **Default to 'Bank' silently** — hardcode on insert. Misleading for boat trips, which are common on UK reservoirs.
3. **Leave null** — column is nullable; defer capture to a later prompt.

**My recommendation:** Option 1. One row of three chips. Trivial. Loses one piece of signal otherwise.

---

## Other notes for Claude

- **`session_rods` schema is fine** for the §8b write. Has extras (`line_id`, `tippet_length_ft`, `tippet_strength`, `tippet_unit`) that we'll leave null. The prompt's `flies_on_cast` JSON shape will land in the `Json` column without issue.
- **`user_presets` schema matches** the prompt's writer (`id`, `user_id`, `name`, `rod jsonb`, `water_type`, `include_flies`, `last_used_at`). RN-compatible.
- **Existing PWA `SetupWizard.tsx` was deleted in prompt 135.** The prompt 141 spec calls for a new one at `src/components/diary/setup/SetupWizard.tsx` — no naming collision, the old file is gone.
- **`LeaderPicker` already exists** at `src/components/diary/LeaderPicker.tsx` from prompt 140 and writes to the four leader columns plus `leader_id` resolution. Will mount inline as the leader phase per §3.
- **`FlyPicker` exists** at `src/components/diary/FlyPicker.tsx` — will use as the picker sheet on FliesStep per §7.
- **No collision with `src/services/styleRules.ts`** (added prompt 138 for catch flow); the wizard's STYLE_OPTIONS list is independent.
- **Venue picker is currently inline on `DiaryNew.tsx`** (text input + `?venue=` querystring honour from prompt 135). The wizard will need to subsume that or precede it. Prompt 141 doesn't explicitly say where venue/date selection lives — assumed it sits above or before phase 1. **Please clarify if you want venue selection inside the wizard as a phase 0, or kept as a separate top-of-page block.**
- **Weather block** (`weather_temp`, `weather_wind_speed`, etc.) — prompt §8a says "carry forward if present". Current `DiaryNew.tsx` does NOT fetch weather at session-create time; weather lands later via `poll-session-weather`. Should the wizard call OpenWeather at commit, or leave those fields null and let the polling edge function populate them? **Currently planning: leave null and let polling handle it** unless you say otherwise.

---

## Decisions I need before I build

1. **fishing_style:** add the column, or skip the session-level write? (recommend: skip)
2. **fishing_type:** add SpotStep toggle, default to 'Bank', or leave null? (recommend: SpotStep toggle)
3. **Venue selection placement:** inside wizard (phase 0), or kept above the wizard as today?
4. **Weather at commit:** fetch synchronously, or leave null for the existing polling edge function? (recommend: leave null)

Once these are answered I'll build the 7-phase wizard, the `Dial` primitive, `SavedRigsBanner`, the three-row commit (session → rod → optional preset), rollback, the response file, and the screenshots per §Verification.
