import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, RefreshCw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import CreateGroupDialog from "./CreateGroupDialog";
import GroupDetail from "./GroupDetail";

interface GroupsFeedTabProps {
  userId?: string;
}

interface GroupRow {
  group_id: string;
  name: string;
  role: string;
  member_count: number;
}

interface PendingInvite {
  membership_id: string;
  group_id: string;
  group_name: string;
  invited_by_name: string | null;
}

const GroupsFeedTab = ({ userId }: GroupsFeedTabProps) => {
  const { toast } = useToast();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupRole, setSelectedGroupRole] = useState<string>("member");

  const fetchGroups = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // Get profile
      let { data: profile } = await supabase
        .from("user_profiles")
        .select("profile_id")
        .eq("id", userId)
        .single();

      if (!profile) {
        const { data: newProfile } = await supabase
          .from("user_profiles")
          .insert({
            id: userId,
            display_name: "Angler",
            notify_venue_card: true,
            notify_group_post: true,
            notify_notable_fish: true,
          })
          .select("profile_id")
          .single();
        profile = newProfile;
      }

      if (!profile) { setLoading(false); return; }
      setProfileId(profile.profile_id);

      // Active memberships
      const { data: memberships } = await supabase
        .from("group_memberships")
        .select("group_id, role, social_groups(group_id, name)")
        .eq("profile_id", profile.profile_id)
        .eq("status", "active");

      if (memberships) {
        // Get member counts
        const groupIds = memberships.map((m) => m.group_id);
        const countMap = new Map<string, number>();

        if (groupIds.length > 0) {
          const { data: allMembers } = await supabase
            .from("group_memberships")
            .select("group_id")
            .in("group_id", groupIds)
            .eq("status", "active");

          if (allMembers) {
            allMembers.forEach((m) => {
              countMap.set(m.group_id, (countMap.get(m.group_id) || 0) + 1);
            });
          }
        }

        const rows: GroupRow[] = memberships.map((m) => ({
          group_id: m.group_id,
          name: (m as any).social_groups?.name ?? "Unknown Group",
          role: m.role,
          member_count: countMap.get(m.group_id) || 1,
        }));

        // Sort: admins first, then alphabetical
        rows.sort((a, b) => {
          if (a.role === "admin" && b.role !== "admin") return -1;
          if (a.role !== "admin" && b.role === "admin") return 1;
          return a.name.localeCompare(b.name);
        });

        setGroups(rows);
      }

      // Pending invites
      const { data: pending } = await supabase
        .from("group_memberships")
        .select("membership_id, group_id, social_groups(name), user_profiles!group_memberships_invited_by_profile_id_fkey(display_name)")
        .eq("profile_id", profile.profile_id)
        .eq("status", "invited");

      if (pending) {
        setPendingInvites(
          pending.map((p) => ({
            membership_id: p.membership_id,
            group_id: p.group_id,
            group_name: (p as any).social_groups?.name ?? "Unknown Group",
            invited_by_name: (p as any).user_profiles?.display_name ?? null,
          }))
        );
      }
    } catch (err) {
      console.error("GroupsFeedTab fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleAcceptInvite = async (invite: PendingInvite) => {
    await supabase
      .from("group_memberships")
      .update({ status: "active", joined_at: new Date().toISOString() })
      .eq("membership_id", invite.membership_id);

    toast({ title: "Joined!", description: `You joined ${invite.group_name}` });
    fetchGroups();
  };

  const handleDeclineInvite = async (invite: PendingInvite) => {
    await supabase
      .from("group_memberships")
      .delete()
      .eq("membership_id", invite.membership_id);

    toast({ title: "Declined", description: `Invitation to ${invite.group_name} declined` });
    fetchGroups();
  };

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-muted-foreground">Sign in to see group activity</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin mb-3" />
        <p className="text-muted-foreground text-sm">Loading groups…</p>
      </div>
    );
  }

  // Group detail view
  if (selectedGroupId && profileId) {
    return (
      <GroupDetail
        groupId={selectedGroupId}
        profileId={profileId}
        userRole={selectedGroupRole}
        onBack={() => {
          setSelectedGroupId(null);
          fetchGroups();
        }}
      />
    );
  }

  // Group list view
  return (
    <div className="flex flex-col">
      {/* Pending invites banner */}
      {pendingInvites.length > 0 && (
        <div className="mx-4 mt-3 space-y-2">
          {pendingInvites.map((invite) => (
            <Card key={invite.membership_id} className="border-primary/30 bg-primary/5">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{invite.group_name}</p>
                    {invite.invited_by_name && (
                      <p className="text-xs text-muted-foreground">Invited by {invite.invited_by_name}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="default" onClick={() => handleAcceptInvite(invite)}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeclineInvite(invite)}>Decline</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Header with add button */}
      {groups.length > 0 && (
        <div className="flex justify-end px-4 py-2">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Group
          </Button>
        </div>
      )}

      {/* Group list or empty state */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-medium text-lg mb-2 text-foreground">No groups yet</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Create a group to share sessions with your fishing mates. Or wait for an invite.
          </p>
          <Button className="mt-6" onClick={() => setShowCreate(true)}>
            Create a Group
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {groups.map((group) => (
            <Card
              key={group.group_id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedGroupId(group.group_id);
                setSelectedGroupRole(group.role);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{group.name}</h3>
                  <Badge variant={group.role === "admin" ? "default" : "secondary"} className="text-xs capitalize">
                    {group.role}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {group.member_count} {group.member_count === 1 ? "member" : "members"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create group dialog */}
      {profileId && (
        <CreateGroupDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          profileId={profileId}
          onCreated={fetchGroups}
        />
      )}
    </div>
  );
};

export default GroupsFeedTab;
