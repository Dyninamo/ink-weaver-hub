import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FishSymbol } from "lucide-react";
import { toast } from "sonner";

interface DisplayNameGateProps {
  children: React.ReactNode;
}

const DisplayNameGate = ({ children }: DisplayNameGateProps) => {
  const { user, profile, isProfileLoading, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Still loading profile — show nothing
  if (isProfileLoading || !user) return null;

  // Profile exists with display_name set — render children
  if (profile?.display_name && profile.display_name.trim().length > 0) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      toast.error("Name must be between 2 and 30 characters.");
      return;
    }
    setSaving(true);

    const { error } = await supabase
      .from("user_profiles")
      .update({ display_name: trimmed })
      .eq("id", user.id);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2 pb-2">
          <div className="flex items-center justify-center gap-2">
            <FishSymbol className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">Welcome!</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            What should we call you?
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 30))}
                placeholder="e.g. Dave M"
                required
                minLength={2}
                maxLength={30}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This is how other anglers will see you. 2-30 characters.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={saving || name.trim().length < 2}>
              {saving ? "Saving…" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DisplayNameGate;
