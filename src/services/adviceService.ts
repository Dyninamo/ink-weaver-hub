import { supabase } from '@/integrations/supabase/client'

// Legacy types kept for backward compatibility with existing components
export interface WeatherData {
  temperature: number
  windSpeed: number
  windDirection: string
  conditions: string
  precipitation: number
  precipitationProbability: number
  humidity: number
  pressure: number
}

export interface Location {
  name: string
  coordinates: [number, number]
  type: 'hotSpot' | 'goodArea' | 'entryPoint'
  description: string
}

export class AdviceServiceError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'AdviceServiceError'
  }
}

export interface ModelInfo {
  params_source: 'tuned' | 'global_default' | 'hardcoded_fallback'
  data_quality: 'full' | 'limited' | 'insufficient'
  report_count: number
  rod_mae: number | null
  confidence_interval: [number, number] | null
  character_notes: string | null
}

export interface PredictionData {
  rod_average: {
    predicted: number
    range: [number, number]
    confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  }
  methods: { method: string; frequency?: number; score?: number }[]
  flies: { fly: string; frequency?: number; score?: number }[]
  spots: { spot: string; frequency?: number; score?: number }[]
}

export interface FishingAdviceResponse {
  advice: string
  prediction: PredictionData
  locations?: { name: string; type: string }[]
  weatherData?: any
  queryId?: string
  tier: 'free' | 'premium'
  season?: string
  weatherCategory?: string
  reportCount?: number
  model_info?: ModelInfo
}

// v2: calls get-ai-advice-v2 which orchestrates all 4 processes internally
export async function getAdviceV2(
  venue: string,
  date: string,
): Promise<FishingAdviceResponse> {
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase.functions.invoke('get-ai-advice-v2', {
    body: { venue_name: venue, target_date: date, user_id: user?.id ?? null }
  })
  
  if (error) throw new Error(error.message || 'Failed to get advice')

  // Normalise the v2 response into the FishingAdviceResponse shape
  const v2 = data as any
  const weatherData = v2.weather ?? {}
  return {
    advice: v2.advice,
    prediction: v2.prediction,
    weatherData: {
      temperature: weatherData.temp ?? 0,
      windSpeed: weatherData.wind_speed ?? 0,
      windDirection: weatherData.wind_dir ?? '',
      conditions: weatherData.conditions ?? '',
      precipitation: 0,
      precipitationProbability: 0,
      humidity: weatherData.humidity ?? 0,
      pressure: weatherData.pressure ?? 0,
    },
    queryId: v2.queryId,
    tier: 'premium',
    season: v2.season,
    reportCount: v2.reportCount,
    model_info: v2.model_info,
  } as FishingAdviceResponse
}

// Legacy: calls original get-fishing-advice
export async function getBasicAdvice(
  venue: string,
  date: string,
  weatherData?: { temperature: number; windSpeed: number; precipitation: number }
): Promise<FishingAdviceResponse> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase.functions.invoke('get-fishing-advice', {
    body: { venue, date, userId: user?.id, weatherData }
  })
  
  if (error) throw new Error(error.message || 'Failed to get advice')
  return data as FishingAdviceResponse
}

// Smart router: uses v2 for all users (falls back to legacy on error)
export async function getFishingAdvice(
  venue: string,
  date: string,
  _weatherData?: { temperature: number; windSpeed: number; precipitation: number; pressure?: number; humidity?: number },
  _isPremium: boolean = false
): Promise<FishingAdviceResponse> {
  try {
    return await getAdviceV2(venue, date)
  } catch (err) {
    console.warn('v2 advice failed, falling back to legacy:', err)
    return await getBasicAdvice(venue, date, _weatherData)
  }
}
