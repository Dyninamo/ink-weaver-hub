// Prompt 216 — capture a passive GPS trail during a live session.
// Throttle: keep a point only if ≥30s since last kept OR ≥5m moved.
// Buffer in memory; flush via `upload-diary-trail` edge function on flush()
// (called on session end) and as a best-effort beacon on unmount.
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BufferPoint {
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
}

const MIN_INTERVAL_MS = 30_000;
const MIN_MOVE_M = 5;
const MAX_POINTS = 5000;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface TrailRecorder {
  flush: () => Promise<void>;
}

export function useSessionTrailRecorder(sessionId: string | null | undefined): TrailRecorder {
  const bufferRef = useRef<BufferPoint[]>([]);
  const lastKeptRef = useRef<BufferPoint | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null | undefined>(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const flush = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const points = bufferRef.current;
    // Even an empty buffer is fine — replace-semantics handles "no trail" too,
    // but skip the call entirely when we never captured anything to avoid wiping
    // a trail captured elsewhere (e.g. from RN sync).
    if (!points || points.length === 0) return;
    const toSend = points.slice(0, MAX_POINTS);
    try {
      await supabase.functions.invoke("upload-diary-trail", {
        body: { session_id: sid, points: toSend },
      });
      bufferRef.current = [];
      lastKeptRef.current = null;
    } catch (err) {
      console.warn("[trail] flush failed (will retry on next flush):", err);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      console.info("[trail] geolocation unavailable; skipping trail capture");
      return;
    }

    let cancelled = false;
    let id: number | null = null;
    try {
      id = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          const { latitude, longitude, accuracy, altitude } = pos.coords;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          const now = new Date(pos.timestamp || Date.now()).toISOString();
          const candidate: BufferPoint = {
            timestamp: now,
            latitude,
            longitude,
            accuracy: Number.isFinite(accuracy) ? accuracy : null,
            altitude: Number.isFinite(altitude as number) ? (altitude as number) : null,
          };
          const last = lastKeptRef.current;
          if (last) {
            const dt = Date.parse(candidate.timestamp) - Date.parse(last.timestamp);
            const dm = haversineM(last.latitude, last.longitude, candidate.latitude, candidate.longitude);
            if (dt < MIN_INTERVAL_MS && dm < MIN_MOVE_M) return;
          }
          if (bufferRef.current.length >= MAX_POINTS) return;
          bufferRef.current.push(candidate);
          lastKeptRef.current = candidate;
        },
        (err) => {
          // PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT — never block logging.
          console.info("[trail] geolocation watch error (non-fatal):", err?.message || err);
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
      );
      watchIdRef.current = id;
    } catch (err) {
      console.warn("[trail] watchPosition threw:", err);
    }

    return () => {
      cancelled = true;
      if (watchIdRef.current != null && navigator.geolocation) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch { /* noop */ }
      }
      watchIdRef.current = null;
      // Best-effort flush on unmount (fire-and-forget).
      void flush();
    };
  }, [sessionId, flush]);

  return { flush };
}
