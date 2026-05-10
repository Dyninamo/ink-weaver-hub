/**
 * Edge function env helpers.
 *
 * `requireEnv(name)` reads a Deno.env var and throws if missing. Use it for
 * any secret that the function depends on (service-role key, third-party
 * API keys). Failing fast at function entry beats producing mysterious empty
 * results from silently-downgraded queries.
 */

export class MissingEnvError extends Error {
  constructor(public name: string) {
    super(`Required environment variable not set: ${name}`);
    this.name = "MissingEnvError";
  }
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim() === "") {
    throw new MissingEnvError(name);
  }
  return value;
}

/** Returns a JSON Response with the error wrapped, or null if not a MissingEnvError. */
export function envErrorResponse(
  err: unknown,
  corsHeaders: Record<string, string>,
): Response | null {
  if (err instanceof MissingEnvError) {
    console.error(`[env] missing required secret: ${err.name}`);
    return new Response(
      JSON.stringify({
        error: "service_misconfigured",
        message: `This deployment is missing the required ${err.name} secret.`,
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  return null;
}
