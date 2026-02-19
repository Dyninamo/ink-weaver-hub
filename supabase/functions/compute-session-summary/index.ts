import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ===== TYPES =====

interface WeatherSnapshot {
  time: string
  temp: number
  wind_speed: number
  wind_dir: string
  precip: number
  pressure: number
  humidity: number
}

interface Setup {
  style: string | null
  rig: string | null
  line_type: string | null
  retrieve: string | null
  spot: string | null
  fly_pattern: string | null
  fly_size: number | null
}

interface PeriodBoundary {
  startMins: number
  endMins: number
  snapshots: WeatherSnapshot[]
  weatherConfidence: string
}

// ===== HELPER FUNCTIONS =====

function parseHHMM(time: string): number {
  const parts = time.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0')
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = Math.round(mins % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function isoToMinutesUTC(iso: string): number {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function getQuadrant(dir: string | null): string {
  if (!dir) return 'N'
  const map: Record<string, string> = {
    'N': 'N', 'NNE': 'N', 'NE': 'N',
    'ENE': 'E', 'E': 'E', 'ESE': 'E', 'SE': 'E',
    'SSE': 'S', 'S': 'S', 'SSW': 'S', 'SW': 'S',
    'WSW': 'W', 'W': 'W', 'WNW': 'W', 'NW': 'W',
    'NNW': 'N'
  }
  return map[dir.toUpperCase()] || 'N'
}

function getPrecipCategory(precip: number): string {
  if (!precip || precip === 0) return 'dry'
  if (precip < 2) return 'light'
  if (precip <= 8) return 'moderate'
  return 'heavy'
}

function computeTimezoneOffset(startTime: string | null, weatherLog: WeatherSnapshot[]): number {
  if (!startTime || weatherLog.length === 0) return 0
  const startUTC = isoToMinutesUTC(startTime)
  const firstWeather = parseHHMM(weatherLog[0].time)
  const diff = firstWeather - startUTC
  return Math.round(diff / 30) * 30
}

function eventToWeatherMinutes(eventTime: string, offset: number): number {
  return isoToMinutesUTC(eventTime) + offset
}

function extractSetup(event: any): Setup {
  return {
    style: event.style || null,
    rig: event.rig || null,
    line_type: event.line_type || null,
    retrieve: event.retrieve || null,
    spot: event.spot || null,
    fly_pattern: event.fly_pattern || null,
    fly_size: event.fly_size ?? null,
  }
}

function extractSetupFromChangeFrom(changeFrom: any): Setup {
  if (!changeFrom) return { style: null, rig: null, line_type: null, retrieve: null, spot: null, fly_pattern: null, fly_size: null }
  return {
    style: changeFrom.style || null,
    rig: changeFrom.rig || null,
    line_type: changeFrom.line_type || null,
    retrieve: changeFrom.retrieve || null,
    spot: changeFrom.spot || null,
    fly_pattern: changeFrom.fly_pattern || null,
    fly_size: changeFrom.fly_size ?? null,
  }
}

function techniqueKey(s: Setup): string {
  return `${s.style || 'Unknown'}|${s.rig || ''}|${s.line_type || ''}|${s.retrieve || ''}`
}

function flyKey(s: Setup): string {
  return `${s.fly_pattern || 'Unknown'}|${s.fly_size ?? ''}`
}

function averageWeather(snapshots: WeatherSnapshot[]): any {
  if (snapshots.length === 0) {
    return { temp: null, wind_speed: null, wind_dir: null, precip: null, pressure: null, humidity: null }
  }
  const avg = (arr: (number | undefined | null)[]) => {
    const valid = arr.filter((v): v is number => v !== null && v !== undefined)
    return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10 : null
  }
  return {
    temp: avg(snapshots.map(s => s.temp)),
    wind_speed: avg(snapshots.map(s => s.wind_speed)),
    wind_dir: snapshots[0].wind_dir,
    precip: avg(snapshots.map(s => s.precip)),
    pressure: avg(snapshots.map(s => s.pressure)),
    humidity: avg(snapshots.map(s => s.humidity)),
  }
}

function fallbackWeatherFromEvents(events: any[]): any {
  const withWeather = events.filter((e: any) => e.event_temp !== null && e.event_temp !== undefined)
  if (withWeather.length === 0) {
    return { temp: null, wind_speed: null, wind_dir: null, precip: null, pressure: null, humidity: null }
  }
  const avg = (arr: (number | null)[]) => {
    const valid = arr.filter((v): v is number => v !== null && v !== undefined)
    return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10 : null
  }
  return {
    temp: avg(withWeather.map((e: any) => e.event_temp)),
    wind_speed: avg(withWeather.map((e: any) => e.event_wind_speed)),
    wind_dir: withWeather[0]?.event_wind_dir || null,
    precip: null,
    pressure: avg(withWeather.map((e: any) => e.event_pressure)),
    humidity: null,
  }
}

// ===== WEATHER PERIOD SEGMENTATION =====
// Drift is measured from period START, not between consecutive snapshots.
// Thresholds: temp +/-3C, wind +/-5mph, wind quadrant change, precip category change.

function segmentWeatherPeriods(
  weatherLog: WeatherSnapshot[],
  sessionStartTime: string | null,
  sessionEndTime: string | null,
  durationMinutes: number | null
): { periods: PeriodBoundary[], offset: number } {

  if (!weatherLog || weatherLog.length === 0) {
    const startMins = sessionStartTime ? isoToMinutesUTC(sessionStartTime) : 480
    const dur = durationMinutes || 480
    const endMins = sessionEndTime ? isoToMinutesUTC(sessionEndTime) : (startMins + dur)
    return {
      periods: [{ startMins, endMins: Math.max(endMins, startMins + 1), snapshots: [], weatherConfidence: 'no_weather_log' }],
      offset: 0
    }
  }

  const offset = computeTimezoneOffset(sessionStartTime, weatherLog)
  const periods: PeriodBoundary[] = []
  let periodStart = parseHHMM(weatherLog[0].time)
  let periodStartWeather = weatherLog[0]
  let currentSnapshots: WeatherSnapshot[] = [weatherLog[0]]

  for (let i = 1; i < weatherLog.length; i++) {
    const snap = weatherLog[i]
    const breached =
      Math.abs(snap.temp - periodStartWeather.temp) > 3 ||
      Math.abs(snap.wind_speed - periodStartWeather.wind_speed) > 5 ||
      getQuadrant(snap.wind_dir) !== getQuadrant(periodStartWeather.wind_dir) ||
      getPrecipCategory(snap.precip) !== getPrecipCategory(periodStartWeather.precip)

    if (breached) {
      periods.push({
        startMins: periodStart,
        endMins: parseHHMM(snap.time),
        snapshots: currentSnapshots,
        weatherConfidence: 'measured'
      })
      periodStart = parseHHMM(snap.time)
      periodStartWeather = snap
      currentSnapshots = [snap]
    } else {
      currentSnapshots.push(snap)
    }
  }

  // Close final period at session end
  let endMins: number
  if (sessionEndTime) {
    endMins = isoToMinutesUTC(sessionEndTime) + offset
  } else if (durationMinutes && sessionStartTime) {
    endMins = isoToMinutesUTC(sessionStartTime) + offset + durationMinutes
  } else {
    endMins = parseHHMM(weatherLog[weatherLog.length - 1].time) + 15
  }
  endMins = Math.max(endMins, periodStart + 1)

  periods.push({
    startMins: periodStart,
    endMins,
    snapshots: currentSnapshots,
    weatherConfidence: 'measured'
  })

  return { periods, offset }
}

// ===== EVENT ALLOCATION =====
// For each weather period, allocate events by timestamp.
// Track current setup; on each event allocate elapsed time to previous setup,
// credit catches, update setup on change events.
// Setup carries across period boundaries.

function allocateEventsToPeriods(
  periodBoundaries: PeriodBoundary[],
  events: any[],
  offset: number
): { weatherPeriods: any[], totalFish: number, setupChanges: any[] } {

  let carryOverSetup: Setup | null = null
  const allSetupChanges: any[] = []
  let totalFish = 0

  // Determine initial setup from first event
  if (events.length > 0) {
    const first = events[0]
    if (first.event_type === 'change' && first.change_from) {
      carryOverSetup = extractSetupFromChangeFrom(first.change_from)
    } else {
      carryOverSetup = extractSetup(first)
    }
  }

  const weatherPeriods = periodBoundaries.map((period) => {
    const periodEvents = events.filter((e: any) => {
      const mins = eventToWeatherMinutes(e.event_time, offset)
      return mins >= period.startMins && mins < period.endMins
    })

    const techniques: Record<string, { technique: string, rig: string, line: string, retrieve: string, minutes: number, catches: number }> = {}
    const spots: Record<string, { spot: string, minutes: number, catches: number }> = {}
    const flies: Record<string, { fly: string, hook_size: number | null, minutes: number, catches: number }> = {}
    const catchByHour: Record<string, number> = {}
    let fishCount = 0

    let currentSetup: Setup | null = carryOverSetup
    if (!currentSetup && periodEvents.length > 0) {
      const first = periodEvents[0]
      if (first.event_type === 'change' && first.change_from) {
        currentSetup = extractSetupFromChangeFrom(first.change_from)
      } else {
        currentSetup = extractSetup(first)
      }
    }

    let lastMins = period.startMins

    for (const event of periodEvents) {
      const eventMins = eventToWeatherMinutes(event.event_time, offset)
      const elapsed = Math.max(0, eventMins - lastMins)

      // Allocate elapsed time to current setup
      if (currentSetup && elapsed > 0) {
        const tKey = techniqueKey(currentSetup)
        if (!techniques[tKey]) {
          techniques[tKey] = { technique: currentSetup.style || 'Unknown', rig: currentSetup.rig || '', line: currentSetup.line_type || '', retrieve: currentSetup.retrieve || '', minutes: 0, catches: 0 }
        }
        techniques[tKey].minutes += elapsed

        const sKey = currentSetup.spot || 'Unknown'
        if (!spots[sKey]) spots[sKey] = { spot: sKey, minutes: 0, catches: 0 }
        spots[sKey].minutes += elapsed

        const fKey = flyKey(currentSetup)
        if (!flies[fKey]) {
          flies[fKey] = { fly: currentSetup.fly_pattern || 'Unknown', hook_size: currentSetup.fly_size, minutes: 0, catches: 0 }
        }
        flies[fKey].minutes += elapsed
      }

      // Process catch
      if (event.event_type === 'catch') {
        fishCount++
        totalFish++
        if (currentSetup) {
          const tKey = techniqueKey(currentSetup)
          if (techniques[tKey]) techniques[tKey].catches++
          else {
            techniques[tKey] = { technique: currentSetup.style || 'Unknown', rig: currentSetup.rig || '', line: currentSetup.line_type || '', retrieve: currentSetup.retrieve || '', minutes: 0, catches: 1 }
          }

          const sKey = currentSetup.spot || 'Unknown'
          if (spots[sKey]) spots[sKey].catches++
          else spots[sKey] = { spot: sKey, minutes: 0, catches: 1 }

          const fKey = flyKey(currentSetup)
          if (flies[fKey]) flies[fKey].catches++
          else flies[fKey] = { fly: currentSetup.fly_pattern || 'Unknown', hook_size: currentSetup.fly_size, minutes: 0, catches: 1 }
        }
        const localHour = String(Math.floor(eventToWeatherMinutes(event.event_time, offset) / 60))
        catchByHour[localHour] = (catchByHour[localHour] || 0) + 1
      }

      // Process change — update setup to post-change state
      if (event.event_type === 'change') {
        const oldStyle = currentSetup?.style || 'Unknown'
        currentSetup = extractSetup(event)
        allSetupChanges.push({
          time: event.event_time,
          from_technique: oldStyle,
          to_technique: currentSetup.style || 'Unknown'
        })
      }

      lastMins = eventMins
    }

    // Allocate remaining time after last event to final setup
    const remaining = Math.max(0, period.endMins - lastMins)
    if (currentSetup && remaining > 0) {
      const tKey = techniqueKey(currentSetup)
      if (!techniques[tKey]) {
        techniques[tKey] = { technique: currentSetup.style || 'Unknown', rig: currentSetup.rig || '', line: currentSetup.line_type || '', retrieve: currentSetup.retrieve || '', minutes: 0, catches: 0 }
      }
      techniques[tKey].minutes += remaining

      const sKey = currentSetup.spot || 'Unknown'
      if (!spots[sKey]) spots[sKey] = { spot: sKey, minutes: 0, catches: 0 }
      spots[sKey].minutes += remaining

      const fKey = flyKey(currentSetup)
      if (!flies[fKey]) {
        flies[fKey] = { fly: currentSetup.fly_pattern || 'Unknown', hook_size: currentSetup.fly_size, minutes: 0, catches: 0 }
      }
      flies[fKey].minutes += remaining
    }

    carryOverSetup = currentSetup

    return {
      start: minutesToHHMM(period.startMins),
      end: minutesToHHMM(period.endMins),
      weather: averageWeather(period.snapshots),
      weather_confidence: period.weatherConfidence,
      duration_mins: Math.round(period.endMins - period.startMins),
      fish_count: fishCount,
      techniques: Object.values(techniques).map(t => ({ ...t, minutes: Math.round(t.minutes) })),
      spots: Object.values(spots).map(s => ({ ...s, minutes: Math.round(s.minutes) })),
      flies: Object.values(flies).map(f => ({ ...f, minutes: Math.round(f.minutes) })),
      catch_by_hour: catchByHour,
    }
  })

  return { weatherPeriods, totalFish, setupChanges: allSetupChanges }
}

// ===== INLINE ANGLER STATS COMPUTATION =====

async function computeAnglerStatsInline(supabase: any, userId: string, venueId: string) {
  const { data: summaries } = await supabase
    .from('session_summaries')
    .select('total_fish, session_hours, weather_periods, session_date')
    .eq('user_id', userId)
    .eq('venue_id', venueId)

  if (!summaries || summaries.length === 0) return

  const totalSessions = summaries.length
  const totalFish = summaries.reduce((sum: number, s: any) => sum + (s.total_fish || 0), 0)
  const totalHours = summaries.reduce((sum: number, s: any) => sum + (s.session_hours || 0), 0)
  const catchRate = Math.round((totalFish / totalSessions) * 100) / 100
  const fishPerHour = totalHours > 0 ? Math.round((totalFish / totalHours) * 100) / 100 : 0
  const lastSessionDate = summaries.reduce((latest: string, s: any) =>
    s.session_date > latest ? s.session_date : latest, summaries[0].session_date)

  // Aggregate technique stats at the style level
  const techAccum: Record<string, { minutes: number, catches: number, sessionDates: Set<string> }> = {}
  let totalMinutes = 0
  let totalCatches = 0

  for (const summary of summaries) {
    for (const period of (summary.weather_periods || [])) {
      for (const tech of (period.techniques || [])) {
        const key = tech.technique || 'Unknown'
        if (!techAccum[key]) techAccum[key] = { minutes: 0, catches: 0, sessionDates: new Set() }
        techAccum[key].minutes += tech.minutes || 0
        techAccum[key].catches += tech.catches || 0
        techAccum[key].sessionDates.add(summary.session_date)
        totalMinutes += tech.minutes || 0
        totalCatches += tech.catches || 0
      }
    }
  }

  const techniqueStats: Record<string, any> = {}
  for (const [key, val] of Object.entries(techAccum)) {
    const effortPct = totalMinutes > 0 ? val.minutes / totalMinutes : 0
    const catchPct = totalCatches > 0 ? val.catches / totalCatches : 0
    techniqueStats[key] = {
      effort_pct: Math.round(effortPct * 100) / 100,
      catch_pct: Math.round(catchPct * 100) / 100,
      effectiveness: effortPct > 0 ? Math.round((catchPct / effortPct) * 100) / 100 : 0,
      sessions: val.sessionDates.size,
    }
  }

  // Upsert angler_venue_stats
  await supabase
    .from('angler_venue_stats')
    .upsert({
      user_id: userId,
      venue_id: venueId,
      total_sessions: totalSessions,
      total_fish: totalFish,
      total_hours: Math.round(totalHours * 10) / 10,
      catch_rate: catchRate,
      fish_per_hour: fishPerHour,
      technique_stats: techniqueStats,
      last_session_date: lastSessionDate,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,venue_id' })

  // Update general_ability using venue mean
  const { data: venueStats } = await supabase
    .from('venue_stats')
    .select('mean_catch_rate')
    .eq('venue_id', venueId)
    .maybeSingle()

  if (venueStats?.mean_catch_rate && venueStats.mean_catch_rate > 0) {
    await supabase
      .from('angler_venue_stats')
      .update({ general_ability: Math.round((catchRate / venueStats.mean_catch_rate) * 100) / 100 })
      .eq('user_id', userId)
      .eq('venue_id', venueId)
  }
}

// ===== INLINE VENUE STATS COMPUTATION =====

async function computeVenueStatsInline(supabase: any, venueId: string) {
  const { data: summaries } = await supabase
    .from('session_summaries')
    .select('user_id, session_date')
    .eq('venue_id', venueId)

  const totalSessions = summaries?.length || 0
  const uniqueAnglers = new Set(summaries?.map((s: any) => s.user_id)).size
  const dates = (summaries?.map((s: any) => s.session_date) || []).sort()
  const diaryDateRange = dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : null

  // Mean catch rate from qualified anglers (>= 3 sessions)
  const { data: anglerStats } = await supabase
    .from('angler_venue_stats')
    .select('catch_rate, fish_per_hour, user_id')
    .eq('venue_id', venueId)
    .gte('total_sessions', 3)

  const qualifiedRates = (anglerStats || []).map((a: any) => a.catch_rate).filter((r: any) => r !== null && r !== undefined)
  const meanCatchRate = qualifiedRates.length > 0
    ? Math.round(qualifiedRates.reduce((a: number, b: number) => a + b, 0) / qualifiedRates.length * 100) / 100
    : null

  const qualifiedFPH = (anglerStats || []).map((a: any) => a.fish_per_hour).filter((r: any) => r !== null && r !== undefined)
  const meanFishPerHour = qualifiedFPH.length > 0
    ? Math.round(qualifiedFPH.reduce((a: number, b: number) => a + b, 0) / qualifiedFPH.length * 100) / 100
    : null

  // Upsert venue_stats
  await supabase
    .from('venue_stats')
    .upsert({
      venue_id: venueId,
      total_diary_sessions: totalSessions,
      total_anglers: uniqueAnglers,
      mean_catch_rate: meanCatchRate,
      mean_fish_per_hour: meanFishPerHour,
      diary_date_range: diaryDateRange,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'venue_id' })

  // Update general_ability on ALL angler_venue_stats for this venue
  if (meanCatchRate && meanCatchRate > 0) {
    const { data: allAnglerStats } = await supabase
      .from('angler_venue_stats')
      .select('user_id, catch_rate')
      .eq('venue_id', venueId)

    for (const stat of (allAnglerStats || [])) {
      if (stat.catch_rate !== null && stat.catch_rate !== undefined) {
        await supabase
          .from('angler_venue_stats')
          .update({ general_ability: Math.round((stat.catch_rate / meanCatchRate) * 100) / 100 })
          .eq('user_id', stat.user_id)
          .eq('venue_id', venueId)
      }
    }
  }

  return { totalSessions, uniqueAnglers, meanCatchRate }
}

// ===== MAIN HANDLER =====

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { session_id } = await req.json()
    if (!session_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Fetch session
    const { data: session, error: sessErr } = await supabase
      .from('fishing_sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    if (sessErr || !session) {
      return new Response(
        JSON.stringify({ success: false, error: `Session not found: ${sessErr?.message || 'no data'}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Fetch events ordered by time
    const { data: events, error: eventsErr } = await supabase
      .from('session_events')
      .select('*')
      .eq('session_id', session_id)
      .order('event_time', { ascending: true })
      .order('sort_order', { ascending: true })

    if (eventsErr) {
      return new Response(
        JSON.stringify({ success: false, error: `Events fetch failed: ${eventsErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Look up venue_id from venue_metadata by matching venue name
    const { data: venues } = await supabase
      .from('venue_metadata')
      .select('id, name')

    const venueName = session.venue_name?.toLowerCase() || ''
    const venue = (venues || []).find((v: any) => {
      const vmName = (v.name || '').toLowerCase()
      return venueName.includes(vmName) || vmName.includes(venueName)
    })

    if (!venue) {
      return new Response(
        JSON.stringify({ success: false, error: `No venue match for "${session.venue_name}". Known venues: ${(venues || []).map((v: any) => v.name).join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Segment weather_log into weather periods
    const weatherLog: WeatherSnapshot[] = session.weather_log || []
    const { periods: periodBoundaries, offset } = segmentWeatherPeriods(
      weatherLog, session.start_time, session.end_time, session.duration_minutes
    )

    // 5. Allocate events to periods
    const { weatherPeriods, totalFish, setupChanges } = allocateEventsToPeriods(
      periodBoundaries, events || [], offset
    )

    // 6. Apply fallback weather from events if no weather_log
    if (weatherLog.length === 0) {
      const fb = fallbackWeatherFromEvents(events || [])
      for (const wp of weatherPeriods) {
        if (wp.weather.temp === null) {
          wp.weather = fb
          wp.weather_confidence = 'event_fallback'
        }
      }
    }

    // 7. Compute session totals
    let sessionHours: number | null = null
    if (session.duration_minutes) {
      sessionHours = Math.round((session.duration_minutes / 60) * 100) / 100
    } else if (session.start_time && session.end_time) {
      sessionHours = Math.round(
        ((new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 3600000) * 100
      ) / 100
    }
    const fishPerHour = sessionHours && sessionHours > 0
      ? Math.round((totalFish / sessionHours) * 100) / 100
      : 0

    // 8. UPSERT into session_summaries
    const summaryRow = {
      session_id: session_id,
      user_id: session.user_id,
      venue_id: venue.id,
      session_date: session.session_date,
      session_hours: sessionHours,
      total_fish: totalFish,
      fish_per_hour: fishPerHour,
      blanked: totalFish === 0,
      weather_periods: weatherPeriods,
      setup_changes_count: setupChanges.length,
      setup_change_log: setupChanges,
      is_private: false,
      blank_confidence: (events || []).find((e: any) => e.event_type === 'blank')?.blank_confidence || null,
      satisfaction_score: session.satisfaction_score || null,
    }

    const { data: upserted, error: upsertErr } = await supabase
      .from('session_summaries')
      .upsert(summaryRow, { onConflict: 'session_id' })
      .select('id')
      .single()

    if (upsertErr) {
      return new Response(
        JSON.stringify({ success: false, error: `Upsert failed: ${upsertErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 9. CASCADE: recompute angler stats for this user + venue
    await computeAnglerStatsInline(supabase, session.user_id, venue.id)

    // 10. CASCADE: recompute venue stats
    await computeVenueStatsInline(supabase, venue.id)

    return new Response(
      JSON.stringify({
        success: true,
        summary_id: upserted?.id,
        weather_periods: weatherPeriods.length,
        total_fish: totalFish,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
