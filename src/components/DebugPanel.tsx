import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Bug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DebugPanel = () => {
  const { user, session, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [debugData, setDebugData] = useState<any>({});

  useEffect(() => {
    const fetchDebugData = async () => {
      try {
        // Get session
        const { data: sessionData } = await supabase.auth.getSession();
        
        // Get user
        const { data: userData } = await supabase.auth.getUser();
        
        // Get profile if user exists
        let profileData = null;
        if (userData?.user?.id) {
          const { data, error } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", userData.user.id)
            .single();
          
          if (!error) {
            profileData = data;
          }
        }

        setDebugData({
          session: sessionData.session,
          user: userData.user,
          profile: profileData,
          contextUser: user,
          contextSession: session,
          contextProfile: profile,
        });
      } catch (error) {
        console.error("Debug fetch error:", error);
      }
    };

    if (isOpen) {
      fetchDebugData();
    }
  }, [isOpen, user, session, profile]);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 shadow-lg z-50"
      >
        <Bug className="w-4 h-4 mr-2" />
        Debug
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-[600px] shadow-xl z-50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4" />
            <CardTitle className="text-sm">Auth Debug Panel</CardTitle>
          </div>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-auto max-h-[500px] text-xs">
        <div className="space-y-4">
          {/* Session Info */}
          <div>
            <h4 className="font-semibold mb-2 text-primary">Direct Session</h4>
            <pre className="bg-muted p-2 rounded overflow-x-auto">
              {JSON.stringify(
                {
                  exists: !!debugData.session,
                  user_id: debugData.session?.user?.id,
                  email: debugData.session?.user?.email,
                  expires_at: debugData.session?.expires_at,
                },
                null,
                2
              )}
            </pre>
          </div>

          {/* Context Session */}
          <div>
            <h4 className="font-semibold mb-2 text-secondary">Context Session</h4>
            <pre className="bg-muted p-2 rounded overflow-x-auto">
              {JSON.stringify(
                {
                  exists: !!debugData.contextSession,
                  user_id: debugData.contextSession?.user?.id,
                  email: debugData.contextSession?.user?.email,
                },
                null,
                2
              )}
            </pre>
          </div>

          {/* User Info */}
          <div>
            <h4 className="font-semibold mb-2 text-primary">Direct User</h4>
            <pre className="bg-muted p-2 rounded overflow-x-auto">
              {JSON.stringify(
                {
                  exists: !!debugData.user,
                  id: debugData.user?.id,
                  email: debugData.user?.email,
                  created_at: debugData.user?.created_at,
                  last_sign_in_at: debugData.user?.last_sign_in_at,
                },
                null,
                2
              )}
            </pre>
          </div>

          {/* Context User */}
          <div>
            <h4 className="font-semibold mb-2 text-secondary">Context User</h4>
            <pre className="bg-muted p-2 rounded overflow-x-auto">
              {JSON.stringify(
                {
                  exists: !!debugData.contextUser,
                  id: debugData.contextUser?.id,
                  email: debugData.contextUser?.email,
                },
                null,
                2
              )}
            </pre>
          </div>

          {/* Profile Info */}
          <div>
            <h4 className="font-semibold mb-2 text-primary">Direct Profile</h4>
            <pre className="bg-muted p-2 rounded overflow-x-auto">
              {JSON.stringify(
                debugData.profile || { exists: false },
                null,
                2
              )}
            </pre>
          </div>

          {/* Context Profile */}
          <div>
            <h4 className="font-semibold mb-2 text-secondary">Context Profile</h4>
            <pre className="bg-muted p-2 rounded overflow-x-auto">
              {JSON.stringify(
                debugData.contextProfile || { exists: false },
                null,
                2
              )}
            </pre>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setIsOpen(false);
              setTimeout(() => setIsOpen(true), 100);
            }}
          >
            Refresh Data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DebugPanel;
