import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { user_id, fish_id } = await req.json()

    if (!user_id || !fish_id) {
      return new Response(JSON.stringify({ error: 'user_id and fish_id required' }), { status: 400, headers })
    }

    // Resolve profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_id')
      .eq('id', user_id)
      .single()

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers })
    }

    // Check fish exists and is active
    const { data: fish } = await supabase
      .from('notable_fish')
      .select('fish_id, profile_id, n_witnesses, confidence_score, verification_tier')
      .eq('fish_id', fish_id)
      .eq('is_active', true)
      .single()

    if (!fish) {
      return new Response(JSON.stringify({ error: 'Notable fish not found' }), { status: 404, headers })
    }

    // Cannot witness your own fish
    if (fish.profile_id === profile.profile_id) {
      return new Response(JSON.stringify({ error: 'Cannot witness your own fish' }), { status: 400, headers })
    }

    // Insert witness (unique constraint prevents duplicates)
    const { error: witnessError } = await supabase
      .from('fish_witnesses')
      .insert({ fish_id, profile_id: profile.profile_id })

    if (witnessError) {
      if (witnessError.code === '23505') {
        return new Response(JSON.stringify({ error: 'Already witnessed' }), { status: 409, headers })
      }
      return new Response(JSON.stringify({ error: witnessError.message }), { status: 500, headers })
    }

    // Update witness count on notable_fish
    const newCount = fish.n_witnesses + 1
    let newScore = fish.confidence_score
    let newTier = fish.verification_tier

    // Add witness points on first witness only (max 5 pts)
    if (newCount === 1) {
      newScore = Math.min(100, fish.confidence_score + 5)

      await supabase
        .from('verification_scores')
        .update({ pts_peer_witness: 5, total_score: newScore })
        .eq('fish_id', fish_id)

      // Recompute tier
      if (newScore >= 85) newTier = 4
      else if (newScore >= 60) newTier = 3
      else if (newScore >= 35) newTier = 2
      else newTier = 1
    }

    await supabase
      .from('notable_fish')
      .update({
        n_witnesses: newCount,
        confidence_score: newScore,
        verification_tier: newTier
      })
      .eq('fish_id', fish_id)

    return new Response(JSON.stringify({
      fish_id,
      n_witnesses: newCount,
      confidence_score: newScore,
      verification_tier: newTier
    }), { headers })

  } catch (err) {
    console.error('witness-notable-fish error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
