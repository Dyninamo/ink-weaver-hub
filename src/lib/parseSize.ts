// Prompt 234 — shared catch size validation. Used by CatchFlow (in-session
// "Log a catch") and CatchEditForm (edit dialog). Bounds chosen with headroom
// for UK trophy fish but tight enough to kill fat-finger / overflow values.
export const WEIGHT_MIN_LB = 0;
export const WEIGHT_MAX_LB = 50;
export const LENGTH_MIN_IN = 0;
export const LENGTH_MAX_IN = 60;

export interface ParsedWeight {
  ok: boolean;
  lb: number | null;        // integer pounds
  oz: number | null;        // integer ounces (0..15)
  decimal: number | null;   // original decimal lb
  display: string | null;   // "12 lb 4 oz" / "12 lb"
  error: string | null;
}

export interface ParsedLength {
  ok: boolean;
  inches: number | null;
  display: string | null;
  error: string | null;
}

const HELPER_WEIGHT = `Enter a weight between ${WEIGHT_MIN_LB} and ${WEIGHT_MAX_LB} lb`;
const HELPER_LENGTH = `Enter a length between ${LENGTH_MIN_IN} and ${LENGTH_MAX_IN} in`;

// Strict numeric: digits, single optional decimal point. Rejects scientific
// notation (1e9), multiple dots, signs, whitespace inside the number.
const NUMERIC_RE = /^\d+(\.\d+)?$/;

function strictParse(input: string): number | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!NUMERIC_RE.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseWeight(raw: string): ParsedWeight {
  const empty: ParsedWeight = { ok: false, lb: null, oz: null, decimal: null, display: null, error: null };
  if (raw == null || raw === "") return empty;
  const n = strictParse(raw);
  if (n === null) return { ...empty, error: HELPER_WEIGHT };
  if (n <= WEIGHT_MIN_LB || n > WEIGHT_MAX_LB) return { ...empty, error: HELPER_WEIGHT };
  let lb = Math.floor(n);
  let oz = Math.round((n - lb) * 16);
  if (oz >= 16) { lb += 1; oz = 0; }
  const display = oz === 0 ? `${lb} lb` : `${lb} lb ${oz} oz`;
  return { ok: true, lb, oz, decimal: n, display, error: null };
}

export function parseLength(raw: string): ParsedLength {
  const empty: ParsedLength = { ok: false, inches: null, display: null, error: null };
  if (raw == null || raw === "") return empty;
  const n = strictParse(raw);
  if (n === null) return { ...empty, error: HELPER_LENGTH };
  if (n <= LENGTH_MIN_IN || n > LENGTH_MAX_IN) return { ...empty, error: HELPER_LENGTH };
  return { ok: true, inches: n, display: `${n} in`, error: null };
}
