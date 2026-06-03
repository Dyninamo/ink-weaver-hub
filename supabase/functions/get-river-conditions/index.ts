// Prompt 212 — server-side port of the master Wensum river-advice engine.
// Resolves a gauge from station_registry (discover-then-store into
// venue_station_map), fetches EA/NRW level+flow series + Open-Meteo precip,
// and returns a river_conditions projection for the PWA advice card.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { requireEnv, envErrorResponse } from "../_shared/env.ts";
import { requireUser } from "../_shared/user_auth.ts";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_CANDIDATES = 3;
const MAX_DISTANCE_KM = 30;

type Json = Record<string, unknown>;

interface SeriesSummary {
  latest_value: number | null;
  latest_date: string | null;
  delta_7d: number | null;
  n_days: number;
  unit?: string;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

function dKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const meanLat = ((lat1 + lat2) / 2) * Math.PI / 180;
  return Math.sqrt(dLat * dLat + (dLon * Math.cos(meanLat)) ** 2) * 111;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return isoDate(d);
}

// ---------- EA hydrology ----------
interface EAMeasure {
  "@id": string;
  parameter?: string;
  period?: number;
  unitName?: string;
  notation?: string;
}

async function fetchEASeries(hydrologyId: string): Promise<{ level?: SeriesSummary; flow?: SeriesSummary }> {
  const out: { level?: SeriesSummary; flow?: SeriesSummary } = {};
  let measures: EAMeasure[] = [];
  try {
    const r = await fetchWithTimeout(
      `https://environment.data.gov.uk/hydrology/id/stations/${encodeURIComponent(hydrologyId)}/measures.json`,
    );
    if (!r.ok) {
      console.warn("EA measures HTTP", r.status, hydrologyId);
      return out;
    }
    const j = await r.json();
    measures = (j.items ?? []) as EAMeasure[];
  } catch (e) {
    console.warn("EA measures fetch failed", hydrologyId, String(e));
    return out;
  }

  const pick = (param: "level" | "flow"): EAMeasure | null => {
    const candidates = measures.filter((m) => {
      if ((m.parameter ?? "").toLowerCase() !== param) return false;
      const id = (m["@id"] ?? "").toLowerCase();
      if (param === "level" && /gw|dipped|borehole|tidal/.test(id)) return false;
      return true;
    });
    if (candidates.length === 0) return null;
    const daily = candidates.find((m) => (m["@id"] ?? "").includes("-m-86400-"));
    if (daily) return daily;
    const p86400 = candidates.find((m) => m.period === 86400);
    return p86400 ?? candidates[0];
  };

  const minDate = daysAgo(14);
  for (const param of ["level", "flow"] as const) {
    const m = pick(param);
    if (!m) continue;
    try {
      const url = `${m["@id"]}/readings.json?_limit=2000&min-date=${minDate}`;
      const r = await fetchWithTimeout(url);
      if (!r.ok) {
        console.warn("EA readings HTTP", r.status, m["@id"]);
        continue;
      }
      const j = await r.json();
      const items: { dateTime: string; value: number }[] = (j.items ?? [])
        .filter((it: { value: unknown }) => typeof it.value === "number");
      // bucket to daily mean
      const byDay = new Map<string, { sum: number; n: number }>();
      for (const it of items) {
        const day = it.dateTime.slice(0, 10);
        const cur = byDay.get(day) ?? { sum: 0, n: 0 };
        cur.sum += it.value;
        cur.n += 1;
        byDay.set(day, cur);
      }
      const series = [...byDay.entries()]
        .map(([d, v]) => ({ d, v: v.sum / v.n }))
        .sort((a, b) => (a.d < b.d ? -1 : 1));
      if (series.length === 0) continue;
      const latest = series[series.length - 1];
      const sevenBack = series.length >= 8 ? series[series.length - 8].v : null;
      out[param] = {
        latest_value: latest.v,
        latest_date: latest.d,
        delta_7d: sevenBack !== null ? latest.v - sevenBack : null,
        n_days: series.length,
        unit: m.unitName ?? (param === "level" ? "m" : "m³/s"),
      };
    } catch (e) {
      console.warn("EA readings fetch failed", m["@id"], String(e));
    }
  }
  return out;
}

// ---------- NRW ----------
async function fetchNRWSeries(
  parameterIds: Record<string, number | string> | null,
): Promise<{ level?: SeriesSummary; flow?: SeriesSummary }> {
  const out: { level?: SeriesSummary; flow?: SeriesSummary } = {};
  if (!parameterIds) return out;
  const from = daysAgo(14);
  const to = daysAgo(0);
  for (const param of ["level", "flow"] as const) {
    const pid = parameterIds[param];
    if (pid === undefined || pid === null) continue;
    try {
      const url = `https://rivers-and-seas.naturalresources.wales/graph/getdata?parameterId=${encodeURIComponent(String(pid))}&from=${from}&to=${to}`;
      const r = await fetchWithTimeout(url, { headers: { "X-Requested-With": "XMLHttpRequest" } });
      if (!r.ok) {
        console.warn("NRW HTTP", r.status, pid);
        continue;
      }
      const j = await r.json();
      // Format varies; defensively look for array of {dateTime|x, value|y}
      const rawArr: unknown = Array.isArray(j) ? j : (j.data ?? j.values ?? j.items ?? []);
      const points: { dateTime: string; value: number }[] = [];
      if (Array.isArray(rawArr)) {
        for (const it of rawArr as Json[]) {
          const dt = (it.dateTime ?? it.x ?? it.date ?? it.timestamp) as string | number | undefined;
          const v = (it.value ?? it.y ?? it.val) as number | undefined;
          if (dt === undefined || typeof v !== "number") continue;
          const dtStr = typeof dt === "number" ? new Date(dt).toISOString() : String(dt);
          points.push({ dateTime: dtStr, value: v });
        }
      }
      if (points.length === 0) continue;
      const byDay = new Map<string, { sum: number; n: number }>();
      for (const it of points) {
        const day = it.dateTime.slice(0, 10);
        const cur = byDay.get(day) ?? { sum: 0, n: 0 };
        cur.sum += it.value;
        cur.n += 1;
        byDay.set(day, cur);
      }
      const series = [...byDay.entries()]
        .map(([d, v]) => ({ d, v: v.sum / v.n }))
        .sort((a, b) => (a.d < b.d ? -1 : 1));
      if (series.length === 0) continue;
      const latest = series[series.length - 1];
      const sevenBack = series.length >= 8 ? series[series.length - 8].v : null;
      out[param] = {
        latest_value: latest.v,
        latest_date: latest.d,
        delta_7d: sevenBack !== null ? latest.v - sevenBack : null,
        n_days: series.length,
        unit: param === "level" ? "m" : "m³/s",
      };
    } catch (e) {
      console.warn("NRW fetch failed", pid, String(e));
    }
  }
  return out;
}

// ---------- Open-Meteo ----------
async function fetchPrecip(
  lat: number,
  lon: number,
  targetDate: string,
): Promise<{ recent_rain_mm_7d: number | null; days_since_rain: number | null; forecast_rain_mm_ahead: number | null }> {
  try {
    const today = isoDate(new Date());
    const end = targetDate > today ? targetDate : today;
    const start = daysAgo(7);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&start_date=${start}&end_date=${end}&timezone=Europe%2FLondon`;
    const r = await fetchWithTimeout(url);
    if (!r.ok) {
      console.warn("Open-Meteo HTTP", r.status);
      return { recent_rain_mm_7d: null, days_since_rain: null, forecast_rain_mm_ahead: null };
    }
    const j = await r.json();
    const days: string[] = j?.daily?.time ?? [];
    const precs: number[] = j?.daily?.precipitation_sum ?? [];
    let recent = 0;
    let ahead = 0;
    let lastRainIdx: number | null = null;
    let todayIdx = -1;
    for (let i = 0; i < days.length; i++) {
      if (days[i] <= today) {
        recent += precs[i] ?? 0;
        todayIdx = i;
        if ((precs[i] ?? 0) >= 2.0) lastRainIdx = i;
      } else {
        ahead += precs[i] ?? 0;
      }
    }
    const daysSince = lastRainIdx !== null && todayIdx >= 0 ? todayIdx - lastRainIdx : null;
    return {
      recent_rain_mm_7d: recent,
      days_since_rain: daysSince,
      forecast_rain_mm_ahead: ahead,
    };
  } catch (e) {
    console.warn("Open-Meteo fetch failed", String(e));
    return { recent_rain_mm_7d: null, days_since_rain: null, forecast_rain_mm_ahead: null };
  }
}

// ---------- Inference ----------
type Trend = "rising" | "falling" | "steady";

function trendOf(delta7d: number | null, latest: number | null): Trend {
  if (delta7d === null || latest === null) return "steady";
  const scale = Math.max(Math.abs(latest), 0.05);
  const rel = delta7d / scale;
  if (delta7d > 0.02 && rel > 0.10) return "rising";
  if (delta7d < -0.02 && rel < -0.10) return "falling";
  return "steady";
}

function project(current: Trend, ahead: number | null, recent: number | null): Trend | "spate risk" {
  const a = ahead ?? 0;
  if (a >= 25) return "spate risk";
  if (a >= 10) return "rising";
  if (a < 3) {
    if (current === "falling" || (recent !== null && recent < 5)) return "falling";
    return "steady";
  }
  return current;
}

function stateLabel(
  projected: Trend | "spate risk",
  recent: number | null,
  daysSinceRain: number | null,
): string {
  const r = recent ?? 0;
  const band = r < 5 ? "low and clear" : r < 20 ? "normal, carrying some colour" : "up and coloured";
  const motion = projected === "spate risk"
    ? "heavy rain forecast — spate likely"
    : projected === "rising"
      ? "rising over the period"
      : projected === "falling"
        ? "continued recession"
        : "holding steady";
  let s = `${band}, ${motion}`;
  if (projected === "falling" && daysSinceRain !== null && daysSinceRain >= 5) {
    s += " (no significant rain in 5+ days)";
  }
  return s;
}

function adviceFor(projected: Trend | "spate risk"): string {
  switch (projected) {
    case "spate risk":
      return "Spate likely — fish heavier/weighted nymphs and bright streamers tight to the margins and slacker water. Hold off the main flow until levels stabilise.";
    case "rising":
      return "Water rising — go up a hook size and add weight. Bigger, darker patterns work; target inside of bends and crease lines.";
    case "falling":
      return "Low, dropping water — fish will be spooky. Drop tippet, fish longer leaders and smaller dries/nymphs, careful upstream approach. Best at dawn/dusk and in broken water.";
    case "steady":
    default:
      return "Conditions steady — standard tactics. Match the hatch and read the water.";
  }
}

// ---------- Handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req, corsHeaders);
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const venue_name = String(body.venue_name ?? "").trim();
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    const date = String(body.date ?? isoDate(new Date()));
    const river_hint = String(body.river_hint ?? venue_name.replace(/^River\s+/i, "")).trim();

    if (!venue_name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return new Response(
        JSON.stringify({ error: "venue_name, lat, lon required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // 1a. Existing mapping
    const candidates: Array<{ station_id: string; distance_km: number; match_type: string; persist: boolean }> = [];
    const { data: mapped } = await supabase
      .from("venue_station_map")
      .select("station_id, distance_km, match_type")
      .eq("venue_name", venue_name)
      .eq("data_type", "level_flow")
      .maybeSingle();

    if (mapped?.station_id) {
      candidates.push({
        station_id: mapped.station_id,
        distance_km: mapped.distance_km ?? 0,
        match_type: mapped.match_type ?? "mapped",
        persist: false,
      });
    }

    // 1b. If nothing (or to add fallbacks), pull nearest from registry.
    // We always load nearby candidates so we can fall through dormant gauges.
    const { data: registry } = await supabase
      .from("station_registry")
      .select("station_id, source, hydrology_id, nrw_station_id, nrw_parameter_ids, river_name, latitude, longitude, has_level, has_flow, station_name, status")
      .or("has_level.eq.true,has_flow.eq.true")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    const ranked = (registry ?? [])
      .filter((s: Json) => (s.status ?? "") !== "closed")
      .map((s: Json) => ({
        ...s,
        _dist: dKm(lat, lon, s.latitude as number, s.longitude as number),
      }))
      .filter((s) => s._dist <= MAX_DISTANCE_KM)
      .sort((a, b) => {
        const aSame = river_hint && a.river_name && String(a.river_name).toLowerCase().includes(river_hint.toLowerCase()) ? 0 : 1;
        const bSame = river_hint && b.river_name && String(b.river_name).toLowerCase().includes(river_hint.toLowerCase()) ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
        return a._dist - b._dist;
      });

    if (candidates.length === 0) {
      if (ranked.length === 0) {
        return new Response(
          JSON.stringify({ river_conditions: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const top = ranked[0];
      const sameRiver = river_hint && top.river_name &&
        String(top.river_name).toLowerCase().includes(river_hint.toLowerCase());
      candidates.push({
        station_id: top.station_id as string,
        distance_km: top._dist,
        match_type: sameRiver ? "same_river_auto" : "nearest_auto",
        persist: true,
      });
      // append fallbacks
      for (const s of ranked.slice(1, MAX_CANDIDATES)) {
        candidates.push({
          station_id: s.station_id as string,
          distance_km: s._dist,
          match_type: "fallback",
          persist: false,
        });
      }
    } else {
      // mapped + add up to 2 nearby fallbacks (skip already-included id)
      for (const s of ranked) {
        if (candidates.length >= MAX_CANDIDATES) break;
        if (candidates.some((c) => c.station_id === s.station_id)) continue;
        candidates.push({
          station_id: s.station_id as string,
          distance_km: s._dist,
          match_type: "fallback",
          persist: false,
        });
      }
    }

    // 1c. Try candidates in order
    type RegistryRow = {
      station_id: string;
      source: string;
      hydrology_id: string | null;
      nrw_station_id: string | null;
      nrw_parameter_ids: Record<string, number | string> | null;
      river_name: string | null;
      latitude: number;
      longitude: number;
      station_name: string | null;
    };

    let chosen: { reg: RegistryRow; dist: number; match: string; persist: boolean; level?: SeriesSummary; flow?: SeriesSummary } | null = null;

    for (const c of candidates.slice(0, MAX_CANDIDATES)) {
      const reg = (registry ?? []).find((r: Json) => r.station_id === c.station_id) as RegistryRow | undefined;
      if (!reg) {
        // fetch lazily if mapped to one not in our cached registry list (e.g. closed)
        const { data: one } = await supabase
          .from("station_registry")
          .select("station_id, source, hydrology_id, nrw_station_id, nrw_parameter_ids, river_name, latitude, longitude, station_name")
          .eq("station_id", c.station_id)
          .maybeSingle();
        if (!one) continue;
        const dist = dKm(lat, lon, one.latitude as number, one.longitude as number);
        const series = one.source === "NRW"
          ? await fetchNRWSeries(one.nrw_parameter_ids)
          : await fetchEASeries(one.hydrology_id ?? "");
        if (series.level || series.flow) {
          chosen = { reg: one as RegistryRow, dist, match: c.match_type, persist: c.persist, ...series };
          break;
        }
        continue;
      }
      const series = reg.source === "NRW"
        ? await fetchNRWSeries(reg.nrw_parameter_ids)
        : await fetchEASeries(reg.hydrology_id ?? "");
      if (series.level || series.flow) {
        chosen = { reg, dist: c.distance_km, match: c.match_type, persist: c.persist, ...series };
        break;
      }
    }

    if (!chosen) {
      return new Response(
        JSON.stringify({ river_conditions: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Persist the discover-then-store mapping
    if (chosen.persist) {
      const { error: upErr } = await supabase
        .from("venue_station_map")
        .upsert({
          venue_name,
          data_type: "level_flow",
          station_id: chosen.reg.station_id,
          distance_km: chosen.dist,
          match_type: chosen.match,
        }, { onConflict: "venue_name,data_type" });
      if (upErr) console.warn("venue_station_map upsert failed", upErr.message);
    }

    // 3. Precip
    const precip = await fetchPrecip(lat, lon, date);

    // 4. Inference — driver = flow if present else level
    const driver = chosen.flow ?? chosen.level ?? null;
    const current = driver
      ? trendOf(driver.delta_7d, driver.latest_value)
      : "steady";
    const projected = project(current, precip.forecast_rain_mm_ahead, precip.recent_rain_mm_7d);
    const label = stateLabel(projected, precip.recent_rain_mm_7d, precip.days_since_rain);
    const advice = adviceFor(projected);

    const out: Json = {
      station: {
        label: chosen.reg.station_name ?? chosen.reg.station_id,
        river: chosen.reg.river_name,
        distance_km: Number(chosen.dist.toFixed(2)),
        source: chosen.reg.source,
      },
      ...(chosen.level && {
        level: {
          latest: chosen.level.latest_value,
          unit: chosen.level.unit ?? "m",
          delta_7d: chosen.level.delta_7d,
          trend: trendOf(chosen.level.delta_7d, chosen.level.latest_value),
        },
      }),
      ...(chosen.flow && {
        flow: {
          latest: chosen.flow.latest_value,
          unit: chosen.flow.unit ?? "m³/s",
          delta_7d: chosen.flow.delta_7d,
          trend: trendOf(chosen.flow.delta_7d, chosen.flow.latest_value),
        },
      }),
      recent_rain_mm_7d: precip.recent_rain_mm_7d,
      days_since_rain: precip.days_since_rain,
      forecast_rain_mm_ahead: precip.forecast_rain_mm_ahead,
      projected_trend: projected,
      state_label: label,
      advice,
    };

    return new Response(
      JSON.stringify({ river_conditions: out }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const envResp = envErrorResponse(err, corsHeaders);
    if (envResp) return envResp;
    console.error("get-river-conditions error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
