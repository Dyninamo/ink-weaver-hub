import { supabase } from "@/integrations/supabase/client";
import type { RecommendedFly, FlyVariation } from "@/types/flySelector";

interface RefFly {
  pattern_name: string | null;
  top_category: string | null;
  hook_size_min: string | null;
  hook_size_max: string | null;
  primary_colours: string | null;
}

function parseColours(colourStr: string | null): string[] {
  if (!colourStr) return [];
  return colourStr
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c && !c.includes('"'));
}

function generateVariations(
  flyName: string,
  currentHookSize: number,
  refFlies: RefFly[]
): FlyVariation[] {
  const variations: FlyVariation[] = [];
  const thisFly = refFlies.find((f) => f.pattern_name === flyName);
  if (!thisFly) return variations;

  const sizeMin = parseInt(thisFly.hook_size_min ?? "") || currentHookSize;
  const sizeMax = parseInt(thisFly.hook_size_max ?? "") || currentHookSize;

  // Size variations: even sizes within the fly's range
  for (let s = sizeMin; s <= sizeMax; s += 2) {
    if (s !== currentHookSize) {
      variations.push({
        label: `Size ${s}`,
        hookSize: s,
        colours: parseColours(thisFly.primary_colours),
      });
    }
  }

  // Colour variations: find other patterns in the same category with similar base name
  const baseName = flyName.replace(/\s*\(.*\)$/, "").trim();
  const colourVariants = refFlies.filter(
    (f) =>
      f.pattern_name !== flyName &&
      f.top_category === thisFly.top_category &&
      f.pattern_name?.startsWith(baseName) &&
      f.pattern_name?.includes("(")
  );

  for (const cv of colourVariants.slice(0, 2)) {
    const colourLabel = (cv.pattern_name ?? "").replace(baseName, "").trim();
    variations.push({
      label: `${colourLabel} · Size ${currentHookSize}`,
      hookSize: currentHookSize,
      colours: parseColours(cv.primary_colours),
    });
  }

  return variations.slice(0, 4);
}

export async function enrichFliesForSelector(
  tacticalFlies: { fly: string; weighted_catches: number; score: number }[],
  predictionFlies: { fly: string; frequency?: number; score?: number }[]
): Promise<RecommendedFly[]> {
  const { data: refFlies } = await supabase
    .from("ref_flies")
    .select(
      "pattern_name, top_category, hook_size_min, hook_size_max, primary_colours"
    );

  if (!refFlies || refFlies.length === 0) return [];

  const result: RecommendedFly[] = [];
  const usedNames = new Set<string>();
  let rank = 1;

  // 1. Tactical flies first (diary-sourced)
  const totalCatches = tacticalFlies.reduce(
    (s, f) => s + f.weighted_catches,
    0
  );
  for (const tf of tacticalFlies) {
    if (rank > 25) break;
    const ref = refFlies.find((r) => r.pattern_name === tf.fly);
    if (!ref) continue;

    const sizeMin = parseInt(ref.hook_size_min ?? "") || 12;
    const sizeMax = parseInt(ref.hook_size_max ?? "") || 12;
    const hookSize = sizeMin + Math.floor((sizeMax - sizeMin) / 2);
    const recSize = hookSize % 2 === 0 ? hookSize : hookSize + 1;

    const catchPercent =
      totalCatches > 0
        ? Math.round((tf.weighted_catches / totalCatches) * 100)
        : 0;

    result.push({
      rank: rank++,
      name: tf.fly,
      hookSize: recSize,
      colours: parseColours(ref.primary_colours),
      category: ref.top_category ?? "Other",
      source: "diary",
      catchPercent,
      useCount: Math.round(tf.weighted_catches),
      variations: generateVariations(tf.fly, recSize, refFlies),
    });
    usedNames.add(tf.fly);
  }

  // 2. Prediction flies (report-sourced) — fill remaining slots
  const maxScore = Math.max(...predictionFlies.map((f) => f.score ?? 0), 1);
  for (const pf of predictionFlies) {
    if (rank > 25) break;
    if (usedNames.has(pf.fly)) continue;

    let ref = refFlies.find((r) => r.pattern_name === pf.fly);
    if (!ref) {
      const matches = refFlies.filter((r) =>
        r.pattern_name?.toLowerCase().includes(pf.fly.toLowerCase())
      );
      if (matches.length > 0) {
        ref = matches.sort(
          (a, b) => (a.pattern_name?.length ?? 0) - (b.pattern_name?.length ?? 0)
        )[0];
      }
    }
    if (!ref) continue;

    const sizeMin = parseInt(ref.hook_size_min ?? "") || 12;
    const sizeMax = parseInt(ref.hook_size_max ?? "") || 12;
    const hookSize = sizeMin + Math.floor((sizeMax - sizeMin) / 2);
    const recSize = hookSize % 2 === 0 ? hookSize : hookSize + 1;

    result.push({
      rank: rank++,
      name: ref.pattern_name ?? pf.fly,
      hookSize: recSize,
      colours: parseColours(ref.primary_colours),
      category: ref.top_category ?? "Other",
      source: "report",
      confidence: (pf.score ?? 0) / maxScore,
      variations: generateVariations(ref.pattern_name ?? "", recSize, refFlies),
    });
    usedNames.add(pf.fly);
  }

  return result;
}
