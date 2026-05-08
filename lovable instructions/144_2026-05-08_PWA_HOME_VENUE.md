# Lovable Prompt 144 — PWA "Home" pseudo-venue

**Date:** 2026-05-08
**Branch / repo:** `Dyninamo/ink-weaver-hub`
**Depends on:** prompts 141 / 141a / 142 / 143 (all landed).

**Context:** Nick wants a `Home` option at the top of the venue dropdown for sessions that aren't at a real water — practice, fly-tying logs, casting in the garden, etc. The intent:

- **No DB pollution.** Don't add a row to `venues_new`. No fake GPS, no fake water type, no synthetic venue_id.
- **Rest of the app behaves as designed.** A "Home" session writes `fishing_sessions.venue_name = 'Home'` with `venue_id = null` (already a non-fatal path in the existing post-commit lookup). Catch / blank / lost / change flows work exactly as they do for real venues.
- **The angler picks Stillwater | River manually** so the wizard's defaults + species canonical have a concrete value to drive off of. There's no auto-detect for Home.

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/144_response.md`.

---

## File targets

- `src/pages/DiaryNew.tsx` — venue dropdown + water-type lookup logic
- `src/components/diary/setup/SetupWizard.tsx` — widen `venueWaterType` prop type to allow `null`
- `src/components/diary/setup/SavedRigsBanner.tsx` — already passes through `null` filter correctly (verify, don't change)

No new files. No schema changes.

---

## Pre-flight greps

```bash
# Confirm venue dropdown lives only in DiaryNew.tsx
grep -rIn "Select venue\|Filter venues" src/

# Confirm venueWaterType is consumed only by SetupWizard + SavedRigsBanner
grep -rIn "venueWaterType" src/

# Confirm post-commit venue_id lookup tolerates no-match
grep -n "ilike(\"name\", venue)" src/pages/DiaryNew.tsx
# expect: src/pages/DiaryNew.tsx with the maybeSingle() pattern (no toast on null)
```

If anything else consumes `venueWaterType` (e.g. CatchFlow or ChangeFlow read it directly), **stop and report back**.

---

## 1. Inject "Home" at the top of the venue dropdown

`src/pages/DiaryNew.tsx`

In the `loadVenues` effect, prepend a synthetic Home option:

```ts
const HOME_OPTION: VenueOption = { name: "Home", waterType: null };

setVenues([HOME_OPTION, ...realVenues]);
```

Where `realVenues` is the existing `data.map(...)` result.

The `<option>` for Home should be visually distinct — render it first, with an italic label or a small "(practice / no real venue)" suffix, and a `<hr>`-equivalent separator below it. Two paths that work in a vanilla `<select>`:

- Use `<optgroup label="Practice">` for Home and `<optgroup label="Venues">` for the rest. Rendered as a header-styled non-selectable label by all browsers.

Pick `<optgroup>` — it's the cleanest native solution.

The venue text-filter `<Input>` at the top of the basics card should **always show "Home"** regardless of filter text (don't filter it out). Easiest: filter only `realVenues`, always prepend Home.

---

## 2. Skip auto-resolve when venue is Home

`src/pages/DiaryNew.tsx`

In the `useEffect` that auto-resolves the water type on venue change (lines 85-116), short-circuit when `venue === "Home"`:

```ts
useEffect(() => {
  if (!venue) return;
  if (venueTypeManual) return;
  if (venue === "Home") {
    setVenueTypeResolved(false);  // forces user to pick via the toggle
    return;
  }
  // ... existing in-memory + ilike lookup logic
}, [venue, venues, venueTypeManual]);
```

Result: when the user picks Home, the water-type toggle renders in **warning state** ("Couldn't detect water type — please choose"). The angler taps Stillwater or River manually; that flips `venueTypeManual = true` and from there everything works as designed.

---

## 3. Gate "Build your rig" CTA on water-type selection for Home

`src/pages/DiaryNew.tsx`

Currently the CTA disables on `!venue.trim()`. For Home, we additionally need a water-type pick before the wizard makes sense (its defaults branch on `venueWaterType` being concrete).

```tsx
const canBuildRig = !!venue.trim() && (venue !== "Home" || venueTypeManual);

<Button
  onClick={() => {
    if (!canBuildRig) {
      toast.error(
        venue === "Home"
          ? "Pick Stillwater or River for your home session"
          : "Pick a venue first"
      );
      return;
    }
    setShowWizard(true);
  }}
  disabled={!canBuildRig}
  ...
>
  Build your rig <ArrowRight className="h-4 w-4 ml-2" />
</Button>
```

For real venues with successful auto-detect, `venueTypeResolved === true` makes the CTA enable as today. The new gate only kicks in for Home.

---

## 4. Pass `null` to the wizard when the user hasn't picked yet (Home, pre-toggle)

This shouldn't happen in practice because of §3's CTA gate, but type-safety matters.

`src/components/diary/setup/SetupWizard.tsx`

Widen the prop type:

```ts
interface SetupWizardProps {
  userId: string;
  venueName: string;
  venueWaterType: "stillwater" | "river" | null;   // null = Home / unresolved
  onCancel: () => void;
  onComplete: (commit: WizardCommit) => Promise<void> | void;
}
```

Then audit the consumers inside the wizard:

- **Defaults `useEffect` (line ~95-132):** `(wt === "river" ? river_default : stillwater_default)` — null falls to the stillwater branch. The hardcoded final fallback `(wt === "river" ? 5 : 7)` does the same. Already null-safe; no change needed.
- **SavedRigsBanner mount (line ~265):** passes `venueWaterType` through. SavedRigsBanner already handles null in its filter (`venueWaterType ? data.filter(...) : data` at `SavedRigsBanner.tsx:34-36`). No change needed there either — verify with a quick read.

So the only edit in SetupWizard is the prop type. The §3 CTA gate guarantees we never reach the wizard with null in practice.

---

## 5. Commit-time write — already correct, verify only

`src/pages/DiaryNew.tsx` line 80-82 already writes:

```ts
venue_name: venue,            // "Home" lands as a literal string
venue_type: venueType,        // "stillwater" or "river" — manually chosen
```

The post-commit `find venue_id` block at lines 161-176 does:

```ts
const { data: matchedVenue } = await supabase
  .from("venues_new")
  .select("venue_id, contact_email")
  .ilike("name", venue)
  .limit(1)
  .maybeSingle();
if (matchedVenue?.venue_id) { /* fire on-session-logged etc */ }
```

For "Home", `matchedVenue` is null (no row), so the entire if-block is skipped — no `venue_id` set, no `on-session-logged` invocation, no email lookup. **This is the desired behaviour** — Home sessions don't trigger venue analytics or outreach. Verify nothing else in the commit chain assumes a non-null `venue_id`.

---

## 6. Verification

1. **Build clean:** `npm run build`. No TS errors.
2. **Home flow — happy path:**
   - Open `/diary/new`. Confirm Home appears at the top of the dropdown under an "Practice" optgroup.
   - Type "river" in the filter. Confirm Home still shows; real river venues filter too.
   - Pick Home. Confirm the water-type toggle renders in **warning state** with "Couldn't detect water type — please choose".
   - Confirm "Build your rig" is **disabled** until you tap Stillwater or River.
   - Tap Stillwater. CTA enables. Tap → wizard opens.
   - Confirm SavedRigsBanner shows ALL presets (no filter, since Home was treated as null until the toggle flipped — once flipped, it filters by the picked water type which is the desired behaviour).
   - Walk through the wizard and start a session.
3. **DB row check:**
   ```sql
   SELECT venue_name, venue_id, venue_type, plan, rod_weight
   FROM public.fishing_sessions
   WHERE user_id = auth.uid()
   ORDER BY created_at DESC LIMIT 1;
   ```
   Expect `venue_name = 'Home'`, `venue_id IS NULL`, `venue_type = 'stillwater'` (or whatever was picked).
4. **No outreach side effects:**
   - Confirm `venue_outreach` got no new row. Confirm `on-session-logged` was not invoked (no toast / no log).
5. **Catch on Home session:**
   - Open the active Home session. Tap Log a catch. Confirm CatchFlow loads the rod row (it was written by the wizard) and species chips show stillwater (or river) defaults.
   - Save a catch. Confirm `session_events` row lands with the catch correctly attributed to the Home session.
6. **Switching back to a real venue mid-flow:**
   - On a fresh basics view, pick Home → tap River. Then change the dropdown to a real stillwater venue. Confirm `venueTypeManual` resets to false and auto-detect resumes (toggle should auto-flip to Stillwater).

---

## Out of scope

- **Don't add a "Home" entry to `venues_new`.** Whole point of this prompt.
- **Don't add a special UI badge / icon for Home sessions in the timeline / map.** Existing components render `venue_name` verbatim — "Home" will read fine. UX polish for later if it matters.
- **Don't filter Home sessions out of analytics queries here.** Downstream (master DB sync, ML) can decide whether to exclude `venue_id IS NULL` rows. App-side, we treat them like any other session.
- **Don't add a "Practice" mode toggle separate from the venue picker.** One affordance is simpler.
- **Don't add other pseudo-venues** (e.g. "Boat trip", "Saltwater") in this prompt. Home is the one explicit ask.

---

## Response capture

Per protocol 128, write to `lovable instructions/responses/144_response.md`:

- Pre-flight grep findings.
- Diff summary per section (1–5).
- Screenshots:
  - Dropdown open with Home under "Practice" optgroup.
  - Basics block after picking Home (water-type toggle in warning state, CTA disabled).
  - Basics block after picking Stillwater on a Home session (CTA enabled).
  - DB row from §3 of Verification (redacted on user_id).
- Any place where `venueWaterType` consumers needed null handling that the prompt didn't anticipate.
