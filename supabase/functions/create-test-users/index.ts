import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process sequentially to avoid rate limits
    for (const [name, entry] of Object.entries(body) as [string, { user_id: string; alias: string; email: string }][]) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        id: entry.user_id,
        email: entry.email,
        password: "testpass123",
        email_confirm: true,
        user_metadata: {
          display_name: entry.alias,
          is_test_user: true,
        },
      });

      if (error) {
        failed++;
        errors.push(`${name} (${entry.email}): ${error.message}`);
        console.error(`Failed to create user ${name}:`, error.message);
      } else {
        created++;
        console.log(`Created user ${name} with id ${data.user.id}`);
      }

      // Small delay to avoid hammering the auth API
      await new Promise((r) => setTimeout(r, 100));
    }

    return new Response(
      JSON.stringify({ created, failed, errors }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
