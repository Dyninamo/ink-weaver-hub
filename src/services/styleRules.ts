// Style-pruning rules for the diary catch flow.
// Mirrors FishingDiary RN app's `vocabulary.ts` + `styleRules.ts` so PWA
// and RN capture the same canonical retrieve / depth-zone vocabulary.

export const CANONICAL_RETRIEVES = [
  "Slow retrieve",
  "Fast retrieve",
  "Figure of eight",
  "Strip",
  "Roly poly",
  "Static",
  "Dead drift",
] as const;

// NOTE: depth zones must stay in sync with NORMALISED_DEPTH_ZONES in diaryService.ts
export const CANONICAL_DEPTHS = [
  "Surface",
  "Upper",
  "Upper to mid",
  "Mid",
  "Mid to deep",
  "Deep/Near bottom",
  "Bottom",
  "Variable/All depths",
] as const;

const RETRIEVE_BY_STYLE: Record<string, string[]> = {
  Dry: ["Static", "Dead drift"],
  "Dry-Dropper": ["Static", "Dead drift"],
  Buzzer: ["Slow retrieve", "Figure of eight", "Static", "Dead drift"],
  Wet: ["Slow retrieve", "Figure of eight", "Static"],
  Nymph: ["Slow retrieve", "Figure of eight", "Static", "Dead drift"],
  "Nymph/Buzzer": ["Slow retrieve", "Figure of eight", "Static", "Dead drift"],
  "Euro Nymph": ["Dead drift", "Static"],
  Lure: [
    "Slow retrieve",
    "Fast retrieve",
    "Strip",
    "Roly poly",
    "Figure of eight",
    "Static",
  ],
  // Note: prompt 138 lists "Lure+Nymph"; FISHING_STYLES uses "Lure + Nymph".
  // Map both spellings to the same set.
  "Lure + Nymph": ["Slow retrieve", "Strip", "Figure of eight", "Static"],
  "Lure+Nymph": ["Slow retrieve", "Strip", "Figure of eight", "Static"],
};

const DEPTH_BY_STYLE: Record<string, string[]> = {
  Dry: ["Surface"],
  "Dry-Dropper": ["Surface", "Upper"],
  Buzzer: ["Upper", "Upper to mid", "Mid"],
  Wet: ["Upper", "Upper to mid", "Mid"],
  Nymph: ["Upper to mid", "Mid", "Mid to deep", "Deep/Near bottom", "Bottom"],
  "Nymph/Buzzer": ["Upper", "Upper to mid", "Mid", "Mid to deep"],
  "Euro Nymph": ["Mid", "Mid to deep", "Deep/Near bottom", "Bottom"],
  Lure: [...CANONICAL_DEPTHS],
  "Lure + Nymph": [
    "Upper",
    "Upper to mid",
    "Mid",
    "Mid to deep",
    "Deep/Near bottom",
  ],
  "Lure+Nymph": [
    "Upper",
    "Upper to mid",
    "Mid",
    "Mid to deep",
    "Deep/Near bottom",
  ],
};

export function retrievesForStyle(style: string | null | undefined): string[] {
  if (!style) return [...CANONICAL_RETRIEVES];
  return RETRIEVE_BY_STYLE[style] ?? [...CANONICAL_RETRIEVES];
}

export function depthsForStyle(style: string | null | undefined): string[] {
  if (!style) return [...CANONICAL_DEPTHS];
  return DEPTH_BY_STYLE[style] ?? [...CANONICAL_DEPTHS];
}
