import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onCreated: () => void;
}

const CreateGroupDialog = ({ open, onOpenChange, profileId, onCreated }: CreateGroupDialogProps) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);

    try {
      const { data: group, error } = await supabase
        .from("social_groups")
        .insert({ name: name.trim(), created_by_profile_id: profileId })
        .select("group_id")
        .single();

      if (error || !group) {
        toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to create group" });
        return;
      }

      await supabase.from("group_memberships").insert({
        group_id: group.group_id,
        profile_id: profileId,
        role: "admin",
        status: "active",
        joined_at: new Date().toISOString(),
      });

      toast({ title: "Group created" });
      setName("");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      console.error("Create group error:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              placeholder="e.g. Friday Lads"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground text-right">{name.length}/50</p>
          </div>
          <Button className="w-full" disabled={!name.trim() || creating} onClick={handleCreate}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
