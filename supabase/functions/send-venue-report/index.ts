import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv, envErrorResponse } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { session_id, venue_id, email_override } = await req.json();
    if (!session_id || !venue_id) {
      return json({ error: "session_id and venue_id required" }, 400);
    }

    // Validate email format if provided
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email_override && !EMAIL_RE.test(email_override)) {
      return json({ error: "Invalid email format" }, 400);
    }

    // 1. Determine email
    let emailTo: string | null = email_override || null;
    let emailSource: string = email_override ? "user_submitted" : "scraped";

    if (email_override) {
      // Save user-submitted email to venue
      await supabase
        .from("venues_new")
        .update({ contact_email: email_override, contact_email_source: "user_submitted" })
        .eq("venue_id", venue_id);
    } else {
      const { data: venue } = await supabase
        .from("venues_new")
        .select("contact_email")
        .eq("venue_id", venue_id)
        .single();
      emailTo = venue?.contact_email || null;
    }

    if (!emailTo) return json({ status: "no_email" });

    // 3. Check opted_out
    const { data: optedOut } = await supabase
      .from("venue_outreach")
      .select("outreach_id")
      .eq("venue_id", venue_id)
      .eq("status", "opted_out")
      .limit(1)
      .maybeSingle();

    if (optedOut) return json({ status: "opted_out" });

    // 4. Check cooldown (90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: recentSend } = await supabase
      .from("venue_outreach")
      .select("outreach_id")
      .eq("venue_id", venue_id)
      .eq("status", "sent")
      .gte("sent_at", ninetyDaysAgo)
      .limit(1)
      .maybeSingle();

    if (recentSend) return json({ status: "cooldown" });

    // 5. Fetch session data
    const { data: session } = await supabase
      .from("fishing_sessions")
      .select("venue_name, session_date, duration_minutes")
      .eq("id", session_id)
      .single();

    if (!session) return json({ error: "Session not found" }, 404);

    // 6. Fetch events
    const { data: events } = await supabase
      .from("session_events")
      .select("event_type, species, flies_on_cast")
      .eq("session_id", session_id);

    const catches = (events || []).filter((e: any) => e.event_type === "catch");
    const fishCount = catches.length;

    // Top fly
    const flyCounts: Record<string, number> = {};
    for (const c of catches) {
      const flies = c.flies_on_cast;
      if (Array.isArray(flies)) {
        for (const f of flies) {
          const name = typeof f === "string" ? f : f?.pattern;
          if (name) flyCounts[name] = (flyCounts[name] || 0) + 1;
        }
      }
    }
    const topFly =
      Object.entries(flyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    // Species
    const speciesSet = new Set(
      catches.map((c: any) => c.species).filter(Boolean)
    );
    const species = speciesSet.size > 0 ? [...speciesSet].join(", ") : "N/A";

    // 7. Display name
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    const displayName = profile?.display_name || "An angler";

    // Format duration
    const dur = session.duration_minutes;
    const duration = dur
      ? `${Math.floor(dur / 60)}h ${dur % 60 > 0 ? `${dur % 60}m` : ""}`
      : "Not recorded";

    // 8. Compose email
    const subject = `Fishing report from ${session.venue_name} — ${session.session_date}`;
    const body = `Hi,

${displayName} recently fished at ${session.venue_name} and logged their session on It's Catching! Here's a quick summary:

Date: ${session.session_date}
Duration: ${duration}
Fish caught: ${fishCount}
Top fly: ${topFly}
Species: ${species}

It's Catching! is a fly fishing diary and intelligence platform used by anglers across the UK. We'd love to work with ${session.venue_name} to provide your anglers with better insights and your fishery with anonymous catch-rate data.

Interested? Reply to this email to find out more.

Tight lines,
The It's Catching! Team

—
To stop receiving these emails, reply with "unsubscribe".`;

    // 9. Send via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    let status = "failed";
    let errorMessage: string | null = null;

    if (!resendKey) {
      errorMessage = "RESEND_API_KEY not configured";
      console.error(errorMessage);
    } else {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "It's Catching! <hello@itscatching.uk>",
            to: [emailTo],
            subject,
            text: body,
          }),
        });

        if (res.ok) {
          status = "sent";
        } else {
          const errBody = await res.text();
          errorMessage = `Resend ${res.status}: ${errBody}`;
          console.error("Resend error:", errorMessage);
        }
      } catch (err: any) {
        errorMessage = err.message || "Resend request failed";
        console.error("Resend exception:", err);
      }
    }

    // 10. Log outreach
    await supabase.from("venue_outreach").insert({
      venue_id,
      session_id,
      user_id: user.id,
      email_to: emailTo,
      email_source: emailSource,
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      error_message: errorMessage,
    });

    return json({ status });
  } catch (err) {
    const envResp = envErrorResponse(err, corsHeaders);
    if (envResp) return envResp;
    console.error("send-venue-report error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
