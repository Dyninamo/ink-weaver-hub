import { positionsForFlyCount, type RodSetupState, type FlyPosition } from "./vocabulary";

export interface PresetRow {
  id: string;
  name: string;
  rod: RodSetupState;          // post-203 §1, canonical
  water_type: string | null;
  include_flies: boolean;
  last_used_at: string;
}

/** Defensive read — handles both canonical and pre-203 legacy keys. */
export function readPresetRod(blob: any): RodSetupState {
  const rodLengthFt =
    typeof blob?.rodLengthFt === "number"
      ? blob.rodLengthFt
      : typeof blob?.rodLength === "string"
      ? parseFloat(blob.rodLength.replace(/ft$/, ""))
      : null;
  const leaderLengthFt =
    typeof blob?.leaderLengthFt === "number"
      ? blob.leaderLengthFt
      : typeof blob?.leaderLength === "string"
      ? parseFloat(blob.leaderLength.replace(/ft$/, ""))
      : null;
  return {
    rodWeight: blob?.rodWeight ?? null,
    rodLengthFt: Number.isFinite(rodLengthFt) ? rodLengthFt : null,
    lineProfile: blob?.lineProfile ?? blob?.line ?? null,
    leaderId: blob?.leaderId ?? null,
    leaderMaterial: blob?.leaderMaterial ?? null,
    leaderLengthFt: Number.isFinite(leaderLengthFt) ? leaderLengthFt : null,
    leaderStrengthLb: blob?.leaderStrengthLb ?? null,
    style: blob?.style ?? null,
    flyCount: (blob?.flyCount ?? 2) as RodSetupState["flyCount"],
    flies: blob?.flies ?? {},
  };
}

/** Validates that every fly position implied by flyCount is populated. */
export function isPresetComplete(rod: Pick<RodSetupState, "flyCount" | "flies">): boolean {
  return positionsForFlyCount(rod.flyCount as number).every(
    (pos: FlyPosition) => !!(rod.flies as any)?.[pos]?.name
  );
}

/** Lightweight validator — accepts a row if it has the minimum required shape. */
export function isPresetRow(x: any): x is PresetRow {
  return (
    !!x &&
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    typeof x.include_flies === "boolean" &&
    typeof x.last_used_at === "string" &&
    (x.water_type === null || typeof x.water_type === "string") &&
    !!x.rod && typeof x.rod === "object"
  );
}

/** Single source of truth for wizard.commit telemetry payload. */
export function buildCommitPayload(args: {
  state: RodSetupState;
  path: "existing" | "new";
  skipped_wizard: boolean;
  saved_preset: boolean;
}) {
  return {
    rod_weight: args.state.rodWeight,
    rod_length_ft: args.state.rodLengthFt,
    line: args.state.lineProfile,
    style: args.state.style,
    fly_count: args.state.flyCount,
    saved_preset: args.saved_preset,
    path: args.path,
    skipped_wizard: args.skipped_wizard,
  };
}
