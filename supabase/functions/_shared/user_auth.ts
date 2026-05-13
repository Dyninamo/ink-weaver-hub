/**
 * Per prompt 190 (phase 1): shared Bearer-JWT user auth gate for
 * PWA-callable edge functions. Returns the authed user or a 401 Response.
 *
 * Usage:
 *   const auth = await requireUser(req);
 *   if (auth.error) return auth.error;
 *   const user = auth.user;
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireEnv } from "./env.ts";

export interface UserAuthOk {
  user: { id: string; email?: string };
  error?: undefined;
}
export interface UserAuthErr {
  user?: undefined;
  error: Response;
}

export async function requireUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<UserAuthOk | UserAuthErr> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      error: new Response(
        JSON.stringify({ error: "Missing bearer token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  const userClient = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    return {
      error: new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  return { user: { id: data.user.id, email: data.user.email ?? undefined } };
}

export function forbiddenResponse(
  message: string,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
