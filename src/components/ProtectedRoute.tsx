import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import DisplayNameGate from "@/components/DisplayNameGate";
import OnboardingGate from "@/components/onboarding/OnboardingGate";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireDisplayName?: boolean;
}

const ProtectedRoute = ({ children, requireDisplayName = false }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        const redirectTo = `${location.pathname}${location.search}`;
        navigate(`/auth?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
      } else {
        setShouldRender(true);
      }
    }
  }, [user, isLoading, navigate, location.pathname, location.search]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!shouldRender || !user) {
    return null;
  }

  // Onboarding gate runs first — collects display name + defaults + home water.
  // requireDisplayName remains as a stricter fallback for legacy paths.
  const inner = requireDisplayName ? <DisplayNameGate>{children}</DisplayNameGate> : <>{children}</>;
  return <OnboardingGate>{inner}</OnboardingGate>;
};

export default ProtectedRoute;


