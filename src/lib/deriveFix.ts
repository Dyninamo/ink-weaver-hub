// Prompt 217 — port of RN deriveFix. Pure, deterministic.
import type { TrailPoint } from '@/services/diaryService';

export type DerivedConfidence = 'high' | 'approx' | 'low' | 'edge' | 'none';

export interface DerivedFix {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  confidence: DerivedConfidence;
  bracketDistanceM: number;
  note: string;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ParsedPoint {
  t: number;
  lat: number;
  lon: number;
  acc: number;
}

const NONE_INVALID: DerivedFix = {
  latitude: null,
  longitude: null,
  accuracy: null,
  confidence: 'none',
  bracketDistanceM: 0,
  note: 'Invalid time.',
};

export function deriveFixFromTrail(
  trail: TrailPoint[] | null | undefined,
  timestampISO: string
): DerivedFix {
  const t = Date.parse(timestampISO);
  if (!Number.isFinite(t)) return NONE_INVALID;

  const pts: ParsedPoint[] = (trail ?? [])
    .map((p) => {
      const pt = Date.parse(p.timestamp);
      return {
        t: pt,
        lat: Number(p.latitude),
        lon: Number(p.longitude),
        acc: p.accuracy == null ? 0 : Number.isFinite(Number(p.accuracy)) ? Number(p.accuracy) : 0,
      };
    })
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .sort((a, b) => a.t - b.t);

  if (pts.length === 0) {
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      confidence: 'none',
      bracketDistanceM: 0,
      note: 'No GPS track for this session.',
    };
  }

  if (pts.length === 1) {
    const p = pts[0];
    return {
      latitude: p.lat,
      longitude: p.lon,
      accuracy: p.acc || null,
      confidence: 'edge',
      bracketDistanceM: 0,
      note: 'Only one GPS point — placed there.',
    };
  }

  const first = pts[0];
  const last = pts[pts.length - 1];

  if (t <= first.t) {
    return {
      latitude: first.lat,
      longitude: first.lon,
      accuracy: first.acc || null,
      confidence: 'edge',
      bracketDistanceM: 0,
      note: 'before the track started — placed at the first point.',
    };
  }
  if (t >= last.t) {
    return {
      latitude: last.lat,
      longitude: last.lon,
      accuracy: last.acc || null,
      confidence: 'edge',
      bracketDistanceM: 0,
      note: 'after the track ended — placed at the last point.',
    };
  }

  // Binary search: largest i with pts[i].t <= t
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (pts[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  const a = pts[lo];
  const b = pts[lo + 1];
  const span = b.t - a.t;
  const f = span > 0 ? (t - a.t) / span : 0;
  const lat = a.lat + (b.lat - a.lat) * f;
  const lon = a.lon + (b.lon - a.lon) * f;
  const bracketDistanceM = haversineMeters(a.lat, a.lon, b.lat, b.lon);
  const accuracy = Math.max(a.acc, b.acc) + bracketDistanceM / 2;

  let confidence: DerivedConfidence;
  let note: string;
  if (bracketDistanceM <= 15) {
    confidence = 'high';
    note = 'Placed from your GPS track.';
  } else if (bracketDistanceM <= 75) {
    confidence = 'approx';
    note = 'Approximate — placed between two track points.';
  } else {
    confidence = 'low';
    note = 'Rough — you were on the move and the track was sparse here.';
  }

  return {
    latitude: lat,
    longitude: lon,
    accuracy,
    confidence,
    bracketDistanceM,
    note,
  };
}
