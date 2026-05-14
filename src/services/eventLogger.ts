// Lightweight client-side event log → app_events table on Supabase.
// Per prompt 145. Batches in memory, flushes every 10s and on tab unload.
// Hardened in prompt 164: re-queues on auth lapse, keepalive fetch on unload,
// writes app_version, and clears the flush interval when the queue drains.
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

// Build-time injected app version. Falls back to "dev" when unset.
const APP_VERSION: string =
  (import.meta as any).env?.VITE_APP_VERSION ??
  (import.meta as any).env?.PACKAGE_VERSION ??
  "dev";

const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

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
  let succeeded = false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Auth lapsed mid-flush. Hold the batch — token may refresh shortly.
      return;
    }
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const rows = batch.map((e) => ({
      ...e,
      user_id: user.id,
      user_agent: ua,
      app_version: APP_VERSION,
    }));
    const { error } = await supabase.from("app_events" as any).insert(rows);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[event] flush failed, re-queueing", error);
    } else {
      succeeded = true;
    }
  } finally {
    if (!succeeded) {
      // Restore the batch at the front so it's tried again on the next flush.
      queue = [...batch, ...queue];
      if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    } else if (queue.length === 0 && intervalHandle !== null && typeof window !== "undefined") {
      // Queue drained cleanly — stop the ticker until next event arrives.
      window.clearInterval(intervalHandle);
      intervalHandle = null;
    }
    flushing = false;
  }
}

async function flushBeacon(): Promise<void> {
  // Beacon-style send at unload time. navigator.sendBeacon doesn't accept
  // custom headers (Postgrest needs apikey + Authorization), so we use
  // fetch with keepalive: true — honoured by modern browsers for unload-time
  // requests up to ~64KB.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const batch = queue.splice(0);
  if (batch.length === 0) return;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  const rows = batch.map((e) => ({
    ...e,
    user_id: session.user.id,
    user_agent: ua,
    app_version: APP_VERSION,
  }));
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${session.access_token}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(rows),
      keepalive: true,
    });
  } catch {
    // Best-effort. Restore in case the tab survives.
    queue = [...batch, ...queue];
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (queue.length === 0) return;
    void flushBeacon();
  });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}

// ---- Global hooks (per prompt 200 §1) ----
let installed = false;
export function installGlobalEventHooks() {
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  // 1.1 Uncaught JS errors
  window.addEventListener("error", (e: ErrorEvent) => {
    logEvent("error.uncaught", {
      message: String(e.message ?? "").slice(0, 500),
      filename: e.filename ?? null,
      lineno: e.lineno ?? null,
      colno: e.colno ?? null,
      stack: e.error?.stack ? String(e.error.stack).slice(0, 2000) : null,
    });
  });

  // 1.2 Unhandled promise rejections
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason: any = e.reason;
    logEvent("error.unhandled_rejection", {
      message: reason?.message ? String(reason.message).slice(0, 500) : String(reason).slice(0, 500),
      stack: reason?.stack ? String(reason.stack).slice(0, 2000) : null,
    });
  });

  // 1.3 Online / offline
  window.addEventListener("online", () => logEvent("net.online", null));
  window.addEventListener("offline", () => logEvent("net.offline", null));

  // 1.4 Auth lifecycle
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        logEvent("auth.signed_in", {
          user_id: session?.user?.id ?? null,
          email: session?.user?.email ?? null,
        });
      } else if (event === "SIGNED_OUT") {
        logEvent("auth.signed_out", null);
      } else if (event === "TOKEN_REFRESHED") {
        logEvent("auth.token_refreshed", null);
      } else if (event === "USER_UPDATED") {
        logEvent("auth.user_updated", null);
      }
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[event] auth subscription failed", err);
  }

  // 1.5 App boot
  try {
    const standalone =
      (window.matchMedia?.("(display-mode: standalone)").matches) ||
      ((window.navigator as any).standalone === true);
    logEvent("app.boot", {
      url: window.location.href,
      referrer: document.referrer || null,
      standalone,
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio ?? 1 },
      language: navigator.language ?? null,
      platform: (navigator as any).userAgentData?.platform ?? navigator.platform ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[event] boot log failed", err);
  }
}

// ---- Lifecycle hooks (per prompt 201 §3.2) ----
let lifecycleInstalled = false;
export function installLifecycleLogger() {
  if (lifecycleInstalled) return;
  if (typeof document === "undefined") return;
  lifecycleInstalled = true;

  // Visibility — tracks tab-in-background which on mobile can lead to React
  // state eviction ("loses setup").
  document.addEventListener("visibilitychange", () => {
    logEvent("lifecycle.visibility", { state: document.visibilityState });
  });

  // Service worker controller change — fires when a new PWA build takes over.
  // If this happens mid-session, the app may behave inconsistently until reload.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      logEvent("lifecycle.sw_controllerchange", null);
    });
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        logEvent("lifecycle.sw_state", {
          has_registration: !!reg,
          active: !!reg?.active,
          installing: !!reg?.installing,
          waiting: !!reg?.waiting,
          scope: reg?.scope ?? null,
        });
      })
      .catch((err) => {
        logEvent("lifecycle.sw_state", {
          has_registration: false,
          error: String(err).slice(0, 200),
        });
      });
  }

  // Window focus/blur — complements visibilitychange on desktop browsers.
  window.addEventListener("focus", () => logEvent("lifecycle.focus", null));
  window.addEventListener("blur", () => logEvent("lifecycle.blur", null));
}
