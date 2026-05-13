import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireEnv, envErrorResponse } from "../_shared/env.ts";
import { requireUser } from "../_shared/user_auth.ts";

/* ── helpers ── */
function classifyTemp(t: number) {
  if (t <= 4) return 'cold'
  if (t <= 10) return 'cool'
  if (t <= 16) return 'mild'
  if (t <= 22) return 'warm'
  return 'hot'
}
function classifyWind(mph: number) {
  if (mph <= 5) return 'calm'
  if (mph <= 15) return 'moderate'
  if (mph <= 25) return 'breezy'
  return 'strong'
}
function classifyPressure(hPa: number) {
  if (hPa < 1005) return 'low'
  if (hPa <= 1020) return 'medium'
  return 'high'
}
function classifyPrecip(mm: number) {
  if (mm === 0) return 'dry'
  if (mm <= 2) return 'light rain'
  if (mm <= 8) return 'moderate rain'
  return 'heavy rain'
}

function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/* ── Open-Meteo weather fetch ── */
async function fetchWeather(lat: number, lon: number, date: string) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,surface_pressure_mean,sunrise,sunset&timezone=Europe/London&start_date=${date}&end_date=${date}`
  const res = await fetch(url)
  if (!res.ok) return null
  const j = await res.json()
  const d = j.daily
  if (!d || !d.temperature_2m_max?.length) return null

  const avgTemp = (d.temperature_2m_max[0] + d.temperature_2m_min[0]) / 2
  const windMph = d.wind_speed_10m_max[0] * 0.621371
  const pressHpa = d.surface_pressure_mean[0]
  const precipMm = d.precipitation_sum[0]

  return {
    date,
    temp_max_c: d.temperature_2m_max[0],
    temp_min_c: d.temperature_2m_min[0],
    temp_avg_c: Math.round(avgTemp * 10) / 10,
    wind_max_mph: Math.round(windMph * 10) / 10,
    pressure_hpa: Math.round(pressHpa),
    precip_mm: precipMm,
    sunrise: d.sunrise?.[0] ?? null,
    sunset: d.sunset?.[0] ?? null,
    bands: {
      temp: classifyTemp(avgTemp),
      wind: classifyWind(windMph),
      pressure: classifyPressure(pressHpa),
      precip: classifyPrecip(precipMm),
    },
  }
}

/* ── Main handler ── */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' }

  try {
    // Per prompt 190: require authenticated user
    const auth = await requireUser(req, corsHeaders);
    if (auth.error) return auth.error;

    const sb = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const body = await req.json()
    const venueId = body.venue_id as string | undefined
    const venueName = body.venue_name as string | undefined
    const date = (body.date as string) || tomorrow()
    const includeProse = body.include_prose !== false
    const premium = body.premium === true

    if (!venueId && !venueName) {
      return new Response(JSON.stringify({ error: 'venue_id or venue_name required' }), { status: 400, headers })
    }

    /* ── cache check ── */
    const cacheKey = `venue-advice-${venueId || venueName}-${date}-${premium}`
    const { data: cached } = await sb
      .from('query_cache')
      .select('response_data')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (cached?.response_data) {
      return new Response(JSON.stringify(cached.response_data), { headers })
    }

    /* ── resolve venue ── */
    let venueQuery = sb.from('venues_new').select('*')
    if (venueId) venueQuery = venueQuery.eq('venue_id', venueId)
    else venueQuery = venueQuery.ilike('name', venueName!)
    const { data: venue } = await venueQuery.limit(1).maybeSingle()

    if (!venue) {
      return new Response(JSON.stringify({ error: 'Venue not found' }), { status: 404, headers })
    }

    const waterTypeId = venue.water_type_id
    const month = new Date(date).getMonth() + 1

    /* ── parallel data fetch ── */
    const [weatherResult, confidenceResult, weatherEffectsResult, flyCondResult, seasonalFliesResult, hatchResult, condAdviceResult, wtFliesResult] = await Promise.all([
      // weather
      (venue.latitude && venue.longitude) ? fetchWeather(venue.latitude, venue.longitude, date) : Promise.resolve(null),
      // confidence
      sb.from('report_advice_confidence').select('*').eq('venue_name', venue.name).maybeSingle(),
      // weather effects
      sb.from('pattern_weather_effects').select('*').eq('water_type_id', waterTypeId).order('confidence', { ascending: false }).limit(20),
      // fly conditions
      sb.from('pattern_fly_conditions').select('*').eq('water_type_id', waterTypeId).order('confidence', { ascending: false }).limit(30),
      // seasonal fly rankings (venue-specific)
      sb.from('report_seasonal_fly_rankings').select('*').eq('venue_name', venue.name).eq('month', month).order('rank', { ascending: true }).limit(10),
      // hatches
      sb.from('pattern_hatch_weather').select('*').eq('water_type_id', waterTypeId).eq('month', month).order('confidence', { ascending: false }).limit(5),
      // condition advice
      sb.from('wt_condition_advice').select('*').eq('water_type_id', waterTypeId).limit(20),
      // water-type monthly flies
      sb.from('wt_monthly_fly_advice').select('*').eq('water_type_id', waterTypeId).eq('month', month).order('rank', { ascending: true }).limit(10),
    ])

    const weather = weatherResult
    const confidence = confidenceResult.data
    const weatherEffects = weatherEffectsResult.data ?? []
    const flyConditions = flyCondResult.data ?? []
    const seasonalFlies = seasonalFliesResult.data ?? []
    const hatches = hatchResult.data ?? []
    const condAdvice = condAdviceResult.data ?? []
    const wtFlies = wtFliesResult.data ?? []

    /* ── determine confidence tier ── */
    let confidenceTier: string
    if (seasonalFlies.length >= 3 && confidence) {
      confidenceTier = 'venue-specific'
    } else if (wtFlies.length >= 3) {
      confidenceTier = 'venue-blended'
    } else {
      confidenceTier = 'generic'
    }

    /* ── build fly recommendations (tiered priority) ── */
    interface FlyRec {
      fly_name: string
      rank: number
      source: string
      confidence?: number | null
      style?: string | null
    }
    const flyRecs: FlyRec[] = []
    const seen = new Set<string>()

    // Tier 1: venue-specific seasonal
    for (const f of seasonalFlies) {
      const k = f.fly_name.toLowerCase()
      if (!seen.has(k)) {
        seen.add(k)
        flyRecs.push({ fly_name: f.fly_name, rank: flyRecs.length + 1, source: 'venue-seasonal' })
      }
    }

    // Tier 2: condition-matched flies (if we have weather)
    if (weather) {
      const matchedCondFlies = flyConditions.filter((f) => {
        const cv = f.condition_value?.toLowerCase()
        return (
          cv === weather.bands.temp ||
          cv === weather.bands.wind ||
          cv === weather.bands.pressure ||
          cv === weather.bands.precip
        )
      })
      for (const f of matchedCondFlies) {
        const k = f.fly_name.toLowerCase()
        if (!seen.has(k)) {
          seen.add(k)
          flyRecs.push({ fly_name: f.fly_name, rank: flyRecs.length + 1, source: 'condition-matched', confidence: f.confidence })
        }
      }
    }

    // Tier 3: water-type monthly
    for (const f of wtFlies) {
      const k = f.fly_name.toLowerCase()
      if (!seen.has(k)) {
        seen.add(k)
        flyRecs.push({ fly_name: f.fly_name, rank: flyRecs.length + 1, source: 'water-type-monthly', style: f.fly_style, confidence: f.confidence })
      }
    }

    /* ── filter relevant weather effects ── */
    let relevantEffects = weatherEffects
    if (weather) {
      relevantEffects = weatherEffects.filter((e) => {
        const cv = e.condition_value?.toLowerCase()
        return (
          cv === weather.bands.temp ||
          cv === weather.bands.wind ||
          cv === weather.bands.pressure ||
          cv === weather.bands.precip
        )
      })
    }

    /* ── condition advice matching ── */
    let relevantCondAdvice = condAdvice
    if (weather) {
      relevantCondAdvice = condAdvice.filter((a) => {
        const cv = a.condition_value?.toLowerCase()
        return (
          cv === weather.bands.temp ||
          cv === weather.bands.wind ||
          cv === weather.bands.pressure ||
          cv === weather.bands.precip
        )
      })
    }

    /* ── assemble structured response ── */
    const structured = {
      venue: {
        venue_id: venue.venue_id,
        name: venue.name,
        full_name: venue.full_name,
        water_type_id: waterTypeId,
        river_name: venue.river_name,
        latitude: venue.latitude,
        longitude: venue.longitude,
      },
      date,
      weather,
      confidence_tier: confidenceTier,
      confidence_score: confidence?.confidence_score ?? null,
      fly_recommendations: flyRecs.slice(0, 12),
      weather_effects: relevantEffects.slice(0, 6).map((e) => ({
        variable: e.variable,
        condition: e.condition_value,
        effect_size: e.effect_size,
        mean_catch: e.mean_catch,
        baseline_catch: e.baseline_catch,
        confidence: e.confidence,
        n_sessions: e.n_sessions,
      })),
      condition_advice: relevantCondAdvice.slice(0, 4).map((a) => ({
        condition_type: a.condition_type,
        condition_value: a.condition_value,
        fly_adjustments: a.fly_adjustments,
        method_adjustments: a.method_adjustments,
        catch_modifier: a.catch_modifier,
      })),
      hatches: hatches.map((h) => ({
        species: h.species_name,
        intensity: h.hatch_intensity,
        confidence: h.confidence,
        recommended_flies: h.recommended_flies,
      })),
      sunrise: weather?.sunrise ?? null,
      sunset: weather?.sunset ?? null,
      prose: null as string | null,
    }

    /* ── optional prose generation via Lovable AI ── */
    if (includeProse) {
      try {
        const apiKey = Deno.env.get('LOVABLE_API_KEY')
        if (apiKey) {
          const prompt = buildProsePrompt(structured)
          const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite',
              messages: [
                { role: 'system', content: 'You are a concise UK fly fishing advisor. Write 2-3 short paragraphs of practical advice based on the data provided. Be specific about flies, methods, and timing. No disclaimers.' },
                { role: 'user', content: prompt },
              ],
              max_tokens: 500,
              temperature: 0.4,
            }),
          })
          if (aiRes.ok) {
            const aiJson = await aiRes.json()
            structured.prose = aiJson.choices?.[0]?.message?.content ?? null
          }
        }
      } catch (e) {
        console.error('Prose generation failed (non-fatal):', e)
      }
    }

    /* ── cache the response ── */
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
    await sb.from('query_cache').upsert({
      cache_key: cacheKey,
      response_data: structured,
      expires_at: expiresAt,
    }, { onConflict: 'cache_key' })

    return new Response(JSON.stringify(structured), { headers })

  } catch (err) {
    const envResp = envErrorResponse(err, corsHeaders);
    if (envResp) return envResp;
    console.error('get-venue-advice error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
})

/* ── prose prompt builder ── */
function buildProsePrompt(data: Record<string, unknown>): string {
  const v = data.venue as Record<string, unknown>
  const w = data.weather as Record<string, unknown> | null
  const flies = (data.fly_recommendations as Array<{ fly_name: string; source: string }>).map((f) => f.fly_name).join(', ')
  const hatches = (data.hatches as Array<{ species: string; intensity: string }>).map((h) => `${h.species} (${h.intensity})`).join(', ')

  let prompt = `Venue: ${v.name} (${v.river_name || 'stillwater'})\nDate: ${data.date}\n`
  if (w) {
    const bands = w.bands as Record<string, string>
    prompt += `Weather: ${w.temp_avg_c}°C (${bands.temp}), wind ${w.wind_max_mph}mph (${bands.wind}), pressure ${w.pressure_hpa}hPa (${bands.pressure}), ${bands.precip}\n`
    prompt += `Sunrise: ${w.sunrise}, Sunset: ${w.sunset}\n`
  }
  prompt += `Confidence tier: ${data.confidence_tier}\n`
  prompt += `Top flies: ${flies}\n`
  if (hatches) prompt += `Active hatches: ${hatches}\n`

  const effects = data.weather_effects as Array<{ variable: string; condition: string; effect_size: number }>
  if (effects?.length) {
    prompt += `Weather effects on catch: ${effects.map((e) => `${e.variable}=${e.condition} → ${e.effect_size > 0 ? '+' : ''}${(e.effect_size * 100).toFixed(0)}%`).join(', ')}\n`
  }

  const advice = data.condition_advice as Array<{ condition_type: string; fly_adjustments: string; method_adjustments: string }>
  if (advice?.length) {
    prompt += `Condition advice: ${advice.map((a) => `${a.condition_type}: flies→${a.fly_adjustments}, methods→${a.method_adjustments}`).join('; ')}\n`
  }

  return prompt
}
