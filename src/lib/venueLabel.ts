// Prompt 236 — friendly display label for the Home pseudo-venue.
// DB still stores `__home__:<wt>` (canonical, per response 146).
// This is display-only — never change persistence.
export function displayVenue(venue: string | null | undefined): string {
  if (!venue) return "Unknown";
  if (venue === "__home__" || venue.startsWith("__home__:")) {
    const wt = venue.includes(":") ? venue.split(":")[1] : "";
    const pretty =
      wt === "river" ? "River" : wt === "stillwater" ? "Stillwater" : "";
    return pretty ? `Home (${pretty})` : "Home";
  }
  return venue;
}
