// Mirrors RN's FishingDiary/src/data/vocabulary.ts
// (rod weights, lengths, lines, styles)

export const ROD_WEIGHTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type RodWeight = (typeof ROD_WEIGHTS)[number];

/** Inches range per rod weight: [min, max] in 6-inch increments. */
export function rodInchRangeForWeight(weight: number): [number, number] {
  if (weight <= 2) return [78, 90];   // 6'6"–7'6"
  if (weight === 3) return [78, 96];  // 6'6"–8'0"
  if (weight === 4) return [84, 102]; // 7'0"–8'6"
  if (weight === 5) return [84, 108]; // 7'0"–9'0"
  if (weight === 6) return [90, 114]; // 7'6"–9'6"
  if (weight === 7) return [84, 132]; // 7'0"–11'0"
  if (weight === 8) return [90, 132]; // 7'6"–11'0"
  if (weight === 9) return [96, 132]; // 8'0"–11'0"
  if (weight === 10) return [102, 144]; // 8'6"–12'0"
  if (weight === 11) return [108, 156]; // 9'0"–13'0"
  return [108, 168];                     // 9'0"–14'0"
}

/** Returns ordered list of inch lengths for a weight (6-inch step). */
export function rodLengthInchesForWeight(weight: number): number[] {
  const [min, max] = rodInchRangeForWeight(weight);
  const out: number[] = [];
  for (let v = min; v <= max; v += 6) out.push(v);
  return out;
}

/** Returns the median inch length for a weight (default selection). */
export function rodMedianInchesForWeight(weight: number): number {
  const list = rodLengthInchesForWeight(weight);
  return list[Math.floor(list.length / 2)];
}

export function inchesToFt(inches: number): number {
  return inches / 12;
}

export function inchesLabel(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return inch === 0 ? `${ft}'0"` : `${ft}'${inch}"`;
}

export function inchesToMetres(inches: number): number {
  return Math.round((inches * 0.0254) / 0.05) * 0.05;
}

export function metresLabel(inches: number): string {
  return `${inchesToMetres(inches).toFixed(2)} m`;
}

// ----- Lines -----

export const ALL_LINES = [
  "Floating",
  "Midge tip",
  "Sink-tip",
  "Slow glass",
  "Intermediate",
  "Di-3",
  "Di-5",
  "Di-7",
  "Fast Sink",
  "Booby basher",
  "Euro Mono",
] as const;

export function linesForWeight(weight: number): string[] {
  if (weight <= 4) return ["Floating", "Sink-tip", "Intermediate"];
  if (weight <= 6) return ["Floating", "Midge tip", "Sink-tip", "Slow glass", "Intermediate", "Di-3"];
  // 7+
  return [
    "Floating",
    "Midge tip",
    "Slow glass",
    "Intermediate",
    "Di-3",
    "Di-5",
    "Di-7",
    "Booby basher",
  ];
}

// ----- Style -----

export const STYLE_OPTIONS = [
  "Dry",
  "Dry-Dropper",
  "Buzzer",
  "Wet",
  "Nymph",
  "Nymph/Buzzer",
  "Euro Nymph",
  "Lure",
  "Lure+Nymph",
] as const;
export type StyleOption = (typeof STYLE_OPTIONS)[number];

// ----- Fly positions per fly count -----

export type FlyPosition = "point" | "middle" | "top" | "d1" | "d2" | "d3" | "d4";

export function positionsForFlyCount(flyCount: number): FlyPosition[] {
  switch (flyCount) {
    case 1: return ["point"];
    case 2: return ["point", "top"];
    case 3: return ["point", "middle", "top"];
    case 4: return ["point", "d1", "d2", "top"];
    case 5: return ["point", "d1", "d2", "d3", "top"];
    case 6: return ["point", "d1", "d2", "d3", "d4", "top"];
    default: return ["point"];
  }
}

export function positionLabel(pos: FlyPosition): string {
  switch (pos) {
    case "point": return "Point fly";
    case "middle": return "Middle dropper";
    case "top": return "Top / bob";
    case "d1": return "1st dropper";
    case "d2": return "2nd dropper";
    case "d3": return "3rd dropper";
    case "d4": return "4th dropper";
  }
}

// ----- RodSetup state -----

export type LeaderMaterial = "nylon" | "copolymer" | "mono" | "fluoro" | "furled";

export interface FlyEntry {
  name: string;
  size?: number | null;
}

export interface RodSetupState {
  rodWeight: number | null;
  rodLengthFt: number | null;
  lineProfile: string | null;
  leaderId: number | null;
  leaderMaterial: LeaderMaterial | null;
  leaderLengthFt: number | null;
  leaderStrengthLb: number | null;
  style: string | null;
  flyCount: 1 | 2 | 3 | 4 | 5 | 6;
  flies: Partial<Record<FlyPosition, FlyEntry>>;
}

export const EMPTY_ROD_SETUP: RodSetupState = {
  rodWeight: null,
  rodLengthFt: null,
  lineProfile: null,
  leaderId: null,
  leaderMaterial: null,
  leaderLengthFt: null,
  leaderStrengthLb: null,
  style: null,
  flyCount: 2,
  flies: {},
};
