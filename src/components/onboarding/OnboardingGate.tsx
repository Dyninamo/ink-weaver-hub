import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

interface OnboardingGateProps {
  children: React.ReactNode;
}

/**
 * Shows the first-time onboarding wizard when the authenticated user has
 * coach_stage !== 'done'. Profile is loaded by AuthContext.
 */
const OnboardingGate = ({ children }: OnboardingGateProps) => {
  const { user, profile } = useAuth();
  const [completedThisSession, setCompletedThisSession] = useState(false);

  // Wait for the FIRST profile load before deciding. Subsequent refreshes
  // (e.g. after the wizard saves a step) must NOT unmount the wizard, or its
  // local step state resets and the user gets stuck on step 1.
  if (!user) return <>{children}</>;
  if (!profile) return null;

  // Only show wizard for brand-new users; 'started' and 'done' skip it.
  // (After the wizard, profile transitions to 'started' and the in-diary
  // CoachBanner takes over for the first-session prompt.)
  const stage = profile.coach_stage ?? "new";
  const needsOnboarding =
    !completedThisSession && (stage === "new" || stage === "onboarding");

  if (needsOnboarding) {
    return <OnboardingWizard onComplete={() => setCompletedThisSession(true)} />;
  }

  return <>{children}</>;
};

export default OnboardingGate;
