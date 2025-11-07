import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fish, Mail, ArrowLeft, LogOut, RefreshCw, MapPin } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import type { Location, WeatherData } from "@/services/adviceService";
import { cn } from "@/lib/utils";
import FishingMap from "@/components/FishingMap";
import { WeatherBadge } from "@/components/WeatherBadge";
import ResultsErrorBoundary from "@/components/ResultsErrorBoundary";

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

  // Debug logging
  console.log("Results: weatherData", weatherData);
  console.log("Results: locations count", locations?.length);

  return (
    <ResultsErrorBoundary>
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-water text-white py-4 px-4 shadow-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
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
              <span className="font-semibold hidden sm:inline">Fishing Advice</span>
            </div>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Venue and Date Header */}
        <div className="mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{venue}</h1>
          <p className="text-lg text-muted-foreground">{date}</p>
        </div>

        {/* Weather Information */}
        <WeatherBadge 
          weather={weatherData} 
          showDetailed={true}
          className="mb-6 shadow-soft bg-gradient-to-r from-primary/5 to-secondary/5"
        />

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* AI Advice Section */}
          <Card className="p-6 shadow-medium overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Fish className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Fishing Advice</h2>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div 
                className="prose prose-sm max-w-none text-foreground"
                style={{
                  fontSize: "16px",
                  lineHeight: "1.6",
                  whiteSpace: "pre-line"
                }}
              >
                {advice}
              </div>
            </div>
          </Card>

          {/* Map Section */}
          <Card className="p-6 shadow-medium flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Recommended Locations</h2>
            </div>
            
            {/* Map */}
            <div className="flex-1 mb-4" style={{ minHeight: "400px" }}>
              <FishingMap locations={locations} venueName={venue} />
            </div>
            
            {/* Location List */}
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {locations.map((loc, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className={cn(
                    "w-3 h-3 rounded-full mt-1 flex-shrink-0",
                    loc.type === "hotSpot" && "bg-primary",
                    loc.type === "goodArea" && "bg-accent",
                    loc.type === "entryPoint" && "bg-secondary"
                  )}></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{loc.name}</p>
                    <p className="text-xs text-muted-foreground">{loc.description}</p>
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/dashboard")}
            className="bg-gradient-water text-white hover:opacity-90 shadow-medium"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            New Query
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="shadow-soft"
          >
            <Mail className="w-5 h-5 mr-2" />
            Email This Advice
          </Button>
        </div>
      </main>
    </div>
    </ResultsErrorBoundary>
  );
};

export default Results;
