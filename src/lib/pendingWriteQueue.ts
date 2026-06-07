// Prompt 235 Part B — durable queue for in-session event writes that failed
// while offline (or with a transient network error). Backed by localStorage
// (small payloads, persists across reloads, no extra dep). Idempotency is
// enforced server-side via the `client_event_id` UUID + unique index added
// in the same migration.
import { supabase } from "@/integrations/supabase/client";

const KEY = "diary.pending_events.v1";

export interface PendingEvent {
  client_event_id: string;
  session_id: string;
  payload: Record<string, unknown>;
  queued_at: string;        // ISO
  attempts: number;
  last_error?: string | null;
}

function read(): PendingEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function write(items: PendingEvent[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* quota */ }
}

export function listPending(sessionId?: string): PendingEvent[] {
  const all = read();
  return sessionId ? all.filter((p) => p.session_id === sessionId) : all;
}

export function pendingCount(sessionId?: string): number {
  return listPending(sessionId).length;
}

export function enqueue(p: Omit<PendingEvent, "queued_at" | "attempts">) {
  const items = read();
  // Dedupe by client_event_id.
  if (items.some((it) => it.client_event_id === p.client_event_id)) return;
  items.push({ ...p, queued_at: new Date().toISOString(), attempts: 0 });
  write(items);
  notify();
}

export function remove(client_event_id: string) {
  write(read().filter((it) => it.client_event_id !== client_event_id));
  notify();
}

const LISTENERS = new Set<() => void>();
export function onChange(cb: () => void): () => void {
  LISTENERS.add(cb);
  return () => { LISTENERS.delete(cb); };
}
function notify() { LISTENERS.forEach((l) => { try { l(); } catch {} }); }

let flushing = false;
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  if (flushing) return { ok: 0, failed: 0 };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: 0, failed: 0 };
  }
  flushing = true;
  let ok = 0;
  let failed = 0;
  try {
    const items = read();
    for (const item of items) {
      try {
        // Upsert on client_event_id so a partial-success retry can't duplicate.
        const { error } = await supabase
          .from("session_events")
          .upsert(item.payload as any, { onConflict: "client_event_id" });
        if (error) throw error;
        remove(item.client_event_id);
        ok += 1;
      } catch (err: any) {
        item.attempts += 1;
        item.last_error = err?.message ?? String(err);
        // Persist updated attempts/last_error.
        write(read().map((it) => it.client_event_id === item.client_event_id ? item : it));
        failed += 1;
        // Stop flushing on first network failure — likely all will fail.
        if (/Failed to fetch|NetworkError|ERR_/i.test(item.last_error ?? "")) break;
      }
    }
  } finally {
    flushing = false;
  }
  return { ok, failed };
}

// One-shot listener install — called from app shell.
let installed = false;
export function installAutoFlush() {
  if (installed) return;
  installed = true;
  if (typeof window === "undefined") return;
  const trigger = () => { void flushQueue(); };
  window.addEventListener("online", trigger);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") trigger();
  });
}
