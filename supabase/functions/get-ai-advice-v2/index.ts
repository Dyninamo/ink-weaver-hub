import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { getPredictionParams, getVenueProfile } from "../_shared/prediction-params.ts";
import type { PredictionParams } from "../_shared/prediction-params.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ================================================================
// TYPES
// ================================================================

interface Forecast {
  temp: number;
  wind_speed_ms: number;
  wind_speed_mph: number;
  wind_dir: string;
  precip_mm_hr: number;
  pressure: number;
  humidity: number;
  conditions: string;
  is_historical: boolean;
}

interface ReportRow {
  venue: string;
  date: string;
  year: number | null;
  rod_average: number | null;
  methods: string[] | null;
  flies: string[] | null;
  best_spots: string[] | null;
  summary: string | null;
  t_mean_week: number | null;
  wind_speed_mean_week: number | null;
  precip_total_mm_week: number | null;
  pressure_mean_week: number | null;
  humidity_mean_week: number | null;
}

interface WeightedPeriod {
  weather: any;
  techniques: any[];
  spots: any[];
  flies: any[];
  catches: number;
  catch_by_hour: Record<string, number>;
  weight: number;
}

// ================================================================
// HELPERS
// ================================================================

function getSeason(dateStr: string): string {
  const month = new Date(dateStr).getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function getISOWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function isWithinWeekWindow(reportDate: string, targetWeek: number, window: number): boolean {
  const reportWeek = getISOWeek(reportDate);
  const diff = Math.abs(reportWeek - targetWeek);
  return Math.min(diff, 52 - diff) <= window;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / 86400000
  );
}

function getWindQuadrant(dir: string): string {
  const q: Record<string, string> = {
    N: "N", NNE: "N", NE: "N", ENE: "E", E: "E", ESE: "E",
    SE: "E", SSE: "S", S: "S", SSW: "S", SW: "S", WSW: "W",
    W: "W", WNW: "W", NW: "N", NNW: "N",
  };
  return q[dir] || "N";
}

/** Categorise hourly precipitation rate (mm/hr) */
function precipCatHourly(mm: number): number {
  if (mm == null || mm < 0.1) return 0;  // Dry
  if (mm < 1) return 1;                  // Light
  if (mm < 4) return 2;                  // Moderate
  return 3;                               // Heavy
}

/** Categorise weekly precipitation total (mm/week) */
function precipCatWeekly(mm: number | null): number {
  if (mm == null || mm < 2) return 0;    // Dry
  if (mm < 10) return 1;                 // Light
  if (mm < 25) return 2;                 // Moderate
  return 3;                               // Heavy
}

/** Categorise daily precipitation total (mm/day) */
function precipCatDaily(mm: number): number {
  if (mm == null || mm < 0.5) return 0;  // Dry
  if (mm < 3) return 1;                  // Light
  if (mm < 8) return 2;                  // Moderate
  return 3;                               // Heavy
}

const PRECIP_CAT_NAMES = ["Dry", "Light", "Moderate", "Heavy"];

function degreesToCompass(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(((deg % 360 + 360) % 360) / 22.5) % 16];
}

function weatherDistanceReport(
  fc: Forecast, r: ReportRow, params: PredictionParams
): number {
  let totalWeight = 0;
  let totalDist = 0;

  if (fc.temp != null && r.t_mean_week != null) {
    totalDist += params.w_temperature * Math.abs(fc.temp - r.t_mean_week) / 10;
    totalWeight += params.w_temperature;
  }
  if (fc.wind_speed_ms != null && r.wind_speed_mean_week != null) {
    totalDist +=
      params.w_wind_speed *
      Math.abs(fc.wind_speed_ms - r.wind_speed_mean_week) / 5;
    totalWeight += params.w_wind_speed;
  }
  if (params.w_precipitation > 0) {
    const fcCat = precipCatHourly(fc.precip_mm_hr);
    const rCat = precipCatWeekly(r.precip_total_mm_week);
    totalDist += params.w_precipitation * Math.abs(fcCat - rCat) / 3;
    totalWeight += params.w_precipitation;
  }
  if (params.w_pressure > 0 && fc.pressure != null && r.pressure_mean_week != null) {
    totalDist += params.w_pressure * Math.abs(fc.pressure - r.pressure_mean_week) / 30;
    totalWeight += params.w_pressure;
  }
  if (params.w_humidity > 0 && fc.humidity != null && r.humidity_mean_week != null) {
    totalDist += params.w_humidity * Math.abs(fc.humidity - r.humidity_mean_week) / 30;
    totalWeight += params.w_humidity;
  }

  return totalWeight > 0 ? totalDist / totalWeight : 1.0;
}

function weatherDistancePeriod(fc: Forecast, periodWeather: any): number {
  if (!periodWeather) return 1.0;
  let total = 0;
  let n = 0;

  if (fc.temp != null && periodWeather.temp != null) {
    total += Math.abs(fc.temp - periodWeather.temp) / 10;
    n++;
  }
  if (fc.wind_speed_mph != null && periodWeather.wind_speed != null) {
    total += Math.abs(fc.wind_speed_mph - periodWeather.wind_speed) / 15;
    n++;
  }
  if (fc.wind_dir && periodWeather.wind_dir) {
    const fcQ = getWindQuadrant(fc.wind_dir);
    const pQ = getWindQuadrant(periodWeather.wind_dir);
    const quads = ["N", "E", "S", "W"];
    const diff = Math.abs(quads.indexOf(fcQ) - quads.indexOf(pQ));
    total += Math.min(diff, 4 - diff) / 2;
    n++;
  }
  if (fc.precip_mm_hr != null && periodWeather.precip != null) {
    total +=
      Math.abs(
        precipCatHourly(fc.precip_mm_hr) - precipCatHourly(periodWeather.precip)
      ) / 3;
    n++;
  }

  return n > 0 ? total / n : 1.0;
}

function recencyWeight(
  reportDate: string, targetDate: string, yearDecay: number
): number {
  const days = daysBetween(reportDate, targetDate);
  return Math.pow(yearDecay, days / 365);
}

function rankItems(
  reports: (ReportRow & { weight: number })[],
  field: "methods" | "flies" | "best_spots",
  topN: number
): { name: string; frequency: number; score: number }[] {
  const scores = new Map<string, { freq: number; score: number }>();
  for (const r of reports) {
    const items = r[field];
    if (!items || !Array.isArray(items)) continue;
    for (const item of items) {
      const name = String(item).trim();
      if (!name) continue;
      const e = scores.get(name) ?? { freq: 0, score: 0 };
      e.freq += 1;
      e.score += r.weight;
      scores.set(name, e);
    }
  }
  return Array.from(scores.entries())
    .map(([name, { freq, score }]) => ({
      name,
      frequency: freq,
      score: Math.round(score * 100) / 100,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

function predictRodAverage(
  reports: (ReportRow & { weight: number })[]
): { predicted: number; range: [number, number]; confidence: string } {
  const valid = reports.filter((r) => r.rod_average != null && r.rod_average > 0);
  if (valid.length === 0)
    return { predicted: 0, range: [0, 0], confidence: "LOW" };

  let totalW = 0;
  let weightedSum = 0;
  const vals: number[] = [];
  for (const r of valid) {
    weightedSum += r.rod_average! * r.weight;
    totalW += r.weight;
    vals.push(r.rod_average!);
  }
  const predicted = Math.round((weightedSum / totalW) * 10) / 10;
  vals.sort((a, b) => a - b);
  const p10 = vals[Math.floor(vals.length * 0.1)] ?? 0;
  const p90 = vals[Math.floor(vals.length * 0.9)] ?? predicted;
  const confidence =
    valid.length >= 15 ? "HIGH" : valid.length >= 5 ? "MEDIUM" : "LOW";
  return {
    predicted,
    range: [Math.round(p10 * 10) / 10, Math.round(p90 * 10) / 10],
    confidence,
  };
}

// ================================================================
// MAIN HANDLER
// ================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { venue_name, target_date, user_id, debug, forecast_override, skip_ai } = await req.json();

    if (!venue_name || !target_date) {
      return new Response(
        JSON.stringify({ error: "Missing venue_name and target_date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const season = getSeason(target_date);
    const targetWeek = getISOWeek(target_date);

    // ── Venue lookup ───────────────────────────────────────────
    const { data: venue } = await supabase
      .from("venue_metadata")
      .select("id, name, latitude, longitude")
      .ilike("name", `%${venue_name}%`)
      .limit(1)
      .single();

    const venueId = venue?.id ?? null;
    const lat = venue?.latitude;
    const lon = venue?.longitude;

    // ── Prediction params + venue profile ──────────────────────
    const [rodParams, fliesParams, methodsParams, spotsParams, venueProfile] =
      await Promise.all([
        getPredictionParams(supabase, venue_name, "rod_average"),
        getPredictionParams(supabase, venue_name, "flies"),
        getPredictionParams(supabase, venue_name, "methods"),
        getPredictionParams(supabase, venue_name, "spots"),
        getVenueProfile(supabase, venue_name),
      ]);

    const weekWindow = rodParams.week_window;

    // ── Step 1: Fetch weather forecast ─────────────────────────
    let forecast: Forecast;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetMs = new Date(target_date + "T12:00:00Z").getTime();
    const daysOut = Math.round((targetMs - today.getTime()) / 86400000);

    async function buildHistoricalForecast(): Promise<Forecast> {
      const { data: histReports } = await supabase
        .from("fishing_reports")
        .select("t_mean_week, wind_speed_mean_week, precip_total_mm_week, pressure_mean_week, humidity_mean_week, report_date")
        .eq("venue", venue_name);

      const seasonal = (histReports ?? []).filter((r: any) =>
        r.t_mean_week != null &&
        isWithinWeekWindow(r.report_date, targetWeek, weekWindow + 2)
      );

      if (seasonal.length === 0) {
        return {
          temp: 10, wind_speed_ms: 4, wind_speed_mph: 9,
          wind_dir: "W", precip_mm_hr: 0, pressure: 1013,
          humidity: 75, conditions: "no forecast available",
          is_historical: true,
        };
      }

      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const temps = seasonal.map((r: any) => r.t_mean_week).filter(Boolean);
      const winds = seasonal.map((r: any) => r.wind_speed_mean_week).filter(Boolean);
      const pressures = seasonal.map((r: any) => r.pressure_mean_week).filter(Boolean);
      const humidities = seasonal.map((r: any) => r.humidity_mean_week).filter(Boolean);

      const avgWind = winds.length > 0 ? avg(winds) : 4;

      return {
        temp: temps.length > 0 ? Math.round(avg(temps) * 10) / 10 : 10,
        wind_speed_ms: avgWind,
        wind_speed_mph: Math.round(avgWind * 2.237 * 10) / 10,
        wind_dir: "W",
        precip_mm_hr: 0,
        pressure: pressures.length > 0 ? Math.round(avg(pressures)) : 1013,
        humidity: humidities.length > 0 ? Math.round(avg(humidities)) : 75,
        conditions: "historical average (no forecast available)",
        is_historical: true,
      };
    }

    // ── Override forecast for testing ─────────────────────────
    if (forecast_override) {
      const fo = forecast_override;
      const windMph = fo.wind_speed_mph ?? 10;
      forecast = {
        temp: fo.temp ?? 10,
        wind_speed_ms: windMph / 2.237,
        wind_speed_mph: windMph,
        wind_dir: fo.wind_dir ?? "W",
        precip_mm_hr: fo.precip_mm_3h != null ? fo.precip_mm_3h / 3 : (fo.precip_mm_hr ?? 0),
        pressure: fo.pressure ?? 1013,
        humidity: fo.humidity ?? 70,
        conditions: fo.conditions ?? "test override",
        is_historical: false,
      };
    } else if (lat && lon && daysOut >= 0 && daysOut <= 5) {
      const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
      const owmUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
      const owmRes = await fetch(owmUrl);
      const owm = await owmRes.json();

      if (owmRes.ok && owm.list?.length > 0) {
        const targetNoon = new Date(`${target_date}T12:00:00Z`).getTime();
        let closest = owm.list[0];
        let minDiff = Infinity;
        for (const entry of owm.list) {
          const diff = Math.abs(entry.dt * 1000 - targetNoon);
          if (diff < minDiff) { minDiff = diff; closest = entry; }
        }
        forecast = {
          temp: Math.round(closest.main.temp * 10) / 10,
          wind_speed_ms: closest.wind.speed,
          wind_speed_mph: Math.round(closest.wind.speed * 2.237 * 10) / 10,
          wind_dir: degreesToCompass(closest.wind?.deg ?? 0),
          precip_mm_hr: closest.rain?.["3h"] ? closest.rain["3h"] / 3 : 0,
          pressure: closest.main.pressure,
          humidity: closest.main.humidity,
          conditions: closest.weather?.[0]?.description ?? "unknown",
          is_historical: false,
        };
      } else {
        forecast = await buildHistoricalForecast();
      }
    } else if (lat && lon && daysOut >= 0) {
      const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
      const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
      const owmRes = await fetch(owmUrl);
      const owm = await owmRes.json();

      if (owmRes.ok) {
        forecast = {
          temp: Math.round(owm.main.temp * 10) / 10,
          wind_speed_ms: owm.wind.speed,
          wind_speed_mph: Math.round(owm.wind.speed * 2.237 * 10) / 10,
          wind_dir: degreesToCompass(owm.wind?.deg ?? 0),
          precip_mm_hr: owm.rain?.["1h"] ?? 0,
          pressure: owm.main.pressure,
          humidity: owm.main.humidity,
          conditions: owm.weather?.[0]?.description ?? "unknown",
          is_historical: daysOut > 5,
        };
      } else {
        forecast = await buildHistoricalForecast();
      }
    } else {
      forecast = await buildHistoricalForecast();
    }

    // ── Process 1+2: Report ranking ────────────────────────────
    const { data: allReports } = await supabase
      .from("fishing_reports")
      .select("venue, report_date, year, rod_average, methods, flies, best_spots, summary, t_mean_week, wind_speed_mean_week, precip_total_mm_week, pressure_mean_week, humidity_mean_week")
      .eq("venue", venue_name);

    const reports: ReportRow[] = (allReports ?? []).map((r: any) => ({
      venue: r.venue,
      date: r.report_date,
      year: r.year,
      rod_average: r.rod_average,
      methods: r.methods,
      flies: r.flies,
      best_spots: r.best_spots,
      summary: r.summary,
      t_mean_week: r.t_mean_week,
      wind_speed_mean_week: r.wind_speed_mean_week,
      precip_total_mm_week: r.precip_total_mm_week,
      pressure_mean_week: r.pressure_mean_week,
      humidity_mean_week: r.humidity_mean_week,
    }));

    const seasonalReports = reports.filter((r) =>
      isWithinWeekWindow(r.date, targetWeek, weekWindow)
    );

    // Compute combined weight (weather distance + recency)
    const weightedReports = seasonalReports.map((r) => {
      const wDist = weatherDistanceReport(forecast, r, rodParams);
      const wRecency = recencyWeight(r.date, target_date, rodParams.year_decay);
      const weight = (1 / (0.05 + wDist)) * wRecency;
      return { ...r, weight, _distance: wDist, _recency: wRecency };
    });

    // Sort by weight descending and take top N
    weightedReports.sort((a, b) => b.weight - a.weight);
    const topReports = weightedReports.slice(0, rodParams.top_n * 3);

    // Build debug candidates (sorted by distance for easier comparison)
    const debugCandidates = debug
      ? [...weightedReports]
          .sort((a, b) => a._distance - b._distance)
          .slice(0, rodParams.top_n)
          .map((r) => ({
            date: r.date,
            rod_average: r.rod_average,
            distance: Math.round(r._distance * 10000) / 10000,
            weight: Math.round(r.weight * 1000) / 1000,
            recency: Math.round(r._recency * 1000) / 1000,
            precip_mm_week: r.precip_total_mm_week,
            precip_cat: precipCatWeekly(r.precip_total_mm_week),
            precip_cat_name: PRECIP_CAT_NAMES[precipCatWeekly(r.precip_total_mm_week)],
            temp: r.t_mean_week,
            wind: r.wind_speed_mean_week,
          }))
      : null;

    const rodAvg = predictRodAverage(topReports);
    const rankedMethods = rankItems(topReports, "methods", methodsParams.top_n);
    const rankedFlies = rankItems(topReports, "flies", fliesParams.top_n);
    const rankedSpots = rankItems(topReports, "best_spots", spotsParams.top_n);

    // ── Process 3: Tactical (session periods) ──────────────────
    let tacticalOutput = {
      techniques: [] as any[],
      flies: [] as any[],
      spots: [] as any[],
      catch_by_hour: {} as Record<string, number>,
      session_count: 0,
      period_count: 0,
    };

    if (venueId) {
      const [summariesRes, anglerStatsRes] = await Promise.all([
        supabase
          .from("session_summaries")
          .select("user_id, session_date, total_fish, weather_periods")
          .eq("venue_id", venueId),
        supabase
          .from("angler_venue_stats")
          .select("user_id, general_ability")
          .eq("venue_id", venueId),
      ]);

      const summaries = summariesRes.data ?? [];
      const abilityMap = new Map(
        (anglerStatsRes.data ?? []).map((a: any) => [a.user_id, a.general_ability ?? 1.0])
      );

      const seasonalSummaries = summaries.filter((s: any) =>
        isWithinWeekWindow(s.session_date, targetWeek, weekWindow)
      );

      const weightedPeriods: WeightedPeriod[] = [];

      for (const summary of seasonalSummaries) {
        const periods = summary.weather_periods || [];
        const ability = abilityMap.get(summary.user_id) ?? 1.0;
        const recency = recencyWeight(summary.session_date, target_date, 0.8);

        for (const period of periods) {
          const distance = weatherDistancePeriod(forecast, period.weather);
          const weight = (1 / (0.05 + distance)) * recency * ability;
          weightedPeriods.push({
            weather: period.weather,
            techniques: period.techniques || [],
            spots: period.spots || [],
            flies: period.flies || [],
            catches: period.catches || 0,
            catch_by_hour: period.catch_by_hour || {},
            weight,
          });
        }
      }

      weightedPeriods.sort((a, b) => b.weight - a.weight);
      const topPeriods = weightedPeriods.slice(0, 50);

      const techScores = new Map<string, { catches: number; minutes: number; weight: number }>();
      const flyScores = new Map<string, { catches: number; weight: number }>();
      const spotScores = new Map<string, { catches: number; weight: number }>();
      const hourScores = new Map<string, number>();

      for (const p of topPeriods) {
        for (const t of p.techniques) {
          const e = techScores.get(t.style) ?? { catches: 0, minutes: 0, weight: 0 };
          e.catches += (t.catches || 0) * p.weight;
          e.minutes += (t.minutes || 0) * p.weight;
          e.weight += p.weight;
          techScores.set(t.style, e);
        }
        for (const f of p.flies) {
          const e = flyScores.get(f.fly) ?? { catches: 0, weight: 0 };
          e.catches += (f.catches || 0) * p.weight;
          e.weight += p.weight;
          flyScores.set(f.fly, e);
        }
        for (const s of p.spots) {
          const e = spotScores.get(s.spot) ?? { catches: 0, weight: 0 };
          e.catches += (s.catches || 0) * p.weight;
          e.weight += p.weight;
          spotScores.set(s.spot, e);
        }
        for (const [hour, count] of Object.entries(p.catch_by_hour)) {
          hourScores.set(hour, (hourScores.get(hour) ?? 0) + (count as number) * p.weight);
        }
      }

      tacticalOutput = {
        techniques: Array.from(techScores.entries())
          .map(([style, d]) => ({
            technique: style,
            weighted_catches: Math.round(d.catches * 10) / 10,
            weighted_minutes: Math.round(d.minutes),
            score: Math.round(d.weight * 100) / 100,
          }))
          .sort((a, b) => b.weighted_catches - a.weighted_catches)
          .slice(0, 8),
        flies: Array.from(flyScores.entries())
          .map(([fly, d]) => ({
            fly,
            weighted_catches: Math.round(d.catches * 10) / 10,
            score: Math.round(d.weight * 100) / 100,
          }))
          .sort((a, b) => b.weighted_catches - a.weighted_catches)
          .slice(0, 10),
        spots: Array.from(spotScores.entries())
          .map(([spot, d]) => ({
            spot,
            weighted_catches: Math.round(d.catches * 10) / 10,
            score: Math.round(d.weight * 100) / 100,
          }))
          .sort((a, b) => b.weighted_catches - a.weighted_catches)
          .slice(0, 6),
        catch_by_hour: Object.fromEntries(
          Array.from(hourScores.entries())
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([h, v]) => [h, Math.round(v * 10) / 10])
        ),
        session_count: seasonalSummaries.length,
        period_count: topPeriods.length,
      };
    }

    // ── Process 4: Personal ────────────────────────────────────
    let personalOutput: any = { has_personal: false, message: null };

    if (user_id && venueId) {
      const { data: myStats } = await supabase
        .from("angler_venue_stats")
        .select("*")
        .eq("user_id", user_id)
        .eq("venue_id", venueId)
        .single();

      if (myStats && myStats.total_sessions >= 3) {
        personalOutput = {
          has_personal: true,
          general_ability: myStats.general_ability,
          total_sessions: myStats.total_sessions,
          total_fish: myStats.total_fish,
          catch_rate: myStats.catch_rate,
          fish_per_hour: myStats.fish_per_hour,
          technique_stats: myStats.technique_stats,
        };
      } else {
        personalOutput = {
          has_personal: false,
          total_sessions: myStats?.total_sessions ?? 0,
          message:
            "Log more sessions to unlock personalised advice (need 3+, have " +
            (myStats?.total_sessions ?? 0) + ")",
        };
      }
    }

    // ── Step 4: Build AI prompt ────────────────────────────────
    const dayOfWeek = new Date(target_date + "T00:00:00").toLocaleDateString(
      "en-GB", { weekday: "long" }
    );

    const reportMethodsList = rankedMethods.length > 0
      ? rankedMethods.map((m, i) => `${i + 1}. ${m.name} (score: ${m.score})`).join("\n")
      : "No data";
    const reportFliesList = rankedFlies.length > 0
      ? rankedFlies.map((f, i) => `${i + 1}. ${f.name} (score: ${f.score})`).join("\n")
      : "No data";
    const reportSpotsList = rankedSpots.length > 0
      ? rankedSpots.map((s, i) => `${i + 1}. ${s.name} (score: ${s.score})`).join("\n")
      : "No data";

    const tacticalTechList = tacticalOutput.techniques.length > 0
      ? tacticalOutput.techniques.map((t: any, i: number) =>
          `${i + 1}. ${t.technique} (catches: ${t.weighted_catches}, time: ${t.weighted_minutes}min)`
        ).join("\n")
      : "No diary data yet";
    const tacticalFlyList = tacticalOutput.flies.length > 0
      ? tacticalOutput.flies.map((f: any, i: number) =>
          `${i + 1}. ${f.fly} (catches: ${f.weighted_catches})`
        ).join("\n")
      : "No diary data yet";
    const tacticalSpotList = tacticalOutput.spots.length > 0
      ? tacticalOutput.spots.map((s: any, i: number) =>
          `${i + 1}. ${s.spot} (catches: ${s.weighted_catches})`
        ).join("\n")
      : "No diary data yet";

    const catchHourText = Object.keys(tacticalOutput.catch_by_hour).length > 0
      ? Object.entries(tacticalOutput.catch_by_hour)
          .map(([h, v]) => `${h}:00 = ${v}`)
          .join(", ")
      : "No data";

    let personalSection = "";
    if (personalOutput.has_personal) {
      const ability = personalOutput.general_ability ?? 1.0;
      const abilityDesc =
        ability > 1.2 ? "above average" :
        ability < 0.8 ? "below average" : "average";

      let techNotes = "";
      if (personalOutput.technique_stats && typeof personalOutput.technique_stats === "object") {
        const entries = Object.entries(personalOutput.technique_stats as Record<string, any>);
        techNotes = entries
          .slice(0, 5)
          .map(([style, stats]: [string, any]) =>
            `- ${style}: effectiveness ${stats.effectiveness?.toFixed(2) ?? "?"}, ` +
            `${stats.catches ?? 0} fish in ${stats.sessions ?? 0} sessions`
          )
          .join("\n");
      }

      personalSection = `Your performance at ${venue_name}:
- ${personalOutput.total_sessions} sessions, ${personalOutput.total_fish} fish total
- Catch rate: ${personalOutput.catch_rate} fish/session (${abilityDesc} for this venue)
- Fish per hour: ${personalOutput.fish_per_hour?.toFixed(2) ?? "?"}
${techNotes ? "Your technique effectiveness:\n" + techNotes : ""}

Provide personalised recommendations based on this angler's strengths and areas for improvement.`;
    } else {
      personalSection = personalOutput.message ||
        "No personal data — encourage logging sessions for personalised advice.";
    }

    const venueCharacter = venueProfile?.character_notes
      ? `\nVenue character: ${venueProfile.character_notes}`
      : "";

    const aiPrompt = `You are an expert UK stillwater fly fishing advisor. Generate practical advice for fishing at ${venue_name} on ${dayOfWeek} ${target_date} (${season}).

## Weather Forecast${forecast.is_historical ? " (historical average — no live forecast available)" : ""}
Temperature: ${forecast.temp}°C
Wind: ${forecast.wind_speed_mph}mph ${forecast.wind_dir}
Conditions: ${forecast.conditions}
Pressure: ${forecast.pressure}hPa
Humidity: ${forecast.humidity}%

## Fishery Report Intelligence
Based on ${topReports.length} weather-matched reports from ${reports.length} total for ${venue_name}:

Predicted rod average: ${rodAvg.predicted} fish (range ${rodAvg.range[0]}-${rodAvg.range[1]}, ${rodAvg.confidence} confidence)

Ranked methods:
${reportMethodsList}

Ranked flies:
${reportFliesList}

Best spots:
${reportSpotsList}
${venueCharacter}

## Diary Network Intelligence
Based on ${tacticalOutput.session_count} diary sessions (${tacticalOutput.period_count} weather-matched periods):

Effective techniques in similar conditions:
${tacticalTechList}

Productive flies:
${tacticalFlyList}

Best spots:
${tacticalSpotList}

Peak catch hours: ${catchHourText}

## Personal Performance
${personalSection}

## Instructions
Write advice in these sections:

**What to Expect** (1-2 paragraphs)
Combine weather with historical patterns. Predict fish behaviour and likely rod average. Be specific.

**What's Been Working** (2-3 paragraphs)
Tactical advice from diary data. Specific fly sizes, line choices, retrieve styles, spots. Explain WHY techniques work in these conditions. Reference catch-by-hour data for timing.

**For You** (1 paragraph)
${personalOutput.has_personal ? "Personalised adjustments based on their stats. What to lean into, what to try differently." : "Brief encouragement to log sessions for personalised advice in future."}

Use UK fly fishing terminology (buzzer, blob, washing line, figure-of-eight, etc.). Be conversational but authoritative. Reference specific data points.`;

    // ── Step 5: Call AI ────────────────────────────────────────
    let adviceText = "";

    if (skip_ai) {
      // Skip AI for testing — return structured fallback only
      adviceText = `## What to Expect\nBased on ${topReports.length} reports for ${venue_name} in ${season}, the predicted rod average is ${rodAvg.predicted} fish (${rodAvg.confidence} confidence).\n\n`;
      adviceText += `Top methods: ${rankedMethods.slice(0, 3).map((m) => m.name).join(", ") || "none recorded"}.\n`;
      adviceText += `Top flies: ${rankedFlies.slice(0, 3).map((f) => f.name).join(", ") || "none recorded"}.\n\n`;
      adviceText += `[AI generation skipped — test mode]`;
    } else {
      try {
        const lovableKey = Deno.env.get("LOVABLE_API_KEY");
        if (lovableKey) {
          const aiResponse = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${lovableKey}`,
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{ role: "user", content: aiPrompt }],
                max_tokens: 2000,
              }),
            }
          );

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            adviceText = aiData.choices?.[0]?.message?.content ?? "";
          } else {
            const errBody = await aiResponse.text();
            console.error("AI gateway error:", aiResponse.status, errBody);
          }
        }
      } catch (aiErr) {
        console.error("AI call failed:", aiErr);
      }

      // Fallback if AI fails
      if (!adviceText) {
        adviceText = `## What to Expect\nBased on ${topReports.length} reports for ${venue_name} in ${season}, the predicted rod average is ${rodAvg.predicted} fish (${rodAvg.confidence} confidence). `;
        adviceText += `Top methods: ${rankedMethods.slice(0, 3).map((m) => m.name).join(", ") || "none recorded"}. `;
        adviceText += `Top flies: ${rankedFlies.slice(0, 3).map((f) => f.name).join(", ") || "none recorded"}.\n\n`;
        if (tacticalOutput.session_count > 0) {
          adviceText += `## What's Been Working\nDiary data from ${tacticalOutput.session_count} sessions shows: `;
          adviceText += tacticalOutput.techniques.slice(0, 3).map((t: any) => t.technique).join(", ") || "various techniques";
          adviceText += ".\n\n";
        }
        if (personalOutput.has_personal) {
          adviceText += `## For You\nYour catch rate at ${venue_name} is ${personalOutput.catch_rate} fish/session across ${personalOutput.total_sessions} sessions.\n`;
        } else {
          adviceText += `## For You\n${personalOutput.message || "Log sessions to unlock personalised advice."}\n`;
        }
      }
    }

    // ── Step 6: Save query record ──────────────────────────────
    let queryId = null;
    if (user_id) {
      try {
        const { data: qData } = await supabase
          .from("queries")
          .insert({
            user_id,
            venue: venue_name,
            query_date: target_date,
            advice_text: adviceText,
            weather_data: {
              temp: forecast.temp,
              windSpeed: forecast.wind_speed_mph,
              windDirection: forecast.wind_dir,
              conditions: forecast.conditions,
              pressure: forecast.pressure,
              humidity: forecast.humidity,
            },
          })
          .select("id")
          .single();
        queryId = qData?.id;
      } catch (qErr) {
        console.error("Failed to save query:", qErr);
      }
    }

    // ── Step 7: Return response ────────────────────────────────
    const response = {
      advice: adviceText,
      prediction: {
        rod_average: rodAvg,
        methods: rankedMethods.map((m) => ({
          method: m.name, frequency: m.frequency, score: m.score,
        })),
        flies: rankedFlies.map((f) => ({
          fly: f.name, frequency: f.frequency, score: f.score,
        })),
        spots: rankedSpots.map((s) => ({
          spot: s.name, frequency: s.frequency, score: s.score,
        })),
      },
      tactical: tacticalOutput,
      personal: personalOutput,
      tier: "full" as const,
      season,
      reportCount: reports.length,
      matchedReportCount: topReports.length,
      sessionCount: tacticalOutput.session_count,
      queryId,
      weather: {
        temp: forecast.temp,
        wind_speed: forecast.wind_speed_mph,
        wind_dir: forecast.wind_dir,
        conditions: forecast.conditions,
        pressure: forecast.pressure,
        humidity: forecast.humidity,
        is_historical: forecast.is_historical,
      },
      confidence: {
        report_data:
          topReports.length >= 20 ? "high" :
          topReports.length >= 8 ? "medium" : "low",
        tactical_data:
          tacticalOutput.period_count >= 20 ? "high" :
          tacticalOutput.period_count >= 5 ? "medium" :
          tacticalOutput.period_count > 0 ? "low" : "none",
        personal_data: personalOutput.has_personal ? "available" : "insufficient",
      },
      model_info: {
        params_source: rodParams.source,
        data_quality: venueProfile?.data_quality_flag ?? "unknown",
        character_notes: venueProfile?.character_notes ?? null,
      },
      // Debug data (only included when debug=true)
      ...(debug ? {
        debug: {
          forecast_used: {
            temp: forecast.temp,
            wind_speed_ms: forecast.wind_speed_ms,
            wind_speed_mph: forecast.wind_speed_mph,
            wind_dir: forecast.wind_dir,
            precip_mm_hr: forecast.precip_mm_hr,
            precip_cat: precipCatHourly(forecast.precip_mm_hr),
            precip_cat_name: PRECIP_CAT_NAMES[precipCatHourly(forecast.precip_mm_hr)],
            pressure: forecast.pressure,
            humidity: forecast.humidity,
            is_historical: forecast.is_historical,
            source: forecast_override ? "override" : (forecast.is_historical ? "historical" : (daysOut <= 5 ? "owm_forecast" : "owm_current")),
          },
          params_used: {
            rod_average: { ...rodParams },
            flies: { ...fliesParams },
            methods: { ...methodsParams },
            spots: { ...spotsParams },
          },
          candidate_reports: debugCandidates,
          total_candidates_in_window: seasonalReports.length,
          total_reports_for_venue: reports.length,
          target_week: targetWeek,
          week_window: weekWindow,
        },
      } : {}),
    };

    console.log(
      `Advice generated for ${venue_name} on ${target_date}: ` +
      `${topReports.length} reports, ${tacticalOutput.session_count} sessions, ` +
      `${tacticalOutput.period_count} periods, personal=${personalOutput.has_personal}`
    );

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-ai-advice-v2 error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
