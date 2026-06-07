# 236 — Friendly label for the Home pseudo-venue in Recent Queries (cosmetic)

Found in adversarial testing (2026-06-06): Dashboard → **Recent Queries** shows a
query titled **`__home__:river`** (raw sentinel + water type) instead of a
friendly label.

**Cause:** Home advice queries are saved with `venue = "__home__:<watertype>"`
(`get-ai-advice-v2/index.ts:512`, e.g. `__home__:river`). `Dashboard.tsx:412`
renders `{query.venue}` verbatim, so the sentinel leaks to the UI.

## Fix — format the stored venue for display
Add a small helper and use it wherever a stored `query.venue` is rendered:
```ts
// e.g. src/lib/venueLabel.ts
export function displayVenue(venue: string | null | undefined): string {
  if (!venue) return "Unknown";
  if (venue === "__home__" || venue.startsWith("__home__:")) {
    const wt = venue.includes(":") ? venue.split(":")[1] : "";
    const pretty = wt === "river" ? "River"
                 : wt === "stillwater" ? "Stillwater"
                 : "";
    return pretty ? `Home (${pretty})` : "Home";
  }
  return venue;
}
```
Apply at `Dashboard.tsx:412` (`{displayVenue(query.venue)}`) and anywhere else a
stored query venue is shown — at least:
- the Results page header when a saved query is opened (search for where
  `state.venue` / `query.venue` renders),
- any share/preview card that echoes the stored venue.

Do **not** change what's stored in the DB — `__home__:<wt>` stays as the
traceable canonical value (per response 146); this is display-only.

## Verify
- [ ] Recent Queries shows "Home (River)" / "Home (Stillwater)", never
      `__home__:river`.
- [ ] Opening that query (View) shows the same friendly label in the Results
      header.
- [ ] Real venue names (e.g. "Grafham Water") are unchanged.
