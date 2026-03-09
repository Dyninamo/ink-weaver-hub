import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { RefreshCw } from "lucide-react";

interface ManageAffiliationsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onUpdate: () => void;
}

interface Affiliation {
  affiliation_id: string;
  venue_id: string;
  status: string;
  last_session_at: string | null;
  venue_name: string;
}

const ManageAffiliations = ({ open, onOpenChange, profileId, onUpdate }: ManageAffiliationsProps) => {
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchAffiliations();
  }, [open, profileId]);

  const fetchAffiliations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("venue_affiliations")
      .select("affiliation_id, venue_id, status, last_session_at, venues_new(name)")
      .eq("profile_id", profileId)
      .order("last_session_at", { ascending: false });

    if (data) {
      setAffiliations(
        data.map((a) => ({
          affiliation_id: a.affiliation_id,
          venue_id: a.venue_id,
          status: a.status,
          last_session_at: a.last_session_at,
          venue_name: (a as any).venues_new?.name ?? "Unknown Venue",
        }))
      );
    }
    setLoading(false);
  };

  const handleToggle = async (affiliation: Affiliation) => {
    setToggling(affiliation.affiliation_id);
    const isActive = affiliation.status === "active";

    await supabase
      .from("venue_affiliations")
      .update(
        isActive
          ? { status: "opted_out", opted_out_at: new Date().toISOString() }
          : { status: "active", opted_out_at: null }
      )
      .eq("affiliation_id", affiliation.affiliation_id);

    setAffiliations((prev) =>
      prev.map((a) =>
        a.affiliation_id === affiliation.affiliation_id
          ? { ...a, status: isActive ? "opted_out" : "active" }
          : a
      )
    );
    setToggling(null);
    onUpdate();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage Venue Affiliations</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : affiliations.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            No venue affiliations yet.
          </p>
        ) : (
          <div className="mt-4 space-y-1">
            {affiliations.map((a) => (
              <div
                key={a.affiliation_id}
                className="flex items-center justify-between py-3 px-2 rounded-md hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-medium text-foreground truncate">{a.venue_name}</p>
                  {a.last_session_at && (
                    <p className="text-xs text-muted-foreground">
                      Last session: {format(new Date(a.last_session_at), "d MMM yyyy")}
                    </p>
                  )}
                </div>
                <Switch
                  checked={a.status === "active"}
                  disabled={toggling === a.affiliation_id}
                  onCheckedChange={() => handleToggle(a)}
                />
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ManageAffiliations;
