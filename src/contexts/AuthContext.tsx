import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  mobile_number: string | null;
  mobile_verified: boolean;
  two_factor_enabled: boolean;
  created_at: string;
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

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    setIsProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Profile doesn't exist, create it
          console.log("Profile not found, creating...");
          const { data: newProfile, error: createError } = await supabase
            .from("user_profiles")
            .insert({ id: userId })
            .select()
            .single();

          if (createError) {
            console.error("Error creating profile:", createError);
          } else {
            setProfile(newProfile);
          }
        } else {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error("Unexpected error fetching profile:", error);
    } finally {
      setIsProfileLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          setSession(null);
          setUser(null);
        } else {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          
          // Fetch profile if user exists
          if (currentSession?.user) {
            await fetchProfile(currentSession.user.id);
          }
        }
      } catch (error) {
        console.error("Unexpected error during auth initialization:", error);
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log("Auth state changed:", event);

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // Fetch profile when user signs in or token refreshes
        if (currentSession?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          fetchProfile(currentSession.user.id);
        }

        // Handle different auth events
        switch (event) {
          case "SIGNED_IN":
            console.log("User signed in");
            break;
          
          case "SIGNED_OUT":
            console.log("User signed out");
            setSession(null);
            setUser(null);
            setProfile(null);
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

        // Handle session expiration
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
      // Clear local state even on error
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
