import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, includeFullContent = false } = await req.json();
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check authentication if full content requested
    let authenticatedUserId: string | null = null;
    if (includeFullContent) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authentication required for full content' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user authentication
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );

      const { data: { user }, error: authError } = await supabaseUser.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      authenticatedUserId = user.id;
    }

    console.log('Validating share token:', token, 'Full content:', includeFullContent);

    // Get the shared report with query data
    const { data: sharedReport, error: shareError } = await supabaseAdmin
      .from('shared_reports')
      .select(`
        id,
        query_id,
        expires_at,
        view_count,
        created_by,
        created_at,
        queries (
          venue,
          query_date,
          advice_text,
          weather_data,
          recommended_locations,
          map_image_url
        )
      `)
      .eq('share_token', token)
      .single();

    if (shareError || !sharedReport) {
      console.error('Share not found:', shareError);
      return new Response(
        JSON.stringify({ error: 'Report not found or has expired' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (sharedReport.expires_at) {
      const expiresAt = new Date(sharedReport.expires_at);
      if (expiresAt < new Date()) {
        console.log('Share link expired');
        return new Response(
          JSON.stringify({ error: 'Share link has expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get creator's email (for display)
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(sharedReport.created_by);
    const creatorEmail = userData?.user?.email || 'Anonymous';

    // Increment view count
    await supabaseAdmin
      .from('shared_reports')
      .update({ view_count: (sharedReport.view_count || 0) + 1 })
      .eq('id', sharedReport.id);

    // Prepare query data
    const queryData = sharedReport.queries as any;
    let responseData: any = {
      venue: queryData.venue,
      query_date: queryData.query_date,
      weather_data: queryData.weather_data,
      map_image_url: queryData.map_image_url,
    };

    // Track view and return appropriate content based on authentication
    if (includeFullContent && authenticatedUserId) {
      // Record detailed view for authenticated users
      const forwardedFor = req.headers.get('x-forwarded-for');
      const viewerIp = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';

      // Get viewer's email
      const { data: viewerData } = await supabaseAdmin.auth.admin.getUserById(authenticatedUserId);
      const viewerEmail = viewerData?.user?.email || null;

      await supabaseAdmin
        .from('share_views')
        .insert({
          shared_report_id: sharedReport.id,
          viewer_ip: viewerIp,
          viewer_email: viewerEmail,
        });

      // Return full content
      responseData = {
        ...responseData,
        advice_text: queryData.advice_text,
        recommended_locations: queryData.recommended_locations,
      };

      console.log('Full content accessed by authenticated user');
    } else {
      // Return preview for non-authenticated users
      responseData = {
        ...responseData,
        advice_text: queryData.advice_text?.substring(0, 200) + '...' || '',
        recommended_locations_count: queryData.recommended_locations?.length || 0,
      };

      console.log('Preview content accessed');
    }

    return new Response(
      JSON.stringify({
        query: responseData,
        shareInfo: {
          created_by: creatorEmail,
          view_count: (sharedReport.view_count || 0) + 1,
          created_at: sharedReport.created_at,
        },
        isPreview: !includeFullContent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in get-shared-report:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
