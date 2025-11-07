import { supabase } from "@/integrations/supabase/client";

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: string;
  conditions: string;
  precipitationProbability: number;
}

export interface Location {
  name: string;
  coordinates: [number, number];
  type: 'hotSpot' | 'goodArea' | 'entryPoint';
  description: string;
}

export interface FishingAdvice {
  advice: string;
  locations: Location[];
  queryId: string;
  weatherData: WeatherData;
}

export class AdviceServiceError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AdviceServiceError';
  }
}

export async function getFishingAdvice(
  venue: string,
  date: string,
  weatherData: WeatherData
): Promise<FishingAdvice> {
  try {
    // Validate inputs
    if (!venue || !date || !weatherData) {
      throw new AdviceServiceError(
        'Missing required parameters',
        'INVALID_INPUT'
      );
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      throw new AdviceServiceError(
        'Authentication error',
        'AUTH_ERROR',
        authError
      );
    }

    if (!user) {
      throw new AdviceServiceError(
        'User not authenticated. Please log in to get fishing advice.',
        'NOT_AUTHENTICATED'
      );
    }

    // Call edge function
    const { data, error: functionError } = await supabase.functions.invoke(
      'get-fishing-advice-mock',
      {
        body: {
          venue,
          date,
          userId: user.id,
          weatherData
        }
      }
    );

    if (functionError) {
      console.error('Edge function error:', functionError);
      throw new AdviceServiceError(
        'Failed to get fishing advice from server',
        'FUNCTION_ERROR',
        functionError
      );
    }

    if (!data) {
      throw new AdviceServiceError(
        'No data returned from server',
        'NO_DATA'
      );
    }

    // Validate response structure
    if (!data.advice || !data.locations || !data.queryId) {
      throw new AdviceServiceError(
        'Invalid response format from server',
        'INVALID_RESPONSE'
      );
    }

    return data as FishingAdvice;
  } catch (error) {
    // Re-throw AdviceServiceError as-is
    if (error instanceof AdviceServiceError) {
      throw error;
    }

    // Wrap unknown errors
    console.error('Unexpected error in getFishingAdvice:', error);
    throw new AdviceServiceError(
      'An unexpected error occurred while getting fishing advice',
      'UNKNOWN_ERROR',
      error
    );
  }
}
