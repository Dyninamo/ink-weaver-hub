/**
 * Screen Wake Lock helper.
 *
 * Holds `navigator.wakeLock.request('screen')` so the phone screen stays
 * on while a fishing session is active. The browser auto-releases the
 * sentinel when the page hides (tab switch, app background, screen lock);
 * we re-acquire on visibilitychange → visible.
 *
 * Best-effort: iOS 16.4+ supports it; older iOS / non-Chromium browsers
 * just throw or expose no API. We swallow the error and carry on — the
 * app must not crash if wake lock is unavailable.
 */

declare global {
  interface WakeLockSentinelLike extends EventTarget {
    release(): Promise<void>;
  }
}

let sentinel: WakeLockSentinelLike | null = null;
let acquireRequested = false;
let visibilityHandler: (() => void) | null = null;

export async function acquireWakeLock(): Promise<void> {
  acquireRequested = true;
  await tryAcquire();
  if (!visibilityHandler) {
    visibilityHandler = () => {
      if (
        document.visibilityState === "visible" &&
        acquireRequested &&
        !sentinel
      ) {
        void tryAcquire();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  }
}

export async function releaseWakeLock(): Promise<void> {
  acquireRequested = false;
  if (sentinel) {
    try {
      await sentinel.release();
    } catch {
      /* already released */
    }
    sentinel = null;
  }
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
}

async function tryAcquire(): Promise<void> {
  if (typeof navigator === "undefined") return;
  if (!("wakeLock" in navigator) || typeof (navigator as any).wakeLock?.request !== "function") {
    console.info("[wakeLock] not supported on this browser — continuing without");
    return;
  }
  try {
    sentinel = await (navigator as any).wakeLock.request("screen");
    sentinel?.addEventListener("release", () => {
      console.info("[wakeLock] released");
      sentinel = null;
      void import("@/services/eventLogger").then((m) => m.logEvent("lifecycle.wakelock.released", null));
    });
    console.info("[wakeLock] acquired");
    void import("@/services/eventLogger").then((m) => m.logEvent("lifecycle.wakelock.acquired", null));
  } catch (err) {
    console.warn("[wakeLock] request failed:", err);
    sentinel = null;
    void import("@/services/eventLogger").then((m) =>
      m.logEvent("lifecycle.wakelock.failed", { error: String(err).slice(0, 200) })
    );
  }
}
