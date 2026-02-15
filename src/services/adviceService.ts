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

// Free tier: calls get-fishing-advice without userId for unauthenticated fallback
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

// Premium tier: AI-powered with ML model + Claude
export async function getPremiumAdvice(
  venue: string,
  date: string,
  weatherData: { temperature: number; windSpeed: number; precipitation: number; pressure?: number; humidity?: number }
): Promise<FishingAdviceResponse> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  
  const { data, error } = await supabase.functions.invoke('get-fishing-advice', {
    body: { venue, date, userId: user.id, weatherData }
  })
  
  if (error) throw new Error(error.message || 'Failed to get advice')
  return data as FishingAdviceResponse
}

// Smart router: tries premium first, falls back to free
export async function getFishingAdvice(
  venue: string,
  date: string,
  weatherData: { temperature: number; windSpeed: number; precipitation: number; pressure?: number; humidity?: number },
  isPremium: boolean = false
): Promise<FishingAdviceResponse> {
  if (isPremium) {
    try {
      return await getPremiumAdvice(venue, date, weatherData)
    } catch (err) {
      console.warn('Premium advice failed, falling back to basic:', err)
      return await getBasicAdvice(venue, date, weatherData)
    }
  }
  return await getBasicAdvice(venue, date, weatherData)
}
