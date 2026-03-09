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

    const body = await req.json()
    const {
      user_id, session_id, venue_id, venue_name,
      species, length_cm, weight_kg,
      measurement_unit = 'metric',
      photo_storage_path
    } = body

    if (!user_id || !venue_id || !venue_name || !species) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers })
    }
    if (!length_cm && !weight_kg) {
      return new Response(JSON.stringify({ error: 'At least one of length_cm or weight_kg required' }), { status: 400, headers })
    }

    // 1. Resolve profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_id')
      .eq('id', user_id)
      .single()

    if (!profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), { status: 404, headers })
    }

    // 2. Look up species conversion coefficients
    const { data: speciesProfile } = await supabase
      .from('species_size_profiles')
      .select('*')
      .eq('species_name', species)
      .single()

    if (!speciesProfile) {
      return new Response(JSON.stringify({ error: `Unknown species: ${species}` }), { status: 400, headers })
    }

    // Validate venue_id exists
    const { data: venueRow } = await supabase
      .from('venues_new')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .maybeSingle()

    if (!venueRow) {
      return new Response(
        JSON.stringify({ error: 'Venue not found' }),
        { status: 400, headers }
      )
    }

    // 3. Convert length <-> weight using L-W formula: weight_kg = a * (length_cm ^ b)
    let finalLengthCm = length_cm
    let finalWeightKg = weight_kg

    if (length_cm && !weight_kg) {
      finalWeightKg = speciesProfile.lw_coefficient_a * Math.pow(length_cm, speciesProfile.lw_exponent_b)
    } else if (weight_kg && !length_cm) {
      finalLengthCm = Math.pow(weight_kg / speciesProfile.lw_coefficient_a, 1 / speciesProfile.lw_exponent_b)
    }

    // Imperial conversions
    const finalWeightLb = finalWeightKg ? finalWeightKg * 2.20462 : null
    const finalLengthIn = finalLengthCm ? finalLengthCm / 2.54 : null

    // 4. Plausibility check
    let plausibilityPass = true
    if (finalLengthCm && finalWeightKg) {
      const predictedWeight = speciesProfile.lw_coefficient_a * Math.pow(finalLengthCm, speciesProfile.lw_exponent_b)
      const toleranceFraction = speciesProfile.tolerance_pct / 100
      const lowerBound = predictedWeight * (1 - toleranceFraction)
      const upperBound = predictedWeight * (1 + toleranceFraction)
      plausibilityPass = finalWeightKg >= lowerBound && finalWeightKg <= upperBound
    }

    // 5. EXIF extraction (if photo provided)
    let exifData: Record<string, any> = {}
    let photoUrl: string | null = null

    if (photo_storage_path) {
      const { data: urlData } = supabase.storage
        .from('notable-fish')
        .getPublicUrl(photo_storage_path)

      photoUrl = urlData?.publicUrl || null

      try {
        const { data: fileData } = await supabase.storage
          .from('notable-fish')
          .download(photo_storage_path)

        if (fileData) {
          const exifr = await import('https://esm.sh/exifr@7.1.3')
          const arrayBuffer = await fileData.arrayBuffer()
          const parsed = await exifr.parse(arrayBuffer, {
            gps: true,
            pick: ['DateTimeOriginal', 'Make', 'Model', 'Software',
                   'FocalLength', 'SubjectDistance',
                   'latitude', 'longitude']
          }).catch(() => null)

          if (parsed) {
            exifData = {
              exif_latitude: parsed.latitude || null,
              exif_longitude: parsed.longitude || null,
              exif_taken_at: parsed.DateTimeOriginal ? new Date(parsed.DateTimeOriginal).toISOString() : null,
              exif_device: parsed.Make && parsed.Model ? `${parsed.Make} ${parsed.Model}` : null,
              exif_edited: parsed.Software ? !['', undefined].includes(parsed.Software) : false,
              exif_subject_distance_m: parsed.SubjectDistance || null
            }
          }
        }
      } catch (e) {
        console.error('EXIF extraction error:', e)
        // Continue without EXIF — photo still counts for scoring
      }
    }

    // 6. Verification checks
    let checkLocationPass: boolean | null = null
    let checkTimePass: boolean | null = null
    let checkEditClean: boolean | null = null

    // Location check: EXIF GPS within 500m of venue
    if (exifData.exif_latitude && exifData.exif_longitude && venue_id) {
      const { data: venueData } = await supabase
        .from('venues_new')
        .select('latitude, longitude')
        .eq('venue_id', venue_id)
        .single()

      if (venueData?.latitude && venueData?.longitude) {
        const R = 6371000
        const dLat = (exifData.exif_latitude - venueData.latitude) * Math.PI / 180
        const dLon = (exifData.exif_longitude - venueData.longitude) * Math.PI / 180
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(venueData.latitude * Math.PI / 180) *
                  Math.cos(exifData.exif_latitude * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2)
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        checkLocationPass = distance <= 500
      }
    }

    // Time check: EXIF timestamp within session window
    if (exifData.exif_taken_at && session_id) {
      const { data: sessionData } = await supabase
        .from('fishing_sessions')
        .select('session_date')
        .eq('id', session_id)
        .single()

      if (sessionData?.session_date) {
        const exifDate = exifData.exif_taken_at.split('T')[0]
        checkTimePass = exifDate === sessionData.session_date
      }
    }

    // Edit check: no editing software detected
    if (photo_storage_path) {
      checkEditClean = !exifData.exif_edited
    }

    // 7. Compute confidence score (8 components)
    const pts = {
      pts_measurement_entered: 20,
      pts_plausibility_pass: plausibilityPass ? 15 : 0,
      pts_photo_submitted: photo_storage_path ? 15 : 0,
      pts_exif_clean: checkEditClean === true ? 10 : 0,
      pts_location_match: checkLocationPass === true ? 15 : 0,
      pts_time_match: checkTimePass === true ? 10 : 0,
      pts_measure_in_frame: 0,
      pts_peer_witness: 0
    }

    const totalScore = Object.values(pts).reduce((a, b) => a + b, 0)

    // 8. Determine verification tier
    let tier = 1
    if (totalScore >= 85) tier = 4
    else if (totalScore >= 60) tier = 3
    else if (totalScore >= 35) tier = 2

    // 9. Compute percentiles + records
    let venuePercentile: number | null = null
    let platformPercentile: number | null = null
    let isPersonalBest = false
    let isVenueSeasonRecord = false
    let isVenueAlltimeRecord = false
    let isPlatformRecord = false

    if (finalWeightKg) {
      const { data: venueFish } = await supabase
        .from('notable_fish')
        .select('weight_kg')
        .eq('venue_id', venue_id)
        .eq('species', species)
        .eq('is_active', true)

      if (venueFish && venueFish.length > 0) {
        const belowCount = venueFish.filter((f: any) => f.weight_kg && f.weight_kg < finalWeightKg).length
        venuePercentile = (belowCount / venueFish.length) * 100
      }

      const { data: allFish } = await supabase
        .from('notable_fish')
        .select('weight_kg')
        .eq('species', species)
        .eq('is_active', true)

      if (allFish && allFish.length > 0) {
        const belowCount = allFish.filter((f: any) => f.weight_kg && f.weight_kg < finalWeightKg).length
        platformPercentile = (belowCount / allFish.length) * 100
      }

      const { data: personalBest } = await supabase
        .from('notable_fish')
        .select('weight_kg')
        .eq('profile_id', profile.profile_id)
        .eq('species', species)
        .eq('is_active', true)
        .order('weight_kg', { ascending: false })
        .limit(1)

      isPersonalBest = !personalBest || personalBest.length === 0 || finalWeightKg > (personalBest[0].weight_kg || 0)

      const currentYear = new Date().getFullYear().toString()
      const { data: seasonBest } = await supabase
        .from('notable_fish')
        .select('weight_kg')
        .eq('venue_id', venue_id)
        .eq('species', species)
        .eq('is_active', true)
        .gte('submitted_at', `${currentYear}-01-01`)
        .order('weight_kg', { ascending: false })
        .limit(1)

      isVenueSeasonRecord = !seasonBest || seasonBest.length === 0 || finalWeightKg > (seasonBest[0].weight_kg || 0)

      const { data: alltimeBest } = await supabase
        .from('notable_fish')
        .select('weight_kg')
        .eq('venue_id', venue_id)
        .eq('species', species)
        .eq('is_active', true)
        .order('weight_kg', { ascending: false })
        .limit(1)

      isVenueAlltimeRecord = !alltimeBest || alltimeBest.length === 0 || finalWeightKg > (alltimeBest[0].weight_kg || 0)

      const { data: platformBest } = await supabase
        .from('notable_fish')
        .select('weight_kg')
        .eq('species', species)
        .eq('is_active', true)
        .order('weight_kg', { ascending: false })
        .limit(1)

      isPlatformRecord = !platformBest || platformBest.length === 0 || finalWeightKg > (platformBest[0].weight_kg || 0)
    }

    // 10. Insert notable_fish
    const now = new Date().toISOString()
    const { data: fish, error: fishError } = await supabase
      .from('notable_fish')
      .insert({
        profile_id: profile.profile_id,
        session_id: session_id || null,
        venue_id,
        venue_name,
        species,
        length_cm: finalLengthCm,
        length_in: finalLengthIn,
        weight_kg: finalWeightKg,
        weight_lb: finalWeightLb,
        measurement_unit,
        measurement_entered_at: now,
        photo_url: photoUrl,
        photo_uploaded_at: photo_storage_path ? now : null,
        ...exifData,
        check_location_pass: checkLocationPass,
        check_time_pass: checkTimePass,
        check_edit_clean: checkEditClean,
        check_plausibility_pass: plausibilityPass,
        check_measure_in_frame: null,
        confidence_score: totalScore,
        verification_tier: tier,
        n_witnesses: 0,
        venue_percentile: venuePercentile,
        platform_percentile: platformPercentile,
        is_personal_best: isPersonalBest,
        is_venue_season_record: isVenueSeasonRecord,
        is_venue_alltime_record: isVenueAlltimeRecord,
        is_platform_record: isPlatformRecord
      })
      .select('fish_id')
      .single()

    if (fishError) {
      return new Response(JSON.stringify({ error: fishError.message }), { status: 500, headers })
    }

    // 11. Insert verification_scores
    await supabase
      .from('verification_scores')
      .insert({
        fish_id: fish.fish_id,
        ...pts,
        total_score: totalScore
      })

    // 12. Insert leaderboard_entries
    const leaderboardInserts: any[] = []
    const baseEntry = {
      fish_id: fish.fish_id,
      venue_id,
      profile_id: profile.profile_id,
      species,
      weight_kg: finalWeightKg,
      weight_lb: finalWeightLb,
      length_cm: finalLengthCm,
      length_in: finalLengthIn,
      venue_percentile: venuePercentile,
      verification_tier: tier
    }

    if (isPersonalBest) {
      leaderboardInserts.push({ ...baseEntry, scope: 'personal_best' })
    }
    if (isVenueSeasonRecord) {
      leaderboardInserts.push({ ...baseEntry, scope: 'venue_season', season: new Date().getFullYear().toString() })
    }
    if (isVenueAlltimeRecord) {
      leaderboardInserts.push({ ...baseEntry, scope: 'venue_alltime' })
    }
    if (isPlatformRecord) {
      leaderboardInserts.push({ ...baseEntry, scope: 'platform_species' })
    }

    if (leaderboardInserts.length > 0) {
      await supabase.from('leaderboard_entries').insert(leaderboardInserts)
    }

    // 13. Return result
    return new Response(JSON.stringify({
      fish_id: fish.fish_id,
      species,
      weight_kg: finalWeightKg,
      weight_lb: finalWeightLb,
      length_cm: finalLengthCm,
      length_in: finalLengthIn,
      plausibility_pass: plausibilityPass,
      confidence_score: totalScore,
      verification_tier: tier,
      venue_percentile: venuePercentile,
      platform_percentile: platformPercentile,
      is_personal_best: isPersonalBest,
      is_venue_season_record: isVenueSeasonRecord,
      is_venue_alltime_record: isVenueAlltimeRecord,
      is_platform_record: isPlatformRecord,
      checks: {
        location: checkLocationPass,
        time: checkTimePass,
        edit_clean: checkEditClean,
        plausibility: plausibilityPass,
        measure_in_frame: null
      }
    }), { headers })

  } catch (err) {
    console.error('submit-notable-fish error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
