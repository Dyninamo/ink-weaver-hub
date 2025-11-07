import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateShareRequest {
  queryIds: string[];
}

interface ShareResult {
  queryId: string;
  shareToken: string;
  shareUrl: string;
  shortUrl?: string;
}

function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = 12;
  let token = '';
  
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    token += chars[randomValues[i] % chars.length];
  }
  
  return token;
}

async function shortenUrlWithBitly(longUrl: string, bitlyToken: string): Promise<string | null> {
  try {
    console.log('Attempting to shorten URL with Bitly:', longUrl);
    
    const response = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bitlyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        long_url: longUrl,
      }),
    });

    if (!response.ok) {
      console.error('Bitly API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    console.log('Bitly shortened URL:', data.link);
    return data.link;
  } catch (error) {
    console.error('Error shortening URL with Bitly:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Authenticated user:', user.id);

    // Parse request body
    const body: CreateShareRequest = await req.json();
    
    if (!body.queryIds || !Array.isArray(body.queryIds) || body.queryIds.length === 0) {
      console.error('Invalid request: no queryIds provided');
      return new Response(
        JSON.stringify({ error: 'queryIds array is required and must not be empty' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Processing share request for queries:', body.queryIds);

    const results: ShareResult[] = [];
    const bitlyToken = Deno.env.get('BITLY_API_TOKEN');
    const baseUrl = Deno.env.get('VITE_SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 
                    `https://${Deno.env.get('VITE_SUPABASE_PROJECT_ID')}.lovableproject.com`;

    for (const queryId of body.queryIds) {
      try {
        // Verify query belongs to user
        const { data: query, error: queryError } = await supabase
          .from('queries')
          .select('id, user_id')
          .eq('id', queryId)
          .eq('user_id', user.id)
          .single();

        if (queryError || !query) {
          console.error(`Query ${queryId} not found or not authorized:`, queryError);
          return new Response(
            JSON.stringify({ 
              error: `Query ${queryId} not found or you do not have permission to share it` 
            }),
            { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        console.log(`Query ${queryId} verified for user ${user.id}`);

        // Check if share already exists
        const { data: existingShare } = await supabase
          .from('shared_reports')
          .select('*')
          .eq('query_id', queryId)
          .eq('created_by', user.id)
          .maybeSingle();

        let shareToken: string;
        let shareUrl: string;
        let shortUrl: string | undefined;

        if (existingShare) {
          // Return existing share
          console.log(`Using existing share for query ${queryId}`);
          shareToken = existingShare.share_token;
          shareUrl = `${baseUrl}/share/${shareToken}`;
          shortUrl = existingShare.short_url || undefined;
        } else {
          // Generate new share token
          shareToken = generateShareToken();
          
          // Set expiration to 30 days from now
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          shareUrl = `${baseUrl}/share/${shareToken}`;

          // Try to shorten URL with Bitly if token is available
          if (bitlyToken) {
            shortUrl = await shortenUrlWithBitly(shareUrl, bitlyToken) || undefined;
          }

          // Create shared_reports record
          const { error: insertError } = await supabase
            .from('shared_reports')
            .insert({
              query_id: queryId,
              share_token: shareToken,
              created_by: user.id,
              expires_at: expiresAt.toISOString(),
              short_url: shortUrl || null,
            });

          if (insertError) {
            console.error(`Error creating share for query ${queryId}:`, insertError);
            throw insertError;
          }

          console.log(`Created new share for query ${queryId} with token ${shareToken}`);
        }

        results.push({
          queryId,
          shareToken: shareToken,
          shareUrl,
          shortUrl,
        });

      } catch (error) {
        console.error(`Error processing query ${queryId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
          JSON.stringify({ 
            error: `Failed to create share for query ${queryId}`,
            details: errorMessage 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    console.log('Successfully created shares:', results);

    return new Response(
      JSON.stringify({ shareLinks: results }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in create-share-link function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
