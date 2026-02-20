export interface FlyVariation {
  label: string;
  hookSize: number;
  colours: string[];
}

export interface RecommendedFly {
  rank: number;
  name: string;
  hookSize: number;
  colours: string[];
  category: string;
  source: "diary" | "report";
  catchPercent?: number;
  useCount?: number;
  confidence?: number;
  variations: FlyVariation[];
}
