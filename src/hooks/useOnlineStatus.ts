// Prompt 235 — connectivity hook. Drives the offline indicator and the
// queue flush on reconnect.
import { useEffect, useState } from "react";

function readOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => readOnline());
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function isOfflineNow(): boolean {
  return !readOnline();
}

// Best-effort network/offline detection from a thrown error or PostgrestError.
// Used by save handlers to switch toast copy + arm the queue.
export function isOfflineError(err: unknown): boolean {
  if (isOfflineNow()) return true;
  const msg = (err as any)?.message ?? String(err ?? "");
  return /Failed to fetch|NetworkError|Network request failed|ERR_INTERNET_DISCONNECTED|ERR_NETWORK/i.test(msg);
}
