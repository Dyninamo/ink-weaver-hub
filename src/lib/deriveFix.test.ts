// Prompt 219 — unit tests for deriveFixFromTrail.
import { describe, it, expect } from "vitest";
import { deriveFixFromTrail } from "@/lib/deriveFix";
import type { TrailPoint } from "@/services/diaryService";

const iso = (ms: number) => new Date(ms).toISOString();

describe("deriveFixFromTrail", () => {
  it("returns none for empty/null/undefined trail", () => {
    const t = iso(1_700_000_000_000);
    const cases: Array<TrailPoint[] | null | undefined> = [[], null, undefined];
    for (const trail of cases) {
      const r = deriveFixFromTrail(trail, t);
      expect(r.latitude).toBeNull();
      expect(r.confidence).toBe("none");
    }
  });

  it("returns none for unparseable time", () => {
    const trail: TrailPoint[] = [
      { timestamp: iso(1_700_000_000_000), latitude: 50, longitude: -3, accuracy: 5 },
    ];
    const r = deriveFixFromTrail(trail, "not-a-date");
    expect(r.latitude).toBeNull();
    expect(r.confidence).toBe("none");
  });

  it("single point → edge, placed at that point", () => {
    const trail: TrailPoint[] = [
      { timestamp: iso(1_700_000_000_000), latitude: 50.1, longitude: -3.2, accuracy: 7 },
    ];
    const r = deriveFixFromTrail(trail, iso(1_700_000_500_000));
    expect(r.confidence).toBe("edge");
    expect(r.latitude).toBe(50.1);
    expect(r.longitude).toBe(-3.2);
  });

  it("time before track → edge, clamped to first", () => {
    const t0 = 1_700_000_000_000;
    const trail: TrailPoint[] = [
      { timestamp: iso(t0), latitude: 50.0, longitude: -3.0, accuracy: 5 },
      { timestamp: iso(t0 + 60_000), latitude: 50.001, longitude: -3.001, accuracy: 5 },
    ];
    const r = deriveFixFromTrail(trail, iso(t0 - 10_000));
    expect(r.confidence).toBe("edge");
    expect(r.latitude).toBe(50.0);
  });

  it("time after track → edge, clamped to last", () => {
    const t0 = 1_700_000_000_000;
    const trail: TrailPoint[] = [
      { timestamp: iso(t0), latitude: 50.0, longitude: -3.0, accuracy: 5 },
      { timestamp: iso(t0 + 60_000), latitude: 50.001, longitude: -3.001, accuracy: 5 },
    ];
    const r = deriveFixFromTrail(trail, iso(t0 + 120_000));
    expect(r.confidence).toBe("edge");
    expect(r.latitude).toBe(50.001);
  });

  it("interior midpoint → interpolated", () => {
    const t0 = 1_700_000_000_000;
    const trail: TrailPoint[] = [
      { timestamp: iso(t0), latitude: 50.0, longitude: -3.0, accuracy: 5 },
      { timestamp: iso(t0 + 30_000), latitude: 50.0002, longitude: -3.0002, accuracy: 5 },
    ];
    const r = deriveFixFromTrail(trail, iso(t0 + 15_000));
    expect(r.latitude).toBeCloseTo(50.0001, 6);
    expect(r.longitude).toBeCloseTo(-3.0001, 6);
  });

  it("high confidence over long gap when fixes are close (~5.5m)", () => {
    const t0 = 1_700_000_000_000;
    // ~5.5m apart in latitude (5e-5 deg ≈ 5.56m)
    const trail: TrailPoint[] = [
      { timestamp: iso(t0), latitude: 50.0, longitude: -3.0, accuracy: 5 },
      { timestamp: iso(t0 + 3_600_000), latitude: 50.00005, longitude: -3.0, accuracy: 5 },
    ];
    const r = deriveFixFromTrail(trail, iso(t0 + 1_800_000));
    expect(r.confidence).toBe("high");
    expect(r.bracketDistanceM).toBeLessThan(15);
  });

  it("low confidence when fixes are far apart (~1.1km)", () => {
    const t0 = 1_700_000_000_000;
    // 0.01 deg lat ≈ 1.11km
    const trail: TrailPoint[] = [
      { timestamp: iso(t0), latitude: 50.0, longitude: -3.0, accuracy: 8 },
      { timestamp: iso(t0 + 60_000), latitude: 50.01, longitude: -3.0, accuracy: 8 },
    ];
    const r = deriveFixFromTrail(trail, iso(t0 + 30_000));
    expect(r.confidence).toBe("low");
    expect(r.bracketDistanceM).toBeGreaterThan(75);
  });

  it("out-of-order trail is sorted before interpolating", () => {
    const t0 = 1_700_000_000_000;
    const trail: TrailPoint[] = [
      { timestamp: iso(t0 + 30_000), latitude: 50.0002, longitude: -3.0002, accuracy: 5 },
      { timestamp: iso(t0), latitude: 50.0, longitude: -3.0, accuracy: 5 },
    ];
    const r = deriveFixFromTrail(trail, iso(t0 + 15_000));
    expect(r.latitude).toBeCloseTo(50.0001, 6);
    expect(r.longitude).toBeCloseTo(-3.0001, 6);
  });

  it("accuracy widens with bracket distance", () => {
    const t0 = 1_700_000_000_000;
    const trail: TrailPoint[] = [
      { timestamp: iso(t0), latitude: 50.0, longitude: -3.0, accuracy: 8 },
      { timestamp: iso(t0 + 60_000), latitude: 50.01, longitude: -3.0, accuracy: 8 },
    ];
    const r = deriveFixFromTrail(trail, iso(t0 + 30_000));
    expect(r.accuracy).not.toBeNull();
    expect(r.accuracy!).toBeGreaterThan(8);
    // Roughly max(8,8) + bracketDistanceM/2
    expect(r.accuracy!).toBeCloseTo(8 + r.bracketDistanceM / 2, 5);
  });
});
