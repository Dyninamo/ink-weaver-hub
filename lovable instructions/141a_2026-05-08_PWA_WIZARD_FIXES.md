# Lovable Prompt 141a — PWA setup wizard follow-up fixes

**Date:** 2026-05-08
**Branch / repo:** `Dyninamo/ink-weaver-hub`
**Depends on:** prompt 141 (just landed). Code review surfaced one P0 bug, one P1 fragility, and three smaller items.

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/141a_response.md`.

---

## 1. P0 — Replace `VENUE_TYPES` hardcoded map with a real water-type lookup

**File:** `src/pages/DiaryNew.tsx:15-21`

The current implementation:

```ts
const VENUE_TYPES: Record<string, "stillwater" | "river"> = {
  "Grafham Water": "stillwater",
  "Pitsford Water": "stillwater",
  "Rutland Water": "stillwater",
  "Ravensthorpe Reservoir": "stillwater",
  "Draycote Water": "stillwater",
};
```

…and `useEffect` at line 52-54 falls back to `"stillwater"` for any unmapped venue. **Every river venue in the dropdown silently becomes stillwater**, breaking SavedRigsBanner filtering, river-default rod weight, river-default line, and (when prompt 142 lands) river-default species.

### Fix

Delete the hardcoded map. When the venue is selected, look up its `water_type_id` on `venues_new` and resolve it via `water_types`:

```ts
useEffect(() => {
  if (!venue) return;
  let cancelled = false;
  async function lookup() {
    const { data } = await supabase
      .from("venues_new")
      .select("water_type_id, water_types(water_type)")
      .ilike("name", venue)
      .limit(1)
      .maybeSingle();
    if (cancelled) return;
    const wt = (data as any)?.water_types?.water_type as string | undefined;
    if (wt === "stillwater" || wt === "river") {
      setVenueType(wt);
      setVenueTypeResolved(true);
    } else {
      setVenueTypeResolved(false);
      // leave venueType at its previous value or default 'stillwater';
      // the user-visible toggle (Section 3) lets the angler correct.
    }
  }
  lookup();
  return () => { cancelled = true; };
}, [venue]);
```

`water_types.water_type` is text and uses the `'stillwater' | 'river'` vocabulary already (verified in `src/integrations/supabase/types.ts:5933`). If the join returns something else (e.g. a future `'sea'` value), treat it as unresolved and fall through to the manual toggle.

**Also remove** the unused `VENUE_TYPES` constant.

---

## 2. P1 — Source venue dropdown from `venues_new`, not `reports_enriched`

**File:** `src/pages/DiaryNew.tsx:39-45`

The current loader queries `reports_enriched.venue`:

```ts
const { data } = await supabase.from("reports_enriched").select("venue").order("venue");
if (data) setVenues([...new Set(data.map((r: any) => r.venue))]);
```

This shows venue names that *appeared in reports*, not the canonical venue list. Two consequences:
- Venues in `venues_new` with no reports never appear in the dropdown.
- Post-commit `venues_new.ilike("name", venue)` lookup at line 161 is doing a fuzzy match against names sourced from a different table — brittle.

### Fix

Replace with a `venues_new` query and load name + water_type together so we don't need a second round-trip when the user picks:

```ts
interface VenueOption {
  name: string;
  waterType: "stillwater" | "river" | null;
}

const [venues, setVenues] = useState<VenueOption[]>([]);

useEffect(() => {
  async function loadVenues() {
    const { data } = await supabase
      .from("venues_new")
      .select("name, water_types(water_type)")
      .eq("is_active", true)
      .eq("is_searchable", true)
      .order("name")
      .limit(2000);
    if (!data) return;
    setVenues(
      data.map((v: any) => ({
        name: v.name,
        waterType: v.water_types?.water_type ?? null,
      }))
    );
  }
  loadVenues();
}, []);
```

Then the venue-pick handler can set both `venue` and `venueType` in one go without needing the separate `useEffect` lookup from §1 — though keeping the §1 lookup as a fallback for any venue selected via the `?venue=` querystring is fine.

If `venues_new` has too many rows for the `<select>` dropdown to be ergonomic, add a simple text-filter input above it (don't replace the dropdown with autocomplete in this prompt — scope creep). 914 venues should render fine.

---

## 3. P1 — Add a `Stillwater | River` override toggle on the basics block

Even with §1's lookup, edge cases remain: a venue with `water_type_id` null in master, a venue named via `?venue=` querystring that doesn't match `venues_new`, or a venue picked before the lookup `useEffect` resolves.

Add a small toggle below the venue picker in the basics view:

```
Venue *           [Grafham Water        ▼]

Water type        [ Stillwater ]  [ River ]
                  (auto-detected — tap to override)
```

State: `venueType` already exists. Render two chips reflecting/setting it. When §1's lookup resolves, the toggle auto-updates; tapping a chip overrides and sets a `venueTypeManual = true` flag so subsequent venue lookups don't clobber the user's choice.

When `venueTypeResolved === false` (lookup failed), highlight the toggle with subtle warning styling so the angler knows they're choosing manually.

---

## 4. P2 — Move SavedRigsBanner above the phase body

**File:** `src/components/diary/setup/SetupWizard.tsx:332-339`

Today the banner renders **after** `<RigSoFarCard>` and the phase body, so the angler sees rod-weight chips first and the saved-rig affordance below. Move it to render BEFORE `<RigSoFarCard>` (i.e. directly under the wizard header) so it's the first thing visible on phase 1.

Render it `phase === "rod" && rodSubStep === "weight"` only — same gate as today. After that step, it stays hidden.

---

## 5. P2 — Length pre-fill guard for legacy presets

**File:** `src/components/diary/setup/SetupWizard.tsx:156-171`

In `applyPreset`, the length is pre-filled only if `rod.rodWeight != null`. Legacy presets without `rod_weight` (e.g. RN presets saved before the rebuild) will leave `lengthInches` whatever it was previously. Add a guard:

```ts
function applyPreset(rod: RodSetupState, hasFlies: boolean) {
  setState((s) => ({ ...s, ...rod, flyCount: rod.flyCount ?? 2, flies: rod.flies ?? {} }));
  // Pre-fill length: prefer preset's value, else the new weight's median, else null.
  if (rod.rodLengthFt) {
    setLengthInches(Math.round(rod.rodLengthFt * 12));
  } else if (rod.rodWeight != null) {
    setLengthInches(rodMedianInchesForWeight(rod.rodWeight));
  } else {
    setLengthInches(null);
  }
  setPhase(hasFlies ? "spot" : "flies");
  toast.success("Rig applied — pick a spot to start");
}
```

---

## Pre-flight greps

```bash
# Confirm only one VENUE_TYPES caller
grep -rIn "VENUE_TYPES" src/

# Confirm reports_enriched isn't used elsewhere for venue listing
grep -rIn "from(\"reports_enriched\")" src/

# Confirm water_types relationship is exposed in generated types
grep -n "water_types" src/integrations/supabase/types.ts | head -10
```

If any of these surface a second consumer that this prompt didn't anticipate (a Map page or VenueDetail using `reports_enriched.venue` as the canonical name source, etc.), **stop and report back**. Don't change the second consumer in this prompt.

---

## Verification

1. **Build clean:** `npm run build`. No TS errors.
2. **River venue test:**
   - Pick a venue with `water_type_id` for river (e.g. any venue tagged in master as a river — pick from the dropdown). Confirm:
     - Water-type toggle shows "River" highlighted.
     - SavedRigsBanner (when there are saved presets) filters to river or null water_type only.
     - Wizard pre-fills rod weight from `river_default_rod_weight` (or 5 if unset).
     - Wizard pre-fills line from `river_default_line` (or "Floating").
3. **Stillwater venue test:**
   - Pick Grafham Water. Confirm water-type toggle shows "Stillwater". Same chain on stillwater defaults.
4. **Manual override:**
   - Pick a venue, wait for auto-detect, tap the opposite water-type chip. Confirm the wizard reloads defaults for the override (rod weight + line shift accordingly).
5. **Unresolved venue:**
   - Pick a venue from the dropdown that has `water_type_id = null` (find one via SQL: `SELECT name FROM venues_new WHERE water_type_id IS NULL LIMIT 1`). Confirm the toggle renders in unresolved/warning state.
6. **Banner placement:**
   - Open the wizard. Confirm SavedRigsBanner is the first thing under the header, above RigSoFarCard.
7. **Legacy preset test:**
   - Create a `user_presets` row with `rod = '{"name":"legacy","style":"Wet","flyCount":2}'` (no rodWeight, no rodLengthFt). Confirm tapping the chip jumps to `flies` phase without crashing; lengthInches becomes null and the length sub-step shows a default-weight median when the user advances to it.

---

## Out of scope

- Replacing the `<select>` with an autocomplete (separate UX prompt).
- Migrating `user_rod_setups` legacy presets into `user_presets` (separate housekeeping).
- Anything in the wizard's body that already works (phase content, commit logic, rollback).

---

## Response capture

Per protocol 128, write to `lovable instructions/responses/141a_response.md`:

- Pre-flight grep findings.
- Diff summary per section (1–5).
- Screenshots:
  - Basics block with auto-detected water type chip on a river venue.
  - Basics block with manual override active (warning state on unresolved venue).
  - Wizard step 1 with SavedRigsBanner at the top.
- DB lookup output for the §1 join (`SELECT name, water_types.water_type FROM venues_new JOIN water_types USING (water_type_id) LIMIT 5`).
