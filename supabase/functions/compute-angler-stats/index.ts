import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, venue_id } = await req.json()
    if (!user_id || !venue_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id and venue_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch all session summaries for this user + venue
    const { data: summaries, error: fetchErr } = await supabase
      .from('session_summaries')
      .select('total_fish, session_hours, weather_periods, session_date')
      .eq('user_id', user_id)
      .eq('venue_id', venue_id)

    if (fetchErr) {
      return new Response(
        JSON.stringify({ success: false, error: `Fetch failed: ${fetchErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!summaries || summaries.length === 0) {
      return new Response(
        JSON.stringify({ success: true, total_sessions: 0, catch_rate: 0, general_ability: null, message: 'No sessions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
    const { error: upsertErr } = await supabase
      .from('angler_venue_stats')
      .upsert({
        user_id,
        venue_id,
        total_sessions: totalSessions,
        total_fish: totalFish,
        total_hours: Math.round(totalHours * 10) / 10,
        catch_rate: catchRate,
        fish_per_hour: fishPerHour,
        technique_stats: techniqueStats,
        last_session_date: lastSessionDate,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,venue_id' })

    if (upsertErr) {
      return new Response(
        JSON.stringify({ success: false, error: `Upsert failed: ${upsertErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update general_ability using venue mean
    let generalAbility: number | null = null
    const { data: venueStats } = await supabase
      .from('venue_stats')
      .select('mean_catch_rate')
      .eq('venue_id', venue_id)
      .maybeSingle()

    if (venueStats?.mean_catch_rate && venueStats.mean_catch_rate > 0) {
      generalAbility = Math.round((catchRate / venueStats.mean_catch_rate) * 100) / 100
      await supabase
        .from('angler_venue_stats')
        .update({ general_ability: generalAbility })
        .eq('user_id', user_id)
        .eq('venue_id', venue_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_sessions: totalSessions,
        catch_rate: catchRate,
        fish_per_hour: fishPerHour,
        general_ability: generalAbility,
        technique_stats: techniqueStats,
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
