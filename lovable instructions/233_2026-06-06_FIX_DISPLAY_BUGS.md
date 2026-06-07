# 233 — Fix 3 display bugs (notes blob, change [object Object], View→empty)

Three independent display bugs found in live testing. All PWA-side. Implement all
three; checklist at the bottom.

## Fix A — catch "note" shows a raw JSON metadata blob
`src/pages/DiaryEntry.tsx` (~line 652–660) renders `event.notes` verbatim. The RN
app folds metadata into `notes` as a JSON blob when a row has no dedicated column
for a field, so a synced catch's `notes` looks like:
`{"text":"…","voice_transcript":"…","input_method":"manual","kept_released":"released","rod_index":0,"rod_name":"Rod 1"}`
…which renders as that raw JSON.

**The blob shape** (from the RN mapper): keys are `text` (the actual human note),
`voice_transcript` (also human), and metadata-only keys `input_method`,
`kept_released`, `rod_index`, `rod_name`, plus other extras. When `notes` has **no**
extras it's a plain string.

**Fix:** decode before rendering (add a small helper, reuse anywhere notes render —
DiaryEntry timeline + fish tab):
```ts
function displayNote(notes: string | null): string | null {
  if (!notes) return null;
  const t = notes.trim();
  if (!t.startsWith("{")) return notes;            // plain text
  try {
    const o = JSON.parse(t);
    if (o && typeof o === "object") {
      const parts = [o.text, o.voice_transcript].filter(Boolean);
      return parts.length ? parts.join(" — ") : null; // hide pure-metadata blobs
    }
  } catch { /* not JSON → fall through */ }
  return notes;
}
```
Render `displayNote(event.notes)` and only show the note row when it's non-null.
(`kept_released` is already surfaced as Outcome; don't show it as a note.)

## Fix B — live "Recent" feed shows `Change [object Object]`
`src/components/diary/ReadyView.tsx` `RecentBody` (~line 73–76):
```ts
const summary = to ? Object.values(to).filter(Boolean).join(" · ") : "Setup change";
```
`change_to` values can themselves be objects (e.g. `{ point: { pattern, size } }`),
so `Object.values(...).join` yields `[object Object]`.

**Fix:** stringify leaf values robustly — for each value, if it's an object pull a
sensible field (`pattern`/`fly`/`name`) or skip it; if primitive use `String(v)`:
```ts
const flatten = (v: any): string | null => {
  if (v == null) return null;
  if (typeof v === "object") return v.pattern ?? v.fly ?? v.name ?? null;
  return String(v);
};
const summary = to
  ? (Object.values(to).map(flatten).filter(Boolean).join(" · ") || "Setup change")
  : "Setup change";
```
Apply the same to any `change_from` rendering if present.

## Fix C — "View" on a Recent Query opens an empty `/results`
`src/pages/Dashboard.tsx` `handleViewQuery` (~line 167–180) navigates with
`state.advice = query.advice_text`, but `Results.tsx` reads `state.advice_text`
(and `state.adviceV2`/structured fields) — so the text lands on the wrong key and
the card renders empty (no advice text, methods, flies, spots, weather).

**Fix:** pass the stored query in the **same state shape Results expects** — match
the fresh-advice `navigate("/results", …)` shape elsewhere in this file (~line
105). At minimum rename `advice` → `advice_text`, and also pass the stored
structured advice (the `adviceV2`/methods/flies/spots/rod-average payload) and
`weatherData` if `getQueryById` returns them, so a viewed query renders the full
card like a fresh one. If the structured payload isn't stored per-query, say so in
the response and render what's available (text + weather) without the empty card.

## Verify (check all three)
- [ ] A: a synced catch with metadata-only notes shows **no** note row (or just the
      real text), never raw `{...}`. A catch with a real typed note still shows it.
- [ ] B: a fly-change in the live Recent feed shows the pattern (e.g. "Change ·
      Cruncher"), never `[object Object]`.
- [ ] C: Dashboard → Recent Queries → View renders the full advice card (text +
      methods/flies/spots), not an empty page.
