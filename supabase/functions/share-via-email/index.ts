import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShareEmailRequest {
  shareTokens: string[];
  recipientEmail: string;
  customMessage?: string;
}

interface ReportData {
  venue: string;
  date: string;
  weather: {
    temperature: number;
    windDirection: string;
    windSpeed: number;
  };
  advice: string;
  shareUrl: string;
  token: string;
}

function buildEmailHtml(reports: ReportData[], customMessage?: string): string {
  const baseUrl = Deno.env.get('VITE_SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 
                  `https://${Deno.env.get('VITE_SUPABASE_PROJECT_ID')}.lovableproject.com`;

  const reportCards = reports.map(report => `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 15px 0; background: white;">
      <h3 style="margin: 0 0 10px 0; color: #0f172a; font-size: 18px;">
        🎣 ${report.venue}
      </h3>
      <p style="margin: 5px 0; color: #64748b; font-size: 14px;">
        📅 ${report.date}
      </p>
      <p style="margin: 10px 0; color: #64748b; font-size: 14px;">
        🌤️ ${report.weather.temperature}°C, ${report.weather.windDirection} ${report.weather.windSpeed}mph
      </p>
      <p style="margin: 15px 0; color: #475569; font-size: 14px; line-height: 1.6;">
        ${report.advice.substring(0, 150)}${report.advice.length > 150 ? '...' : ''}
      </p>
      <a href="${report.shareUrl}" 
         style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); 
                color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; 
                font-weight: 500; margin-top: 10px;">
        View Full Report →
      </a>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fishing Advice Shared With You</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); color: white; padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">
        🎣 Fishing Advice Shared With You
      </h1>
      <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">
        AI-Powered Fishing Intelligence
      </p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      ${customMessage ? `
        <div style="background: #f1f5f9; border-left: 4px solid #0EA5E9; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
          <p style="margin: 0; color: #334155; font-style: italic; font-size: 15px;">
            "${customMessage}"
          </p>
        </div>
      ` : ''}
      
      <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Someone thought you'd find these fishing reports helpful:
      </p>
      
      ${reportCards}
      
      <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 15px 0; color: #475569; font-size: 14px;">
          Want your own AI-powered fishing insights?
        </p>
        <a href="${baseUrl}/auth" 
           style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; 
                  text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
          Sign Up For Free
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 5px 0; color: #0f172a; font-weight: 600; font-size: 14px;">
        Powered by Fishing Intelligence Advisor
      </p>
      <p style="margin: 0; color: #64748b; font-size: 12px;">
        Get AI-powered fishing insights for better catches
      </p>
      <p style="margin: 15px 0 0 0; color: #94a3b8; font-size: 11px;">
        This email was sent because someone shared fishing advice with you.
      </p>
    </div>
  </div>
</body>
</html>`;
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
    const body: ShareEmailRequest = await req.json();
    
    if (!body.shareTokens || !Array.isArray(body.shareTokens) || body.shareTokens.length === 0) {
      console.error('Invalid request: no shareTokens provided');
      return new Response(
        JSON.stringify({ error: 'shareTokens array is required and must not be empty' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!body.recipientEmail || !body.recipientEmail.includes('@')) {
      console.error('Invalid email address provided');
      return new Response(
        JSON.stringify({ error: 'Valid recipientEmail is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Fetching report details for tokens:', body.shareTokens);

    // Fetch report details for all tokens
    const reports: ReportData[] = [];
    const baseUrl = Deno.env.get('VITE_SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 
                    `https://${Deno.env.get('VITE_SUPABASE_PROJECT_ID')}.lovableproject.com`;

    for (const shareToken of body.shareTokens) {
      try {
        // Fetch shared report with query details
        const { data: sharedReport, error: shareError } = await supabase
          .from('shared_reports')
          .select(`
            share_token,
            query_id,
            queries (
              venue,
              query_date,
              advice_text,
              weather_data
            )
          `)
          .eq('share_token', shareToken)
          .single();

        if (shareError || !sharedReport) {
          console.error(`Share token ${shareToken} not found:`, shareError);
          continue;
        }

        const query = sharedReport.queries as any;
        const weatherData = query.weather_data || {};

        reports.push({
          venue: query.venue,
          date: new Date(query.query_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          weather: {
            temperature: weatherData.temperature || 0,
            windDirection: weatherData.windDirection || 'N',
            windSpeed: weatherData.windSpeed || 0,
          },
          advice: query.advice_text || 'No advice available',
          shareUrl: `${baseUrl}/share/${shareToken}`,
          token: shareToken,
        });

        console.log(`Added report for ${query.venue}`);
      } catch (error) {
        console.error(`Error processing token ${shareToken}:`, error);
        continue;
      }
    }

    if (reports.length === 0) {
      console.error('No valid reports found for provided tokens');
      return new Response(
        JSON.stringify({ error: 'No valid reports found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Building email with ${reports.length} reports`);

    // Build email HTML
    const emailHtml = buildEmailHtml(reports, body.customMessage);

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Sending email to:', body.recipientEmail);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Fishing Advisor <onboarding@resend.dev>',
        to: body.recipientEmail,
        subject: `Fishing Advice Shared With You (${reports.length} ${reports.length === 1 ? 'Report' : 'Reports'})`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Resend API error:', resendResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email',
          details: errorText 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const resendData = await resendResponse.json();
    console.log('Email sent successfully:', resendData);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Email sent to ${body.recipientEmail}`,
        reportsShared: reports.length,
        emailId: resendData.id 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in share-via-email function:', error);
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
