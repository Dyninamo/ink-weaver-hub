export interface PredictionParams {
  week_window: number
  top_n: number
  year_decay: number
  w_temperature: number
  w_wind_speed: number
  w_precipitation: number
  w_pressure: number
  w_humidity: number
  use_cross_venue: boolean
  venue_weight: number
  source: string
}

export interface VenueProfile {
  venue: string
  region: string
  report_count: number
  rod_avg_mean: number | null
  rod_avg_std: number | null
  rod_mae: number | null
  rod_mae_ci_lo: number | null
  rod_mae_ci_hi: number | null
  character_notes: string | null
  cross_venue_rule: string
  data_quality_flag: string
  seasonal_pattern_json: string | null
}

const DEFAULT_PARAMS: PredictionParams = {
  week_window: 2,
  top_n: 10,
  year_decay: 0.7,
  w_temperature: 1.0,
  w_wind_speed: 0.25,
  w_precipitation: 1.0,
  w_pressure: 0.0,
  w_humidity: 1.0,
  use_cross_venue: false,
  venue_weight: 3.0,
  source: 'hardcoded_fallback'
}

// deno-lint-ignore no-explicit-any
export async function getPredictionParams(
  supabase: any,
  venue: string,
  target: string
): Promise<PredictionParams> {
  // Try venue-specific first
  let { data } = await supabase
    .from('prediction_params')
    .select('*')
    .eq('venue', venue)
    .eq('target', target)
    .single()

  // Fall back to global default
  if (!data) {
    const fallback = await supabase
      .from('prediction_params')
      .select('*')
      .eq('venue', '_global_default')
      .eq('target', target)
      .single()
    data = fallback.data
  }

  if (!data) return DEFAULT_PARAMS

  return {
    week_window: data.week_window,
    top_n: data.top_n,
    year_decay: data.year_decay,
    w_temperature: data.w_temperature,
    w_wind_speed: data.w_wind_speed,
    w_precipitation: data.w_precipitation,
    w_pressure: data.w_pressure,
    w_humidity: data.w_humidity,
    use_cross_venue: Boolean(data.use_cross_venue),
    venue_weight: data.venue_weight,
    source: data.source
  }
}

// deno-lint-ignore no-explicit-any
export async function getVenueProfile(
  supabase: any,
  venue: string
): Promise<VenueProfile | null> {
  const { data, error } = await supabase
    .from('venue_profiles')
    .select('*')
    .eq('venue', venue)
    .single()

  if (error || !data) return null
  return data as VenueProfile
}
