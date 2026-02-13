import { supabase } from "@/integrations/supabase/client";
import type { FishingAdviceResponse } from "./adviceService";

export interface QuerySummary {
  id: string;
  venue: string;
  query_date: string;
  created_at: string;
}

export interface FullQuery {
  id: string;
  venue: string;
  query_date: string;
  advice_text: string;
  recommended_locations: any[];
  weather_data: any;
  created_at: string;
}

export class QueryServiceError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'QueryServiceError';
  }
}

export async function getRecentQueries(limit: number = 5): Promise<QuerySummary[]> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new QueryServiceError(
        'User not authenticated',
        'NOT_AUTHENTICATED',
        authError
      );
    }

    const { data, error } = await supabase
      .from('queries')
      .select('id, venue, query_date, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent queries:', error);
      throw new QueryServiceError(
        'Failed to fetch recent queries',
        'FETCH_ERROR',
        error
      );
    }

    return data || [];
  } catch (error) {
    if (error instanceof QueryServiceError) {
      throw error;
    }
    console.error('Unexpected error in getRecentQueries:', error);
    throw new QueryServiceError(
      'An unexpected error occurred',
      'UNKNOWN_ERROR',
      error
    );
  }
}

export async function getQueryById(queryId: string): Promise<FullQuery> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new QueryServiceError(
        'User not authenticated',
        'NOT_AUTHENTICATED',
        authError
      );
    }

    const { data, error } = await supabase
      .from('queries')
      .select('*')
      .eq('id', queryId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching query:', error);
      throw new QueryServiceError(
        'Failed to fetch query details',
        'FETCH_ERROR',
        error
      );
    }

    if (!data) {
      throw new QueryServiceError(
        'Query not found',
        'NOT_FOUND'
      );
    }

    return data as FullQuery;
  } catch (error) {
    if (error instanceof QueryServiceError) {
      throw error;
    }
    console.error('Unexpected error in getQueryById:', error);
    throw new QueryServiceError(
      'An unexpected error occurred',
      'UNKNOWN_ERROR',
      error
    );
  }
}
