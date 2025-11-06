import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Fish, LogOut } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DebugPanel from "@/components/DebugPanel";

const VENUES = [
  "Grafham Water",
  "Rutland Water",
  "Pitsford Water",
  "Ravensthorpe Reservoir",
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut: authSignOut } = useAuth();
  const [venue, setVenue] = useState<string>("");
  const [date, setDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const handleGetAdvice = async () => {
    if (!venue || !date) return;
    
    setIsLoading(true);
    // TODO: Implement API call to get advice
    setTimeout(() => {
      setIsLoading(false);
      navigate("/results");
    }, 2000);
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    await authSignOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-water text-white py-6 px-4 shadow-medium">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Fish className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Fishing Advice</h1>
              <p className="text-sm text-white/80">Get AI-powered insights</p>
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
                  <p className="text-xs text-white/70">My Profile</p>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm"
              onClick={handleSignOut}
              disabled={isLoading}
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 md:p-8">
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="text-2xl">Plan Your Fishing Trip</CardTitle>
            <CardDescription>
              Select a venue and date to receive personalized AI-powered fishing advice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Venue Selection */}
            <div className="space-y-2">
              <Label htmlFor="venue">Fishing Venue</Label>
              <Select value={venue} onValueChange={setVenue}>
                <SelectTrigger id="venue" className="w-full">
                  <SelectValue placeholder="Choose a venue..." />
                </SelectTrigger>
                <SelectContent>
                  {VENUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Fishing Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleGetAdvice}
              disabled={!venue || !date || isLoading}
              className="w-full bg-gradient-water text-white hover:opacity-90 text-lg py-6"
            >
              {isLoading ? "Analyzing conditions..." : "Get Fishing Advice"}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Queries */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Recent Queries</h2>
          <div className="text-center py-12 text-muted-foreground">
            <p>No recent queries yet. Create your first fishing advice request above!</p>
          </div>
        </div>
      </main>

      {/* Debug Panel */}
      <DebugPanel />
    </div>
  );
};

export default Dashboard;
