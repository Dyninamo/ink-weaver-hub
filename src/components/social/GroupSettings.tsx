import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface GroupSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  profileId: string;
  userRole: string;
  onDeleted: () => void;
  onRenamed: (newName: string) => void;
  onLeft: () => void;
}

const GroupSettings = ({
  open, onOpenChange, groupId, groupName, profileId, userRole, onDeleted, onRenamed, onLeft,
}: GroupSettingsProps) => {
  const { toast } = useToast();
  const [newName, setNewName] = useState(groupName);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === groupName) return;
    setSaving(true);

    await supabase
      .from("social_groups")
      .update({ name: newName.trim() })
      .eq("group_id", groupId);

    toast({ title: "Group renamed" });
    onRenamed(newName.trim());
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);

    // Get card IDs for this group
    const { data: cards } = await supabase
      .from("social_cards")
      .select("card_id")
      .eq("group_id", groupId);

    if (cards && cards.length > 0) {
      const cardIds = cards.map((c) => c.card_id);
      await supabase.from("card_reactions").delete().in("card_id", cardIds);
      await supabase.from("card_replies").delete().in("card_id", cardIds);
      await supabase.from("social_cards").delete().eq("group_id", groupId);
    }

    await supabase.from("group_memberships").delete().eq("group_id", groupId);
    await supabase.from("social_groups").delete().eq("group_id", groupId);

    toast({ title: "Group deleted" });
    onOpenChange(false);
    onDeleted();
    setDeleting(false);
  };

  const handleLeave = async () => {
    await supabase
      .from("group_memberships")
      .delete()
      .eq("group_id", groupId)
      .eq("profile_id", profileId);

    toast({ title: "You left the group" });
    onOpenChange(false);
    onLeft();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Group Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* Rename (admin only) */}
          {userRole === "admin" && (
            <div className="space-y-2">
              <Label>Group name</Label>
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.slice(0, 50))}
                  maxLength={50}
                />
                <Button
                  onClick={handleRename}
                  disabled={saving || !newName.trim() || newName.trim() === groupName}
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Delete (admin) or Leave (member) */}
          {userRole === "admin" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete Group"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete '{groupName}'?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all members and shared content. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-destructive border-destructive/30">
                  Leave Group
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave '{groupName}'?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll need a new invitation to rejoin.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLeave}>Leave</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GroupSettings;
