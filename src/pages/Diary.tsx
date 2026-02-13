import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Fish, BookOpen, Plus, LogOut, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DiaryEntry {
  id: string;
  venue: string;
  trip_date: string;
  total_fish: number;
  best_method: string | null;
  best_fly: string | null;
  best_spot: string | null;
  fishing_type: string | null;
  is_competition: boolean;
}

const Diary = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const { data, error } = await supabase
          .from("diary_entries")
          .select("id, venue, trip_date, total_fish, best_method, best_fly, best_spot, fishing_type, is_competition")
          .order("trip_date", { ascending: false });

        if (error) throw error;
        setEntries((data as DiaryEntry[]) || []);
      } catch (err) {
        console.error("Error loading diary entries:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load diary entries.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) fetchEntries();
  }, [user, toast]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-water text-white py-6 px-4 shadow-medium">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Diary</h1>
              <p className="text-sm text-white/80">Your fishing trip log</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center font-semibold">
                  {getUserInitials()}
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/dashboard")}
          >
            <Fish className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button
            variant="ghost"
            className="text-foreground font-semibold border-b-2 border-primary rounded-none"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            My Diary
          </Button>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-4 md:p-8">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6">
                <div className="animate-pulse">
                  <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                </div>
              </Card>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2 text-foreground font-medium">
                No diary entries yet
              </p>
              <p className="text-sm mb-6">
                Log your first fishing trip to start building your personal data!
              </p>
              <Button
                onClick={() => navigate("/diary/new")}
                className="bg-gradient-water text-white hover:opacity-90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Log Your First Trip
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {entries.map((entry) => (
              <Card
                key={entry.id}
                className="p-5 cursor-pointer hover:shadow-medium transition-shadow border-border"
                onClick={() => navigate(`/diary/${entry.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-card-foreground">
                      {entry.venue}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(entry.trip_date), "PPP")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-sm font-medium">
                    <Fish className="w-3.5 h-3.5" />
                    {entry.total_fish}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {entry.best_method && (
                    <span className="bg-muted text-muted-foreground px-2 py-1 rounded">
                      {entry.best_method}
                    </span>
                  )}
                  {entry.best_fly && (
                    <span className="bg-muted text-muted-foreground px-2 py-1 rounded">
                      {entry.best_fly}
                    </span>
                  )}
                  {entry.best_spot && (
                    <span className="bg-muted text-muted-foreground px-2 py-1 rounded">
                      📍 {entry.best_spot}
                    </span>
                  )}
                  {entry.is_competition && (
                    <span className="bg-accent/10 text-accent px-2 py-1 rounded font-medium">
                      🏆 Competition
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* FAB for mobile */}
      {entries.length > 0 && (
        <button
          onClick={() => navigate("/diary/new")}
          className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-medium flex items-center justify-center hover:opacity-90 transition-opacity md:hidden z-50"
          aria-label="Add new diary entry"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Desktop add button */}
      {entries.length > 0 && (
        <div className="hidden md:block max-w-4xl mx-auto px-4 pb-8">
          <Button
            onClick={() => navigate("/diary/new")}
            className="bg-gradient-water text-white hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Entry
          </Button>
        </div>
      )}
    </div>
  );
};

export default Diary;
