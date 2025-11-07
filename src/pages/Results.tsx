import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fish, Wind, Thermometer, Cloud, Mail, ArrowLeft, LogOut, AlertCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import type { Location, WeatherData } from "@/services/adviceService";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ResultsState {
  venue: string;
  date: string;
  advice: string;
  locations: Location[];
  weatherData: WeatherData;
  queryId: string;
}

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut: authSignOut } = useAuth();

  const state = location.state as ResultsState | null;

  // Redirect to dashboard if no data
  useEffect(() => {
    if (!state) {
      console.error("No results data found, redirecting to dashboard");
      navigate("/dashboard");
    }
  }, [state, navigate]);

  const handleSignOut = async () => {
    await authSignOut();
    navigate("/");
  };

  // Show loading state while redirecting
  if (!state) {
    return null;
  }

  const { venue, date, advice, locations, weatherData } = state;

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
          <h1 className="text-3xl font-bold text-foreground mb-2">{venue}</h1>
          <p className="text-lg text-muted-foreground">{date}</p>
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
                <p className="font-semibold text-foreground">{weatherData.conditions}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                <Thermometer className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Temperature</p>
                <p className="font-semibold text-foreground">{weatherData.temperature}°C</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <Wind className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wind</p>
                <p className="font-semibold text-foreground">
                  {weatherData.windDirection} {weatherData.windSpeed}mph
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Cloud className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rain Chance</p>
                <p className="font-semibold text-foreground">{weatherData.precipitationProbability}%</p>
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
              {advice}
            </div>
          </Card>

          {/* Map */}
          <Card className="p-6 shadow-medium">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Recommended Locations</h2>
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-4">
              <p className="text-muted-foreground">Map will be displayed here</p>
            </div>
            
            {/* Location List */}
            <div className="space-y-3 mb-4">
              {locations.map((loc, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className={cn(
                    "w-3 h-3 rounded-full mt-1 flex-shrink-0",
                    loc.type === "hotSpot" && "bg-primary",
                    loc.type === "goodArea" && "bg-accent",
                    loc.type === "entryPoint" && "bg-secondary"
                  )}></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{loc.name}</p>
                    <p className="text-sm text-muted-foreground">{loc.description}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Legend */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span className="text-foreground">Hot spots - Best locations</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-accent"></div>
                <span className="text-foreground">Good areas - Reliable spots</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-secondary"></div>
                <span className="text-foreground">Entry points - Easy access</span>
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
