// Per prompt 201 §3.1: capture button/link clicks at the document level so we
// know what the user was tapping right before "got lost". One listener, no
// per-component instrumentation.
import { logEvent } from "./eventLogger";

let installed = false;

export function installGlobalClickLogger() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element | null;
      if (!target) return;
      const clickable = target.closest(
        'button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], input[type="submit"], input[type="button"]'
      ) as HTMLElement | null;
      if (!clickable) return;

      const aria = clickable.getAttribute("aria-label");
      const testid = clickable.getAttribute("data-testid");
      const text = (clickable.textContent || "").trim().replace(/\s+/g, " ");
      const label = (aria || text || testid || "").slice(0, 60);
      if (!label && !testid) return;

      logEvent("ui.click", {
        label: label || null,
        testid: testid || null,
        tag: clickable.tagName.toLowerCase(),
        href: (clickable as HTMLAnchorElement).href
          ? (clickable as HTMLAnchorElement).href.slice(-80)
          : null,
        disabled: (clickable as HTMLButtonElement).disabled || null,
      });
    },
    { capture: true, passive: true }
  );
}
