// Submit a venue return — generates an email summary of a session,
// sends it to the venue's return_email via Resend, and writes the snapshot
// back to fishing_sessions (reported_at, reported_to_email, reported_body_snapshot).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Body {
  session_id: string;
  venue_id?: string;
  angler_name?: string;
  membership_no?: string;
  include_gps?: boolean;
  note?: string;
}

function fmtTime(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (!body.session_id) return json({ error: "session_id required" }, 400);

    // Load session (must belong to caller)
    const { data: session, error: sessErr } = await supabase
      .from("fishing_sessions")
      .select("*")
      .eq("id", body.session_id)
      .eq("user_id", user.id)
      .single();

    if (sessErr || !session) return json({ error: "Session not found" }, 404);

    if (session.reported_at) {
      return json({ status: "already_reported" });
    }

    // Resolve venue + return_email
    let venueId = body.venue_id ?? null;
    let returnEmail: string | null = null;
    let venueName: string = session.venue_name;

    if (!venueId && session.venue_name) {
      const { data: v } = await supabase
        .from("venues_new")
        .select("venue_id, name, return_email")
        .ilike("name", session.venue_name)
        .limit(1)
        .maybeSingle();
      if (v) {
        venueId = v.venue_id;
        venueName = v.name;
        returnEmail = v.return_email;
      }
    } else if (venueId) {
      const { data: v } = await supabase
        .from("venues_new")
        .select("name, return_email")
        .eq("venue_id", venueId)
        .single();
      if (v) {
        venueName = v.name;
        returnEmail = v.return_email;
      }
    }

    if (!returnEmail) return json({ status: "no_return_email" });

    // Load events
    const { data: events } = await supabase
      .from("session_events")
      .select("*")
      .eq("session_id", body.session_id)
      .order("event_time", { ascending: true });

    const allEvents = events ?? [];
    const catches = allEvents.filter((e: any) => e.event_type === "catch");
    const blanks = allEvents.filter((e: any) => e.event_type === "blank");

    const includeGps = body.include_gps !== false;

    // Build catch rows
    const catchRowsHtml = catches
      .map((c: any) => {
        const weight = c.weight_display || c.weight_lb ? `${c.weight_lb ?? ""}lb ${c.weight_oz ?? 0}oz` : "—";
        const gps =
          includeGps && c.latitude && c.longitude
            ? ` <span style="color:#888;font-size:11px;">(${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)})</span>`
            : "";
        return `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;">${fmtTime(c.event_time)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(c.species ?? "—")}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(weight)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(c.fly_pattern ?? "—")}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(c.spot ?? "—")}${gps}</td>
        </tr>`;
      })
      .join("");

    // Areas aggregate (spot · fish count · approx time band)
    const spotMap = new Map<string, { catches: number; blanks: number; first?: string; last?: string }>();
    for (const e of allEvents) {
      const spot = (e as any).spot ?? "Unspecified";
      const entry = spotMap.get(spot) ?? { catches: 0, blanks: 0 };
      if ((e as any).event_type === "catch") entry.catches += 1;
      if ((e as any).event_type === "blank") entry.blanks += 1;
      if (!entry.first) entry.first = (e as any).event_time;
      entry.last = (e as any).event_time;
      spotMap.set(spot, entry);
    }
    const areaRowsHtml = Array.from(spotMap.entries())
      .map(([spot, info]) => {
        const time =
          info.first && info.last
            ? `${fmtTime(info.first)}–${fmtTime(info.last)}`
            : "—";
        return `<tr>
          <td style="padding:4px 8px;">${escapeHtml(spot)}</td>
          <td style="padding:4px 8px;">${info.catches} fish · ${info.blanks} blank${info.blanks === 1 ? "" : "s"}</td>
          <td style="padding:4px 8px;color:#666;">${time}</td>
        </tr>`;
      })
      .join("");

    const anglerName = body.angler_name?.trim() || session.angler_name || "An angler";
    const membership = body.membership_no?.trim();
    const noteHtml = body.note?.trim()
      ? `<p style="background:#fef9e7;padding:10px 12px;border-left:3px solid #d4a017;margin:16px 0;">${escapeHtml(body.note.trim())}</p>`
      : "";

    const subject = `Session return — ${anglerName} at ${venueName} (${session.session_date})`;

    const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="margin:0 0 4px;color:#1a1a1a;">Session return</h2>
  <p style="margin:0 0 16px;color:#666;font-size:13px;">
    ${escapeHtml(anglerName)}${membership ? ` · Member #${escapeHtml(membership)}` : ""}<br/>
    ${escapeHtml(venueName)} · ${session.session_date}${session.duration_minutes ? ` · ${Math.round(session.duration_minutes / 60 * 10) / 10}h` : ""}
  </p>

  <h3 style="margin:20px 0 8px;font-size:15px;">Catches (${catches.length})</h3>
  ${
    catches.length === 0
      ? '<p style="color:#888;">No fish recorded.</p>'
      : `<table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f5f5f5;">
            <th style="padding:6px 8px;text-align:left;">Time</th>
            <th style="padding:6px 8px;text-align:left;">Species</th>
            <th style="padding:6px 8px;text-align:left;">Weight</th>
            <th style="padding:6px 8px;text-align:left;">Fly</th>
            <th style="padding:6px 8px;text-align:left;">Spot</th>
          </tr></thead>
          <tbody>${catchRowsHtml}</tbody>
        </table>`
  }

  <h3 style="margin:20px 0 8px;font-size:15px;">Areas fished</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <tbody>${areaRowsHtml || '<tr><td style="color:#888;padding:4px 8px;">—</td></tr>'}</tbody>
  </table>

  ${noteHtml}

  <p style="margin-top:24px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px;">
    Sent via It's Catching · ${includeGps ? "GPS coordinates included" : "GPS coordinates withheld"}<br/>
    Private notes, retrieve style and voice transcripts are not shared.
  </p>
</body></html>`;

    // Send via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "RESEND_API_KEY not configured" }, 500);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "It's Catching <returns@itscatching.uk>",
        to: [returnEmail],
        subject,
        html,
        reply_to: user.email ?? undefined,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend failed:", errText);
      return json({ status: "failed", error: errText }, 502);
    }

    // Write back snapshot
    const { error: updErr } = await supabase
      .from("fishing_sessions")
      .update({
        reported_at: new Date().toISOString(),
        reported_to_email: returnEmail,
        reported_body_snapshot: html,
        reported_include_gps: includeGps,
      })
      .eq("id", body.session_id)
      .eq("user_id", user.id);

    if (updErr) {
      console.error("Failed to write snapshot:", updErr);
      return json({ status: "sent_no_snapshot", error: updErr.message }, 200);
    }

    return json({ status: "sent", to: returnEmail });
  } catch (err: any) {
    console.error("submit-venue-return error:", err);
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
});
