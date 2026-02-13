import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Fish } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const DiaryEntry = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [entry, setEntry] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEntry = async () => {
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
    };

    fetchEntry();
  }, [id, navigate, toast]);

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
        <div className="max-w-4xl mx-auto flex items-center gap-3">
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
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{entry.total_fish}</p>
            <p className="text-xs text-muted-foreground">Total Fish</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-secondary">{entry.total_kept}</p>
            <p className="text-xs text-muted-foreground">Kept</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{entry.total_released}</p>
            <p className="text-xs text-muted-foreground">Released</p>
          </Card>
        </div>

        {/* Details */}
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
      </main>
    </div>
  );
};

export default DiaryEntry;
