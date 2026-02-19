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

    const { venue_id } = await req.json()
    if (!venue_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'venue_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Count sessions and unique anglers from session_summaries
    const { data: summaries, error: fetchErr } = await supabase
      .from('session_summaries')
      .select('user_id, session_date')
      .eq('venue_id', venue_id)

    if (fetchErr) {
      return new Response(
        JSON.stringify({ success: false, error: `Fetch failed: ${fetchErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const totalSessions = summaries?.length || 0
    const uniqueAnglers = new Set((summaries || []).map((s: any) => s.user_id)).size
    const dates = ((summaries || []).map((s: any) => s.session_date)).sort()
    const diaryDateRange = dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : null

    // Mean catch rate from qualified anglers (>= 3 sessions at this venue)
    const { data: anglerStats } = await supabase
      .from('angler_venue_stats')
      .select('catch_rate, fish_per_hour, user_id')
      .eq('venue_id', venue_id)
      .gte('total_sessions', 3)

    const qualifiedRates = (anglerStats || [])
      .map((a: any) => a.catch_rate)
      .filter((r: any) => r !== null && r !== undefined)
    const meanCatchRate = qualifiedRates.length > 0
      ? Math.round(qualifiedRates.reduce((a: number, b: number) => a + b, 0) / qualifiedRates.length * 100) / 100
      : null

    const qualifiedFPH = (anglerStats || [])
      .map((a: any) => a.fish_per_hour)
      .filter((r: any) => r !== null && r !== undefined)
    const meanFishPerHour = qualifiedFPH.length > 0
      ? Math.round(qualifiedFPH.reduce((a: number, b: number) => a + b, 0) / qualifiedFPH.length * 100) / 100
      : null

    // Upsert venue_stats
    const { error: upsertErr } = await supabase
      .from('venue_stats')
      .upsert({
        venue_id,
        total_diary_sessions: totalSessions,
        total_anglers: uniqueAnglers,
        mean_catch_rate: meanCatchRate,
        mean_fish_per_hour: meanFishPerHour,
        diary_date_range: diaryDateRange,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'venue_id' })

    if (upsertErr) {
      return new Response(
        JSON.stringify({ success: false, error: `Upsert failed: ${upsertErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update general_ability on ALL angler_venue_stats rows for this venue
    if (meanCatchRate && meanCatchRate > 0) {
      const { data: allAnglerStats } = await supabase
        .from('angler_venue_stats')
        .select('user_id, catch_rate')
        .eq('venue_id', venue_id)

      for (const stat of (allAnglerStats || [])) {
        if (stat.catch_rate !== null && stat.catch_rate !== undefined) {
          await supabase
            .from('angler_venue_stats')
            .update({
              general_ability: Math.round((stat.catch_rate / meanCatchRate) * 100) / 100,
            })
            .eq('user_id', stat.user_id)
            .eq('venue_id', venue_id)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_diary_sessions: totalSessions,
        total_anglers: uniqueAnglers,
        mean_catch_rate: meanCatchRate,
        mean_fish_per_hour: meanFishPerHour,
        diary_date_range: diaryDateRange,
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
