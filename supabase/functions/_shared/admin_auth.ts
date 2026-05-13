/**
 * Per prompt 194 (phase 2): dual-path admin gate for back-office /
 * AI-bill / heavy-aggregation edge functions.
 *
 * Accepts EITHER:
 *   1. X-Admin-Secret: <secret>  matching ADMIN_API_SECRET env var
 *   2. Bearer JWT belonging to an email in ADMIN_EMAILS
 *
 * Usage:
 *   const auth = await requireAdmin(req);
 *   if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }),
 *     { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "./env.ts";

// Admins identified by email. Keep this list tiny — currently just Nick.
const ADMIN_EMAILS = new Set<string>([
  "nick.dyne@gmail.com",
]);

export type AdminAuthOk = { ok: true; via: "secret" | "user"; user?: { id: string; email: string } };
export type AdminAuthErr = { ok: false; status: 401 | 403; error: string };
export type AdminAuthResult = AdminAuthOk | AdminAuthErr;

export async function requireAdmin(req: Request): Promise<AdminAuthResult> {
  // Path 1: shared secret
  const secret = req.headers.get("x-admin-secret");
  if (secret) {
    const expected = Deno.env.get("ADMIN_API_SECRET");
    if (!expected) {
      return { ok: false, status: 401, error: "ADMIN_API_SECRET not configured" };
    }
    if (secret === expected) {
      return { ok: true, via: "secret" };
    }
    return { ok: false, status: 401, error: "Invalid admin secret" };
  }

  // Path 2: user JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing admin credentials (X-Admin-Secret or Bearer token)" };
  }
  const userClient: SupabaseClient = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData.user) {
    return { ok: false, status: 401, error: "Invalid Bearer token" };
  }
  const email = userData.user.email ?? "";
  if (!ADMIN_EMAILS.has(email.toLowerCase())) {
    return { ok: false, status: 403, error: "Not an admin" };
  }
  return { ok: true, via: "user", user: { id: userData.user.id, email } };
}
