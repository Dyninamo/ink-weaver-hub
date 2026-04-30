export function slugify(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function speciesLabel(s: string): string {
  const map: Record<string, string> = {
    rainbow: "Rainbow",
    brown: "Brown",
    blue: "Blue",
    tiger: "Tiger",
    brook: "Brook",
    triploid_brown: "Triploid Brown",
    triploid_rainbow: "Triploid Rainbow",
    salmon_parr: "Salmon Parr",
    sea_trout_smolt: "Sea Trout Smolt",
    other: "Other",
  };
  return map[s] ?? s;
}

export const SPECIES_OPTIONS = [
  "rainbow",
  "brown",
  "blue",
  "tiger",
  "brook",
  "triploid_brown",
  "triploid_rainbow",
  "salmon_parr",
  "sea_trout_smolt",
  "other",
];

export function speciesColorVar(s: string): string {
  // Returns an HSL string for chip backgrounds (semantic-ish)
  switch (s) {
    case "rainbow":
      return "hsl(85 35% 55%)"; // olive
    case "brown":
    case "triploid_brown":
      return "hsl(25 40% 38%)"; // brown #8B5E34
    case "blue":
      return "hsl(210 70% 50%)";
    case "tiger":
      return "hsl(35 80% 50%)";
    case "brook":
      return "hsl(150 45% 38%)";
    case "triploid_rainbow":
      return "hsl(85 30% 45%)";
    case "salmon_parr":
      return "hsl(15 60% 55%)";
    case "sea_trout_smolt":
      return "hsl(195 45% 50%)";
    default:
      return "hsl(215 16% 47%)";
  }
}
