import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONFLICT_MAP: Record<string, string> = {
  ref_flies: "pattern_name",
  ref_lines: "line_type_code",
  ref_retrieves: "retrieve_name",
  ref_rigs: "rig_name",
  ref_hook_sizes: "hook_size",
  ref_colours: "colour",
  ref_depths: "depth_label",
  ref_lines_from_reports: "line_type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { table_name, records } = await req.json();

    if (!table_name || !CONFLICT_MAP[table_name]) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid table_name: ${table_name}. Must be one of: ${Object.keys(CONFLICT_MAP).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "records must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from(table_name)
      .upsert(records, { onConflict: CONFLICT_MAP[table_name] })
      .select();

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, count: data?.length ?? records.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
