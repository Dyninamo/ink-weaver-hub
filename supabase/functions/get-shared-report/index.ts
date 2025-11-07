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
    const { token } = await req.json();
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Validating share token:', token);

    // Get the shared report
    const { data: sharedReport, error: shareError } = await supabase
      .from('shared_reports')
      .select(`
        id,
        query_id,
        expires_at,
        view_count,
        created_by,
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
        JSON.stringify({ error: 'Share link not found' }),
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
    const { data: userData } = await supabase.auth.admin.getUserById(sharedReport.created_by);
    const creatorEmail = userData?.user?.email || 'Anonymous';

    // Increment view count
    await supabase
      .from('shared_reports')
      .update({ view_count: (sharedReport.view_count || 0) + 1 })
      .eq('id', sharedReport.id);

    // Track the view (get IP from headers)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const viewerIp = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';

    await supabase
      .from('share_views')
      .insert({
        shared_report_id: sharedReport.id,
        viewer_ip: viewerIp,
      });

    console.log('Share accessed successfully');

    return new Response(
      JSON.stringify({
        report: sharedReport.queries,
        creator: creatorEmail,
        expiresAt: sharedReport.expires_at,
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
