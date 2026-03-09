import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Copy, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  profileId: string;
  existingMemberIds: string[];
  onInvited: () => void;
}

interface SearchResult {
  profile_id: string;
  display_name: string;
}

const InviteDialog = ({
  open, onOpenChange, groupId, groupName, profileId, existingMemberIds, onInvited,
}: InviteDialogProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  const handleSearch = async (text: string) => {
    setSearch(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    const { data } = await supabase
      .from("user_profiles")
      .select("profile_id, display_name")
      .ilike("display_name", `%${text.trim()}%`)
      .limit(10);

    if (data) {
      setResults(
        data.filter(
          (u) => !existingMemberIds.includes(u.profile_id) && u.profile_id !== profileId
        )
      );
    }
    setSearching(false);
  };

  const handleInvite = async (result: SearchResult) => {
    setInviting(result.profile_id);

    const { error } = await supabase.from("group_memberships").insert({
      group_id: groupId,
      profile_id: result.profile_id,
      role: "member",
      status: "invited",
      invited_by_profile_id: profileId,
      invited_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already invited", description: `${result.display_name} already has a pending invite` });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    } else {
      toast({ title: "Invite sent", description: `Invite sent to ${result.display_name}` });
      setResults((prev) => prev.filter((r) => r.profile_id !== result.profile_id));
      onInvited();
    }

    setInviting(null);
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/social/join/${groupId}`;
    await navigator.clipboard.writeText(link);
    toast({ title: "Link copied" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {groupName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Search */}
          <div className="space-y-2">
            <Label>Search by name</Label>
            <Input
              placeholder="Type a name…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {results.map((r) => (
                <div key={r.profile_id} className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm text-foreground">{r.display_name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={inviting === r.profile_id}
                    onClick={() => handleInvite(r)}
                    className="gap-1"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Invite
                  </Button>
                </div>
              ))}
            </div>
          )}

          {search.trim().length >= 2 && results.length === 0 && !searching && (
            <p className="text-sm text-muted-foreground">No users found</p>
          )}

          <Separator />

          {/* Copy link */}
          <div className="space-y-2">
            <Label>Or share invite link</Label>
            <Button variant="outline" className="w-full gap-2" onClick={handleCopyLink}>
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteDialog;
