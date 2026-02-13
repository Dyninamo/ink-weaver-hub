import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Fish, CheckCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import FishLogger from "@/components/FishLogger";

const DiaryEntry = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [entry, setEntry] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const addFishMode = (location.state as any)?.addFish === true;

  const fetchEntry = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("diary_entries")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setEntry(data);
    } catch (err) {
      console.error("Error loading diary entry:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load diary entry.",
      });
      navigate("/diary");
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-water text-white py-6 px-4 shadow-medium">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => navigate("/diary")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{entry.venue}</h1>
            <p className="text-sm text-white/80">
              {format(new Date(entry.trip_date), "PPP")}
              {addFishMode && " — Step 2: Log Your Fish"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 md:p-8 space-y-6 pb-24">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{entry.total_fish}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-secondary">{entry.total_kept}</p>
            <p className="text-xs text-muted-foreground">Kept</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{entry.total_released}</p>
            <p className="text-xs text-muted-foreground">Released</p>
          </Card>
        </div>

        {/* Fish Logger */}
        <FishLogger
          diaryEntryId={id!}
          venue={entry.venue}
          onUpdate={fetchEntry}
        />

        {/* Save & Finish */}
        <Button
          onClick={() => {
            toast({ title: "Entry saved!", description: `${entry.total_fish} fish logged.` });
            navigate("/diary");
          }}
          className="w-full bg-gradient-water text-white hover:opacity-90 py-6 text-base"
        >
          <CheckCircle className="w-5 h-5 mr-2" />
          Save & Finish
        </Button>

        {/* Trip details (collapsed when in add-fish mode) */}
        {!addFishMode && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trip Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {entry.fishing_type && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium text-foreground">{entry.fishing_type}</span>
                </div>
              )}
              {entry.best_method && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Best Method</span>
                  <span className="font-medium text-foreground">{entry.best_method}</span>
                </div>
              )}
              {entry.best_fly && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Best Fly</span>
                  <span className="font-medium text-foreground">{entry.best_fly}</span>
                </div>
              )}
              {entry.best_spot && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Best Spot</span>
                  <span className="font-medium text-foreground">{entry.best_spot}</span>
                </div>
              )}
              {entry.notes && (
                <div className="pt-3 border-t border-border">
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p className="text-foreground whitespace-pre-wrap">{entry.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default DiaryEntry;
