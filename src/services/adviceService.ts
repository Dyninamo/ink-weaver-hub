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

// ============================================================
// ADVICE v2 — types and function
// ============================================================

export interface TacticalData {
  techniques: { technique: string; weighted_catches: number; weighted_minutes: number; score: number }[];
  flies: { fly: string; weighted_catches: number; score: number }[];
  spots: { spot: string; weighted_catches: number; score: number }[];
  catch_by_hour: Record<string, number>;
  session_count: number;
  period_count: number;
}

export interface PersonalData {
  has_personal: boolean;
  general_ability?: number;
  total_sessions?: number;
  total_fish?: number;
  catch_rate?: number;
  fish_per_hour?: number;
  technique_stats?: Record<string, any>;
  message?: string;
}

export interface ConfidenceData {
  report_data: 'high' | 'medium' | 'low';
  tactical_data: 'high' | 'medium' | 'low' | 'none';
  personal_data: 'available' | 'insufficient';
}

export interface AdviceV2Response {
  advice: string;
  prediction: PredictionData;
  tactical: TacticalData;
  personal: PersonalData;
  tier: string;
  season: string;
  reportCount: number;
  matchedReportCount: number;
  sessionCount: number;
  queryId: string | null;
  weather: {
    temp: number;
    wind_speed: number;
    wind_dir: string;
    conditions: string;
    pressure: number;
    humidity: number;
    is_historical: boolean;
  };
  confidence: ConfidenceData;
  model_info: {
    params_source: string;
    data_quality: string;
    character_notes: string | null;
  };
}

// v2: calls get-ai-advice-v2 which orchestrates all 4 processes internally
export async function getAdviceV2(
  venue: string,
  date: string,
): Promise<AdviceV2Response> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase.functions.invoke('get-ai-advice-v2', {
    body: { venue_name: venue, target_date: date, user_id: user?.id ?? null }
  })

  if (error) throw new AdviceServiceError(error.message || 'Failed to get advice v2')
  return data as AdviceV2Response
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
// Returns AdviceV2Response if v2 succeeds, FishingAdviceResponse if fallback
export async function getFishingAdvice(
  venue: string,
  date: string,
  _weatherData?: { temperature: number; windSpeed: number; precipitation: number; pressure?: number; humidity?: number },
  _isPremium: boolean = false
): Promise<AdviceV2Response | FishingAdviceResponse> {
  try {
    return await getAdviceV2(venue, date)
  } catch (err) {
    console.warn('v2 advice failed, falling back to legacy:', err)
    return await getBasicAdvice(venue, date, _weatherData)
  }
}
