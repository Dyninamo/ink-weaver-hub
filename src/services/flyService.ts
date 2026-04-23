// TODO: surface confidence_rating (1-5) as a visual cue on fly rows —
//       deferred pending design review (2026-04-23 — Nick).

import { supabase } from "@/integrations/supabase/client";

export type Suitability = "main" | "secondary" | "occasional" | "never";

export interface Fly {
  id: number;
  name: string;
  aliases: string[];
  category: string;
  sub_category: string | null;
  family: string | null;
  tiers: string[];
  tier_families: string[];
  hook_size_min: number | null;
  hook_size_max: number | null;
  imitation: string | null;
  colours: string[];
  accents: string[];
  weights: string[];
  hook_styles: string[];
  confidence_rating: number | null;
}

export interface FlyWithSuitability extends Fly {
  suitability: Suitability;
  evidence_count: number;
}

// ---------- helpers ----------

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {
      /* fall through */
    }
    return v ? [v] : [];
  }
  return [];
}

function rowToFly(r: any): Fly {
  return {
    id: r.id,
    name: r.name,
    aliases: asArray(r.aliases),
    category: r.category,
    sub_category: r.sub_category ?? null,
    family: r.family ?? null,
    tiers: asArray(r.tiers),
    tier_families: asArray(r.tier_families),
    hook_size_min: r.hook_size_min ?? null,
    hook_size_max: r.hook_size_max ?? null,
    imitation: r.imitation ?? null,
    colours: asArray(r.colours),
    accents: asArray(r.accents),
    weights: asArray(r.weights),
    hook_styles: asArray(r.hook_styles),
    confidence_rating: r.confidence_rating ?? null,
  };
}

function isValidSuitability(s: string): s is Suitability {
  return s === "main" || s === "secondary" || s === "occasional" || s === "never";
}

// ---------- venue water-type lookup ----------

const _waterTypeCache = new Map<string, number | null>();

export async function getVenueWaterTypeId(venueName: string): Promise<number | null> {
  const key = venueName.toLowerCase().trim();
  if (_waterTypeCache.has(key)) return _waterTypeCache.get(key) ?? null;
  const { data } = await supabase
    .from("venues_new")
    .select("water_type_id")
    .ilike("name", venueName)
    .limit(1)
    .maybeSingle();
  const id = (data?.water_type_id as number | null | undefined) ?? null;
  _waterTypeCache.set(key, id);
  return id;
}

// ---------- main API ----------

export async function getFlyTree(args: {
  waterTypeId: number;
  month: number;
  category: string;
}): Promise<{
  main: FlyWithSuitability[];
  secondary: FlyWithSuitability[];
  occasional: FlyWithSuitability[];
  other: FlyWithSuitability[];
}> {
  const { waterTypeId, month, category } = args;

  // 1. Fetch all flies in the chosen category.
  const { data: flyRows, error: flyErr } = await supabase
    .from("flies")
    .select(
      "id, name, aliases, category, sub_category, family, tiers, tier_families, hook_size_min, hook_size_max, imitation, colours, accents, weights, hook_styles, confidence_rating"
    )
    .eq("category", category);
  if (flyErr) throw flyErr;
  const flies = (flyRows ?? []).map(rowToFly);

  // 2. Fetch monthly suitability for the (water_type, month) — only for these flies.
  const names = flies.map((f) => f.name);
  let suitMap = new Map<string, { suitability: Suitability; evidence_count: number }>();
  if (names.length > 0) {
    const { data: suitRows } = await supabase
      .from("fly_water_type_monthly")
      .select("pattern_name, suitability, evidence_count")
      .eq("water_type_id", waterTypeId)
      .eq("month", month)
      .in("pattern_name", names);
    for (const row of suitRows ?? []) {
      if (!isValidSuitability(row.suitability)) continue;
      suitMap.set(row.pattern_name, {
        suitability: row.suitability,
        evidence_count: row.evidence_count ?? 0,
      });
    }
  }

  const annotated: FlyWithSuitability[] = flies.map((f) => {
    const s = suitMap.get(f.name);
    return {
      ...f,
      suitability: (s?.suitability ?? "never") as Suitability,
      evidence_count: s?.evidence_count ?? 0,
    };
  });

  const cmp = (a: FlyWithSuitability, b: FlyWithSuitability) =>
    b.evidence_count - a.evidence_count || a.name.localeCompare(b.name);

  const main = annotated.filter((f) => f.suitability === "main").sort(cmp);
  const secondary = annotated.filter((f) => f.suitability === "secondary").sort(cmp);
  const occasional = annotated.filter((f) => f.suitability === "occasional").sort(cmp);
  const other = annotated
    .filter((f) => f.suitability === "never")
    .sort((a, b) => a.name.localeCompare(b.name));

  return { main, secondary, occasional, other };
}

export async function searchFlies(args: {
  query: string;
  waterTypeId: number | null;
  month: number;
}): Promise<(FlyWithSuitability & { aliasMatch?: string })[]> {
  const { query, waterTypeId, month } = args;
  const q = query.toLowerCase().trim();
  if (!q) return [];

  // Pull all flies once — 549 rows is small. Filter client-side for ranked matching.
  const { data: flyRows, error } = await supabase
    .from("flies")
    .select(
      "id, name, aliases, category, sub_category, family, tiers, tier_families, hook_size_min, hook_size_max, imitation, colours, accents, weights, hook_styles, confidence_rating"
    );
  if (error) throw error;
  const flies = (flyRows ?? []).map(rowToFly);

  type Scored = { fly: Fly; rank: number; aliasMatch?: string };
  const matches: Scored[] = [];
  for (const f of flies) {
    const lname = f.name.toLowerCase();
    if (lname.startsWith(q)) {
      matches.push({ fly: f, rank: 1 });
      continue;
    }
    if (lname.includes(q)) {
      matches.push({ fly: f, rank: 2 });
      continue;
    }
    const aliasHit = f.aliases.find((a) => a.toLowerCase().includes(q));
    if (aliasHit) {
      matches.push({ fly: f, rank: 3, aliasMatch: aliasHit });
      continue;
    }
    if (f.family && f.family.toLowerCase().includes(q)) {
      matches.push({ fly: f, rank: 4 });
    }
  }

  matches.sort((a, b) => a.rank - b.rank || a.fly.name.localeCompare(b.fly.name));

  // Annotate with current-month suitability if waterTypeId is known.
  let suitMap = new Map<string, { suitability: Suitability; evidence_count: number }>();
  if (waterTypeId !== null && matches.length > 0) {
    const names = matches.map((m) => m.fly.name);
    const { data: suitRows } = await supabase
      .from("fly_water_type_monthly")
      .select("pattern_name, suitability, evidence_count")
      .eq("water_type_id", waterTypeId)
      .eq("month", month)
      .in("pattern_name", names);
    for (const row of suitRows ?? []) {
      if (!isValidSuitability(row.suitability)) continue;
      suitMap.set(row.pattern_name, {
        suitability: row.suitability,
        evidence_count: row.evidence_count ?? 0,
      });
    }
  }

  return matches.map(({ fly, aliasMatch }) => {
    const s = suitMap.get(fly.name);
    return {
      ...fly,
      suitability: (s?.suitability ?? "never") as Suitability,
      evidence_count: s?.evidence_count ?? 0,
      aliasMatch,
    };
  });
}

// ---------- water-type label (for headers) ----------

export const WATER_TYPE_LABELS: Record<number, string> = {
  1: "Small Stillwater",
  2: "Large Reservoir",
  3: "River — Freestone",
  4: "River — Chalkstream",
  5: "River — Spate",
  6: "River — Limestone",
  7: "Loch/Lough/Llyn",
};

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ---------- style → default category mapping ----------

export function defaultCategoryForStyle(style: string | null | undefined): string {
  switch (style) {
    case "Buzzer": return "Buzzer";
    case "Dry":
    case "Dry-Dropper": return "Dry";
    case "Lure":
    case "Lure + Nymph": return "Lure";
    case "Wet": return "Wet";
    case "Nymph":
    case "Nymph/Buzzer":
    case "Euro Nymph": return "Nymph";
    default: return "Nymph";
  }
}

export const SINKING_LINES = new Set(["Di-3", "Di-5", "Di-7", "Fast Sink"]);

// ---------- composed display name ----------

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Compose a display name from a pattern + qualifier picks.
 *  - "none" accent and "unweighted" weight are excluded
 *  - colour and pattern name are always included (when present)
 *  - Order: [accent] [weight] [colour] [name]
 */
export function composeFlyDisplayName(args: {
  name: string;
  colour: string | null;
  accent: string | null;
  weight: string | null;
}): string {
  const parts: string[] = [];
  if (args.accent && args.accent.toLowerCase() !== "none") parts.push(titleCase(args.accent));
  if (args.weight && args.weight.toLowerCase() !== "unweighted") parts.push(titleCase(args.weight));
  if (args.colour) parts.push(titleCase(args.colour));
  parts.push(args.name);
  return parts.join(" ");
}
