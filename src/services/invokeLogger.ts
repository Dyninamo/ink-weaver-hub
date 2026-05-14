// Per prompt 201 §3.3: wrap supabase.functions.invoke so every call's outcome
// shows up in app_events. Kept in its own file because client.ts is auto-generated
// and must not be edited.
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "./eventLogger";

let installed = false;

export function installInvokeLogger() {
  if (installed) return;
  installed = true;

  const originalInvoke = supabase.functions.invoke.bind(supabase.functions);
  (supabase.functions as any).invoke = async function loggedInvoke(name: string, opts?: any) {
    const t0 = performance.now();
    try {
      const result = await originalInvoke(name as any, opts);
      const ms = Math.round(performance.now() - t0);
      if ((result as any)?.error) {
        logEvent("fn.invoke.err", {
          fn: name,
          ms,
          error: String((result as any).error.message ?? (result as any).error).slice(0, 300),
        });
      } else {
        logEvent("fn.invoke.ok", { fn: name, ms });
      }
      return result;
    } catch (err) {
      const ms = Math.round(performance.now() - t0);
      logEvent("fn.invoke.threw", {
        fn: name,
        ms,
        error: String((err as Error)?.message ?? err).slice(0, 300),
      });
      throw err;
    }
  };
}
