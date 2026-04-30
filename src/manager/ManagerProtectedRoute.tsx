import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ManagerProtectedRouteProps {
  children: ReactNode;
}

export default function ManagerProtectedRoute({ children }: ManagerProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      const redirectTo = `${location.pathname}${location.search}`;
      navigate(`/auth?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
    }
  }, [user, isLoading, navigate, location.pathname, location.search]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }
  return <>{children}</>;
}
