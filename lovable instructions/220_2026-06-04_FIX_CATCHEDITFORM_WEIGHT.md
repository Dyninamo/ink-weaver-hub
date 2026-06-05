# 220 — Fix: `CatchEditForm` decimal weight → integer column (22P02)

**Live bug, found by testing the published PWA.** Adding/editing a past-session
catch with a **fractional weight** (e.g. `1.5`) fails: the insert is rejected with

```
POST /rest/v1/session_events 400
save catch {code: 22P02, message: invalid input syntax for type integer: "1.5"}
```

`session_events.weight_lb` is an **integer** column — the PWA stores weight as
`weight_lb` (whole pounds) + `weight_oz` (ounces) + a `weight_display` string.
`CatchEditForm` (prompt 218) skips that split and writes the raw decimal into
`weight_lb`, so any non-integer weight is impossible to save. (Integer weights
like `2` happen to work, which is why it wasn't caught.)

The live in-session logger `CatchFlow.tsx` already does this correctly — **match
it exactly.**

## Fix in `src/components/diary/CatchEditForm.tsx`

**On save (weight mode):** replicate `CatchFlow`'s conversion instead of
`weight_lb: Number(weightLb)`:
```ts
const f = parseFloat(weightLb);
let weight_lb: number | null = null;
let weight_oz: number | null = null;
let weight_display: string | null = null;
if (Number.isFinite(f) && f > 0) {
  weight_lb = Math.floor(f);
  weight_oz = Math.round((f - weight_lb) * 16);
  if (weight_oz >= 16) { weight_lb += 1; weight_oz = 0; }
  weight_display = weight_oz === 0 ? `${weight_lb} lb` : `${weight_lb} lb ${weight_oz} oz`;
}
// payload: weight_lb, weight_oz, weight_display, length_inches: null
```
**Length mode:** set `length_inches` and `weight_display = `${f} in`` exactly as
`CatchFlow` does; null out `weight_lb`/`weight_oz`. (Confirm `length_inches`
accepts decimals the same way CatchFlow relies on — if it's also integer-typed,
round it; but match CatchFlow's existing behaviour, which is in production.)

**On edit hydration (round-trip):** the form currently seeds the weight box from
`initial.weight_lb` only, which **drops the ounces** — a catch saved as 2 lb 8 oz
would re-open as "2". Seed the decimal from both columns:
```ts
const initialWeightDecimal =
  initial?.weight_lb != null
    ? String(initial.weight_lb + (initial.weight_oz ?? 0) / 16)
    : "";
```

Leave everything else in `CatchEditForm` unchanged. Do **not** touch `CatchFlow`.

## Verify (I will re-run this on the published PWA)
1. Add a catch with weight **2.5 lb** on a past session → saves with no 400;
   the row shows `weight_lb=2, weight_oz=8`, displays "2 lb 8 oz" (or your
   display format).
2. Edit that catch → the weight box re-opens showing **2.5** (not 2), change to
   **3.25**, save → `weight_lb=3, weight_oz=4`.
3. Integer weight (e.g. 2) still works. Length mode still works.

## Context
Found via live Playwright testing on 2026-06-04 after publish. Add/edit/delete UI,
chronological insert, soft-undo delete, and the no-trail location path all
verified working; this decimal-weight path was the one defect.
