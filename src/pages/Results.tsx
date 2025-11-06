import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fish, Wind, Thermometer, Cloud, Mail, ArrowLeft, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Results = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Sign out error:", error);
      }
      
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
      
      navigate("/");
    } catch (error) {
      console.error("Unexpected sign out error:", error);
      navigate("/");
    }
  };

  // Mock data - will be replaced with real data
  const mockData = {
    venue: "Grafham Water",
    date: "Today, December 6, 2025",
    weather: {
      temp: 8,
      wind: { direction: "SW", speed: 12 },
      precipitation: 20,
      conditions: "Partly Cloudy",
    },
    advice: `Based on current conditions at Grafham Water, here's my advice for today:

**Weather Analysis:**
With a southwest wind at 12mph and temperatures around 8°C, conditions are favorable for fishing. The partly cloudy skies will provide good lighting without harsh shadows.

**Recommended Techniques:**
- Focus on the windward bank where food gets pushed by the wind
- Use intermediate lines to fish at mid-water depth
- Try buzzers and nymphs in sizes 12-14

**Best Locations:**
The areas marked on the map show the most productive zones based on recent reports and current wind direction. The north shore and the valve tower area should be particularly good today.

**Timing:**
Morning and late afternoon sessions typically produce the best results in these conditions.`,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-water text-white py-4 px-4 shadow-medium">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Fish className="w-6 h-6" />
              <span className="font-semibold">Fishing Advice</span>
            </div>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Venue and Date */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">{mockData.venue}</h1>
          <p className="text-lg text-muted-foreground">{mockData.date}</p>
        </div>

        {/* Weather Bar */}
        <Card className="p-6 mb-6 shadow-soft bg-gradient-to-r from-primary/5 to-secondary/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Cloud className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conditions</p>
                <p className="font-semibold text-foreground">{mockData.weather.conditions}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                <Thermometer className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Temperature</p>
                <p className="font-semibold text-foreground">{mockData.weather.temp}°C</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <Wind className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wind</p>
                <p className="font-semibold text-foreground">
                  {mockData.weather.wind.direction} {mockData.weather.wind.speed}mph
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Cloud className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rain Chance</p>
                <p className="font-semibold text-foreground">{mockData.weather.precipitation}%</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Results Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* AI Advice */}
          <Card className="p-6 shadow-medium">
            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
              <Fish className="w-6 h-6 text-primary" />
              AI Fishing Advice
            </h2>
            <div className="prose prose-sm max-w-none text-foreground whitespace-pre-line">
              {mockData.advice}
            </div>
          </Card>

          {/* Map */}
          <Card className="p-6 shadow-medium">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Recommended Locations</h2>
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Map will be displayed here</p>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span className="text-foreground">Hot spots</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-accent"></div>
                <span className="text-foreground">Good areas</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-secondary"></div>
                <span className="text-foreground">Entry points</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Email Button */}
        <div className="text-center">
          <Button
            size="lg"
            className="bg-gradient-water text-white hover:opacity-90 shadow-medium"
          >
            <Mail className="w-5 h-5 mr-2" />
            Email This Advice
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Results;
