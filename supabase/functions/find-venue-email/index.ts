import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv, envErrorResponse } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CONTACT_PATHS = ["/contact", "/contact-us", "/about", "/about-us"];
const SKIP_PREFIXES = ["noreply", "no-reply", "webmaster", "admin", "postmaster", "info@example"];
const SKIP_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ico)$/i;
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Block fetches against private / link-local / loopback IPs so a hostile
// or compromised admin write to venues_new.root_url can't point the
// scraper at internal infra (cloud metadata, RFC1918 hosts, etc.).
function isPublicHttpUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `protocol ${url.protocol} not allowed` };
  }
  const host = url.hostname.toLowerCase();
  const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal", "metadata"]);
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: `hostname ${host} blocked` };
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return { ok: false, reason: "private IPv4 (10/8)" };
    if (a === 127) return { ok: false, reason: "loopback IPv4" };
    if (a === 169 && b === 254) return { ok: false, reason: "link-local IPv4" };
    if (a === 172 && b >= 16 && b <= 31) return { ok: false, reason: "private IPv4 (172.16/12)" };
    if (a === 192 && b === 168) return { ok: false, reason: "private IPv4 (192.168/16)" };
    if (a === 0) return { ok: false, reason: "0/8" };
    if (a >= 224) return { ok: false, reason: "multicast/reserved" };
  }
  if (host.includes(":")) {
    return { ok: false, reason: "IPv6 not allowed" };
  }
  return { ok: true, url };
}

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
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
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

    // 5-8. Scrape pages — guard against SSRF via root_url (per prompt 196).
    const cleanedRoot = venue.root_url.replace(/\/$/, "");
    const rootCheck = isPublicHttpUrl(cleanedRoot);
    if (!rootCheck.ok) {
      if (searchId) {
        await supabase
          .from("venue_email_searches")
          .update({
            status: "not_found",
            completed_at: new Date().toISOString(),
          })
          .eq("search_id", searchId);
      }
      return new Response(
        JSON.stringify({ status: "not_found", error: `root_url blocked: ${rootCheck.reason}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const rootUrl = cleanedRoot;
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
    const envResp = envErrorResponse(err, corsHeaders);
    if (envResp) return envResp;
    console.error("find-venue-email error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
