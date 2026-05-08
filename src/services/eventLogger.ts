// Lightweight client-side event log → app_events table on Supabase.
// Per prompt 145. Batches in memory, flushes every 10s and on tab unload.
import { supabase } from "@/integrations/supabase/client";

interface AppEvent {
  client_time: string;
  route: string | null;
  event_type: string;
  payload: any;
  session_id?: string | null;
}

const BATCH_SIZE = 5;
const FLUSH_INTERVAL_MS = 10_000;
const MAX_QUEUE = 500;

let queue: AppEvent[] = [];
let flushing = false;
let intervalHandle: number | null = null;

function getRoute(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.pathname || null;
}

export function logEvent(event_type: string, payload?: any, session_id?: string | null) {
  queue.push({
    client_time: new Date().toISOString(),
    route: getRoute(),
    event_type,
    payload: payload ?? null,
    session_id: session_id ?? null,
  });
  // Bounded memory in case of network outage.
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[event]", event_type, payload ?? "");
  }

  if (queue.length >= BATCH_SIZE) {
    void flush();
  } else if (intervalHandle === null && typeof window !== "undefined") {
    intervalHandle = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  }
}

export async function flush() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Drop events for unauthenticated users — RLS would reject them anyway.
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const rows = batch.map((e) => ({ ...e, user_id: user.id, user_agent: ua }));
    const { error } = await supabase.from("app_events" as any).insert(rows);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[event] flush failed, re-queueing", error);
      queue.unshift(...batch);
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => { void flush(); });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}
