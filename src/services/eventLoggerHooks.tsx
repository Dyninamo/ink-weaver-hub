// Route-change logger. Lives inside <BrowserRouter> so it can read useLocation().
// Per prompt 200 §1.7.
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { logEvent } from "./eventLogger";

export default function EventLoggerHooks() {
  const loc = useLocation();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const path = loc.pathname + (loc.search || "");
    if (prev.current === null) {
      prev.current = path;
      return;
    }
    if (prev.current !== path) {
      logEvent("route.changed", { from: prev.current, to: path });
      prev.current = path;
    }
  }, [loc.pathname, loc.search]);
  return null;
}
