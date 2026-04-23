import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * B5 — first-session coach banner.
 *
 * Visible only when `profile.coach_stage === 'started'` (set on B4 of the
 * onboarding wizard). "Got it" writes `coach_stage = 'done'`, which hides
 * the banner permanently. Also respects the legacy `coach_banner_dismissed`
 * flag so anyone who already dismissed never sees it again.
 */
export default function CoachBanner() {
  const { user, profile, refreshProfile } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  if (!user || !profile) return null;
  if (profile.coach_banner_dismissed) return null;
  if (profile.coach_stage !== "started") return null;

  async function dismiss() {
    if (!user) return;
    setDismissing(true);
    await supabase
      .from("user_profiles")
      .update({
        coach_stage: "done",
        coach_banner_dismissed: true,
      })
      .eq("id", user.id);
    await refreshProfile();
    setDismissing(false);
  }

  return (
    <>
      <div className="coach-banner">
        <div className="coach-banner-label">How your first session runs</div>
        <ol className="coach-banner-list">
          <li>
            <strong>Setup</strong> — rod, line, leader, style, droppers, flies.
          </li>
          <li>
            <strong>Log as you fish</strong> — Catch · Lost · Blank · Change.
          </li>
          <li>
            <strong>End session</strong> — red pill at the bottom, always there.
          </li>
        </ol>
        <div className="coach-banner-foot">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="coach-banner-link"
          >
            How defaults work ›
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={dismissing}
            className="coach-banner-cta"
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
