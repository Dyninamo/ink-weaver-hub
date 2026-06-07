// Prompt 238 — Stop the offline auth-refresh retry storm.
//
// supabase-js's autoRefreshToken timer fires `/auth/v1/user` blindly. When
// the device is offline (or auth returns 5xx), the client hammers the
// endpoint with no back-off and no offline guard — wasting battery, network
// and log volume. This module:
//   1. Pauses the auto-refresh timer on `offline`.
//   2. On `online`, fires ONE refresh, then resumes normal cadence.
//   3. On refresh failure (network/5xx), backs off with jitter (cap 60s)
//      and never tight-loops. Resets on success.
//   4. Never signs the user out on transient 5xx / network errors —
//      supabase-js only clears the session on 401/invalid_grant.
//
// Wire-up: call `installAuthRefreshGuard()` once from `main.tsx` (idempotent).

import { supabase } from "@/integrations/supabase/client";

const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 60_000;

let installed = false;
let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function clearRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleBackoff() {
  clearRetry();
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
  const jitter = Math.random() * (exp * 0.25);
  const wait = exp + jitter;
  attempt += 1;
  retryTimer = setTimeout(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      // Still offline — wait for the `online` event instead.
      return;
    }
    void tryRefresh();
  }, wait);
}

async function tryRefresh(): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return; // offline guard
  }
  try {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      // Don't sign out on transient errors. supabase-js itself only clears
      // the session on real 401/invalid_grant. Treat anything else as retryable.
      const msg = (error.message || "").toLowerCase();
      const isAuthFailure = msg.includes("invalid") || (error as any).status === 401;
      if (!isAuthFailure) {
        scheduleBackoff();
      } else {
        // genuine auth failure — let supabase-js's own listener handle SIGNED_OUT
        attempt = 0;
      }
      return;
    }
    attempt = 0;
    clearRetry();
  } catch {
    // network error — back off.
    scheduleBackoff();
  }
}

export function installAuthRefreshGuard(): void {
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  const onOffline = () => {
    clearRetry();
    attempt = 0;
    try {
      supabase.auth.stopAutoRefresh();
    } catch {
      /* noop */
    }
  };

  const onOnline = () => {
    try {
      supabase.auth.startAutoRefresh();
    } catch {
      /* noop */
    }
    // Fire one immediate guarded refresh.
    void tryRefresh();
  };

  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);

  // Reset back-off on successful supabase-driven refreshes.
  supabase.auth.onAuthStateChange((event) => {
    if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
      attempt = 0;
      clearRetry();
    }
  });

  // Initial state — if we boot offline, pause immediately.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    onOffline();
  }
}
