import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Settings, UserPlus, MoreHorizontal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import InviteDialog from "./InviteDialog";
import GroupSettings from "./GroupSettings";
import SharingCard from "./SharingCard";

interface GroupDetailProps {
  groupId: string;
  profileId: string;
  userRole: string;
  onBack: () => void;
}

interface Member {
  membership_id: string;
  profile_id: string;
  display_name: string;
  role: string;
}

const GroupDetail = ({ groupId, profileId, userRole, onBack }: GroupDetailProps) => {
  const { toast } = useToast();
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersOpen, setMembersOpen] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [feedCards, setFeedCards] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    setLoading(true);

    const { data: group } = await supabase
      .from("social_groups")
      .select("name")
      .eq("group_id", groupId)
      .single();

    if (group) setGroupName(group.name);

    const { data: memberData } = await supabase
      .from("group_memberships")
      .select("membership_id, profile_id, role, user_profiles(display_name)")
      .eq("group_id", groupId)
      .eq("status", "active")
      .order("role", { ascending: true });

    if (memberData) {
      setMembers(
        memberData.map((m) => ({
          membership_id: m.membership_id,
          profile_id: m.profile_id,
          display_name: (m as any).user_profiles?.display_name ?? "Unknown",
          role: m.role,
        }))
      );
    }

    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleRemoveMember = async (member: Member) => {
    await supabase
      .from("group_memberships")
      .delete()
      .eq("membership_id", member.membership_id);

    toast({ title: `${member.display_name} removed from group` });
    fetchDetail();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="font-semibold text-foreground">{groupName}</h2>
            <p className="text-xs text-muted-foreground">{members.length} {members.length === 1 ? "member" : "members"}</p>
          </div>
        </div>
        {userRole === "admin" && (
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
            <Settings className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Members collapsible */}
      <Collapsible open={membersOpen} onOpenChange={setMembersOpen} className="px-4 py-3 border-b border-border">
        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-foreground">
          <span>Members ({members.length})</span>
          <span className="text-xs text-muted-foreground">{membersOpen ? "▲" : "▼"}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-1">
          {members
            .sort((a, b) => (a.role === "admin" ? -1 : b.role === "admin" ? 1 : 0))
            .map((member) => (
              <div key={member.membership_id} className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">{member.display_name}</span>
                  {member.role === "admin" && (
                    <Badge variant="secondary" className="text-xs">Admin</Badge>
                  )}
                </div>
                {userRole === "admin" && member.profile_id !== profileId && member.role !== "admin" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleRemoveMember(member)}
                      >
                        Remove from group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}

          {/* Invite button */}
          <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4" />
            Invite
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {/* Feed placeholder */}
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-muted-foreground text-sm max-w-xs">
          No shared sessions yet. Share a session from your diary to start the conversation.
        </p>
      </div>

      {/* Invite dialog */}
      <InviteDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        groupId={groupId}
        groupName={groupName}
        profileId={profileId}
        existingMemberIds={members.map((m) => m.profile_id)}
        onInvited={fetchDetail}
      />

      {/* Group settings */}
      <GroupSettings
        open={showSettings}
        onOpenChange={setShowSettings}
        groupId={groupId}
        groupName={groupName}
        profileId={profileId}
        userRole={userRole}
        onDeleted={onBack}
        onRenamed={(newName) => setGroupName(newName)}
        onLeft={onBack}
      />
    </div>
  );
};

export default GroupDetail;
