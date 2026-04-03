import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, FishSymbol, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GroupJoinView() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [group, setGroup] = useState<any>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!inviteCode) return;
    fetchGroup();
  }, [inviteCode, profile]);

  const fetchGroup = async () => {
    setLoading(true);

    const { data: groupData, error } = await supabase
      .from("social_groups")
      .select("group_id, name")
      .eq("invite_code", inviteCode!)
      .single();

    if (error || !groupData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setGroup(groupData);

    // Count members
    const { count } = await supabase
      .from("group_memberships")
      .select("*", { count: "exact", head: true })
      .eq("group_id", groupData.group_id)
      .eq("status", "active");

    setMemberCount(count || 0);

    // Check if already a member
    if (profile?.profile_id) {
      const { data: existing } = await supabase
        .from("group_memberships")
        .select("membership_id")
        .eq("group_id", groupData.group_id)
        .eq("profile_id", profile.profile_id)
        .in("status", ["active", "invited"])
        .maybeSingle();

      setAlreadyMember(!!existing);
    }

    setLoading(false);
  };

  const handleJoin = async () => {
    if (!profile?.profile_id || !group) return;
    setJoining(true);

    const { error } = await supabase.from("group_memberships").insert({
      group_id: group.group_id,
      profile_id: profile.profile_id,
      role: "member",
      status: "active",
      joined_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already a member" });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    } else {
      toast({ title: "Joined!", description: `You're now a member of ${group.name}` });
      navigate("/social");
    }
    setJoining(false);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="py-8 space-y-3">
            <FishSymbol className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-foreground font-medium">Group not found</p>
            <p className="text-sm text-muted-foreground">This invite link may be invalid or expired.</p>
            <Button onClick={() => navigate("/")} variant="outline">Go home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <FishSymbol className="h-6 w-6 text-primary" />
            <span className="font-bold text-foreground">It's Catching!</span>
          </div>
        </div>

        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <Users className="h-12 w-12 text-primary mx-auto" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">{group.name}</h2>
              <p className="text-sm text-muted-foreground">
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </p>
            </div>

            {!user ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Sign up to join this group</p>
                <Button
                  className="w-full"
                  onClick={() => navigate(`/auth?redirect=${encodeURIComponent(`/social/join/${inviteCode}`)}`)}
                >
                  Sign up / Sign in
                </Button>
              </div>
            ) : alreadyMember ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Check className="h-5 w-5" />
                  <span className="text-sm font-medium">You're already in this group</span>
                </div>
                <Button variant="outline" onClick={() => navigate("/social")}>
                  Go to Social Feed
                </Button>
              </div>
            ) : (
              <Button className="w-full" disabled={joining} onClick={handleJoin}>
                {joining ? "Joining…" : "Join Group"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
