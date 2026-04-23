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
  const { user, profile, isProfileLoading } = useAuth();
  const [completedThisSession, setCompletedThisSession] = useState(false);

  // Wait for profile to load before deciding
  if (!user) return <>{children}</>;
  if (isProfileLoading || !profile) return null;

  const needsOnboarding =
    !completedThisSession && profile.coach_stage !== "done";

  if (needsOnboarding) {
    return <OnboardingWizard onComplete={() => setCompletedThisSession(true)} />;
  }

  return <>{children}</>;
};

export default OnboardingGate;
