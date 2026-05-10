import { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  mobile_number: string | null;
  mobile_verified: boolean;
  two_factor_enabled: boolean;
  created_at: string;
  coach_stage?: string | null;
  home_venue_id?: string | null;
  stillwater_default_species?: string | null;
  stillwater_default_rod_weight?: number | null;
  stillwater_default_line?: string | null;
  river_default_species?: string | null;
  river_default_rod_weight?: number | null;
  river_default_line?: string | null;
  confirm_delete_enabled?: boolean;
  coach_banner_dismissed?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isProfileLoading: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const { toast } = useToast();

  const isMountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);

  const refreshProfile = async () => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (error) {
        console.error("refreshProfile error:", error);
        return;
      }
      if (currentUserIdRef.current !== uid) return; // user switched mid-flight
      if (!isMountedRef.current) return;
      setProfile((data ?? null) as UserProfile | null);
    } catch (err) {
      console.error("refreshProfile failed:", err);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    const safeSetSession = (s: Session | null) => {
      if (!isMountedRef.current) return;
      setSession(s);
    };
    const safeSetUser = (u: User | null) => {
      if (!isMountedRef.current) return;
      currentUserIdRef.current = u?.id ?? null;
      setUser(u);
    };
    const safeSetProfile = (p: UserProfile | null, forUserId: string | null) => {
      if (!isMountedRef.current) return;
      // Drop writes for user IDs that aren't the current one (sign-out / switch in flight).
      if (forUserId !== null && forUserId !== currentUserIdRef.current) return;
      setProfile(p);
    };

    const loadProfileFor = async (uid: string) => {
      if (isMountedRef.current) setIsProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();
        if (error && (error as any).code !== "PGRST116") {
          console.error("Profile fetch error:", error);
          safeSetProfile(null, uid);
          return;
        }
        if (!data) {
          // Profile doesn't exist — create it.
          const { data: newProfile, error: createError } = await supabase
            .from("user_profiles")
            .insert({ id: uid })
            .select()
            .single();
          if (createError) {
            console.error("Error creating profile:", createError);
            safeSetProfile(null, uid);
          } else {
            safeSetProfile(newProfile as UserProfile, uid);
          }
        } else {
          safeSetProfile(data as UserProfile, uid);
        }
      } catch (err) {
        console.error("Unexpected profile fetch error:", err);
        safeSetProfile(null, uid);
      } finally {
        if (isMountedRef.current) setIsProfileLoading(false);
      }
    };

    // Initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Error getting session:", error);
          safeSetSession(null);
          safeSetUser(null);
        } else {
          safeSetSession(currentSession);
          safeSetUser(currentSession?.user ?? null);
          if (currentSession?.user) {
            await loadProfileFor(currentSession.user.id);
          }
        }
      } catch (error) {
        console.error("Unexpected error during auth initialization:", error);
        safeSetSession(null);
        safeSetUser(null);
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };

    void initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log("Auth state changed:", event);

        safeSetSession(currentSession);
        safeSetUser(currentSession?.user ?? null);

        if (currentSession?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          void loadProfileFor(currentSession.user.id);
        }

        switch (event) {
          case "SIGNED_IN":
            console.log("User signed in");
            break;
          case "SIGNED_OUT":
            console.log("User signed out");
            safeSetSession(null);
            safeSetUser(null);
            safeSetProfile(null, null);
            break;
          case "TOKEN_REFRESHED":
            console.log("Token refreshed successfully");
            break;
          case "USER_UPDATED":
            console.log("User updated");
            break;
          case "PASSWORD_RECOVERY":
            console.log("Password recovery initiated");
            break;
        }

        if (event === "SIGNED_OUT" && !currentSession) {
          toast({
            title: "Session expired",
            description: "Your session has expired. Please sign in again.",
            variant: "destructive",
          });
        }
      }
    );

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [toast]);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
        toast({
          title: "Error signing out",
          description: "There was a problem signing out. Please try again.",
          variant: "destructive",
        });
      } else {
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
        toast({
          title: "Signed out",
          description: "You have been signed out successfully.",
        });
      }
    } catch (error) {
      console.error("Unexpected sign out error:", error);
      currentUserIdRef.current = null;
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const value = {
    user,
    session,
    profile,
    isLoading,
    isProfileLoading,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
