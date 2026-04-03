import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CONTACT_PATHS = ["/contact", "/contact-us", "/about", "/about-us"];
const SKIP_PREFIXES = ["noreply", "no-reply", "webmaster", "admin", "postmaster", "info@example"];
const SKIP_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ico)$/i;
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function isGeneric(email: string): boolean {
  const local = email.split("@")[0].toLowerCase();
  return SKIP_PREFIXES.some((p) => local.startsWith(p));
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ItsCatching/1.0 (venue-contact-lookup)" },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractEmails(html: string): string[] {
  // mailto links first
  const mailtoRe = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  const mailtos = [...html.matchAll(mailtoRe)].map((m) => m[1].toLowerCase());
  const regex = [...html.matchAll(EMAIL_RE)].map((m) => m[0].toLowerCase());
  const all = [...new Set([...mailtos, ...regex])];
  return all.filter((e) => !SKIP_EXTENSIONS.test(e));
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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { venue_id, session_id } = await req.json();
    if (!venue_id || !session_id) {
      return new Response(
        JSON.stringify({ error: "venue_id and session_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check if venue already has a contact email
    const { data: venue } = await supabase
      .from("venues_new")
      .select("venue_id, contact_email, root_url")
      .eq("venue_id", venue_id)
      .single();

    if (!venue) {
      return new Response(
        JSON.stringify({ status: "not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (venue.contact_email) {
      return new Response(
        JSON.stringify({ status: "cached", email: venue.contact_email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. No website URL
    if (!venue.root_url) {
      return new Response(
        JSON.stringify({ status: "no_website" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check for recent search (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: recent } = await supabase
      .from("venue_email_searches")
      .select("*")
      .eq("venue_id", venue_id)
      .gte("searched_at", thirtyDaysAgo)
      .order("searched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      return new Response(
        JSON.stringify({
          status: recent.status === "found" ? "cached" : recent.status,
          email: recent.email_found,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Insert search record
    const { data: search } = await supabase
      .from("venue_email_searches")
      .insert({
        venue_id,
        session_id,
        status: "searching",
        root_url: venue.root_url,
      })
      .select("search_id")
      .single();

    const searchId = search?.search_id;

    // 5-8. Scrape pages
    const rootUrl = venue.root_url.replace(/\/$/, "");
    const urls = [rootUrl, ...CONTACT_PATHS.map((p) => rootUrl + p)];
    const allEmails: string[] = [];

    for (const url of urls) {
      const html = await fetchPage(url);
      if (html) {
        allEmails.push(...extractEmails(html));
      }
    }

    const unique = [...new Set(allEmails)];

    // 9. Prefer non-generic
    const nonGeneric = unique.filter((e) => !isGeneric(e));
    const bestEmail = nonGeneric[0] || unique[0] || null;

    // 10-11. Update records
    if (bestEmail) {
      await supabase
        .from("venues_new")
        .update({ contact_email: bestEmail, contact_email_source: "scraped" })
        .eq("venue_id", venue_id);

      if (searchId) {
        await supabase
          .from("venue_email_searches")
          .update({ status: "found", email_found: bestEmail, completed_at: new Date().toISOString() })
          .eq("search_id", searchId);
      }

      return new Response(
        JSON.stringify({ status: "found", email: bestEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      if (searchId) {
        await supabase
          .from("venue_email_searches")
          .update({ status: "not_found", completed_at: new Date().toISOString() })
          .eq("search_id", searchId);
      }

      return new Response(
        JSON.stringify({ status: "not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("find-venue-email error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
