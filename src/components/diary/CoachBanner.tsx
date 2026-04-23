import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { X } from "lucide-react";

/**
 * B5 — first-session coach banner. Renders only when:
 *  - profile.coach_banner_dismissed is false (or undefined)
 * Shows three numbered steps + "How defaults work" link → Help sheet.
 * "Got it" dismisses and writes coach_banner_dismissed = true.
 */
export default function CoachBanner() {
  const { user, profile, refreshProfile } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  // Hide once dismissed or profile not loaded
  if (!user || !profile || profile.coach_banner_dismissed) return null;

  async function dismiss() {
    if (!user) return;
    setDismissing(true);
    await supabase
      .from("user_profiles")
      .update({ coach_banner_dismissed: true })
      .eq("id", user.id);
    await refreshProfile();
    setDismissing(false);
  }

  return (
    <>
      <div className="rounded-xl bg-foreground text-background p-4 mx-3 mt-3 mb-1 relative shadow-md">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 p-1 opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-sm font-semibold mb-3 pr-6">First time? Here's the loop.</h3>

        <ol className="space-y-2 text-[13px] leading-snug">
          <Step n={1} label="Setup" sub="Confirm rod, line, fly." />
          <Step n={2} label="Log as you fish" sub="Catch, lost, blank — quick taps." />
          <Step n={3} label="End session" sub="Review and submit a return if needed." />
        </ol>

        <div className="flex items-center justify-between mt-4 gap-2">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="text-[12px] italic text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
          >
            How defaults work ›
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={dismissing}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-background/15 hover:bg-background/25 transition-colors"
          >
            {dismissing ? "…" : "Got it"}
          </button>
        </div>
      </div>

      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>How defaults work</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              You set a default species, rod weight, and usual line for both
              stillwater and river during sign-up. When you start a new
              session, we pre-fill the wizard with the defaults that match the
              water type you choose.
            </p>
            <p>
              Anything you change in the wizard only affects that session — it
              doesn't overwrite your defaults. To update them permanently,
              head to <strong>Settings → Defaults</strong>.
            </p>
            <p>
              If you skipped a default, the wizard will ask each time until
              you fill it in.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Step({ n, label, sub }: { n: number; label: string; sub: string }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex-none h-5 w-5 rounded-full bg-background/20 text-background flex items-center justify-center text-[11px] font-semibold">
        {n}
      </span>
      <span className="flex-1">
        <strong className="font-semibold">{label}</strong>
        <span className="opacity-75"> — {sub}</span>
      </span>
    </li>
  );
}
