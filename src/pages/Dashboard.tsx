import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Fish, LogOut, AlertCircle, ArrowRight, Clock, Share2, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import DebugPanel from "@/components/DebugPanel";
import { getWeatherForecast } from "@/services/weatherService";
import { getFishingAdvice, AdviceServiceError } from "@/services/adviceService";
import type { FishingAdviceResponse } from "@/services/adviceService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getRecentQueries, getQueryById, QueryServiceError } from "@/services/queryService";
import type { QuerySummary } from "@/services/queryService";
import { ShareDialog } from "@/components/ShareDialog";

const VENUES = [
  "Grafham Water",
  "Rutland Water",
  "Pitsford Water",
  "Ravensthorpe Reservoir",
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut: authSignOut } = useAuth();
  const { toast } = useToast();
  const [venue, setVenue] = useState<string>("");
  const [date, setDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [weatherWarning, setWeatherWarning] = useState(false);
  const [lastFailedRequest, setLastFailedRequest] = useState<{
    venue: string;
    date: string;
  } | null>(null);
  const [recentQueries, setRecentQueries] = useState<QuerySummary[]>([]);
  const [isLoadingQueries, setIsLoadingQueries] = useState(true);
  const [isLoadingQuery, setIsLoadingQuery] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedQueryIds, setSelectedQueryIds] = useState<Set<string>>(new Set());
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  // Fetch recent queries on mount
  useEffect(() => {
    const fetchRecentQueries = async () => {
      try {
        setIsLoadingQueries(true);
        const queries = await getRecentQueries(5);
        setRecentQueries(queries);
      } catch (err) {
        console.error('Error loading recent queries:', err);
        // Don't show error toast for queries loading failure
      } finally {
        setIsLoadingQueries(false);
      }
    };

    if (user) {
      fetchRecentQueries();
    }
  }, [user]);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const handleGetAdvice = async () => {
    if (!venue || !date) return;
    
    setError(null);
    setWeatherWarning(false);
    setIsLoading(true);
    const dateString = format(date, "yyyy-MM-dd");
    
    try {
      // Step 1: Fetch weather forecast
      setLoadingMessage("Fetching weather forecast...");
      let weatherData;
      
      try {
        weatherData = await getWeatherForecast(venue, dateString);
        
        // Check if we got fallback data (basic heuristic - no precipitation or pressure data suggests mock data)
        if (weatherData.humidity === 0 || weatherData.pressure === 0) {
          setWeatherWarning(true);
        }
      } catch (weatherError) {
        console.warn("Weather API failed, using fallback data:", weatherError);
        setWeatherWarning(true);
        // getWeatherForecast already returns fallback data on error
        weatherData = await getWeatherForecast(venue, dateString);
      }
      
      // Step 2: Get fishing advice
      setLoadingMessage("Analyzing fishing conditions...");
      const adviceData: FishingAdviceResponse = await getFishingAdvice(venue, dateString, weatherData);
      
      // Step 3: Navigate to results
      navigate("/results", {
        state: {
          venue,
          date: format(date, "PPP"),
          advice: adviceData.advice,
          locations: adviceData.locations,
          weatherData: adviceData.weatherData,
          queryId: adviceData.queryId,
        },
      });
    } catch (err) {
      console.error("Error getting fishing advice:", err);
      
      setLastFailedRequest({ venue, date: dateString });
      
      if (err instanceof AdviceServiceError) {
        if (err.code === "NOT_AUTHENTICATED") {
          setError("You need to be logged in to get fishing advice.");
          toast({
            variant: "destructive",
            title: "Authentication Required",
            description: "Please log in to continue.",
          });
        } else {
          setError(err.message);
          toast({
            variant: "destructive",
            title: "Failed to Get Advice",
            description: err.message,
          });
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to get fishing advice. Please try again.",
        });
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleRetry = () => {
    if (lastFailedRequest) {
      const retryDate = new Date(lastFailedRequest.date);
      setVenue(lastFailedRequest.venue);
      setDate(retryDate);
      setError(null);
      setWeatherWarning(false);
      // Automatically retry
      setTimeout(() => handleGetAdvice(), 100);
    }
  };

  const handleViewQuery = async (queryId: string) => {
    try {
      setIsLoadingQuery(true);
      const query = await getQueryById(queryId);
      
      // Navigate to results with the query data
      navigate("/results", {
        state: {
          venue: query.venue,
          date: format(new Date(query.query_date), "PPP"),
          advice: query.advice_text,
          locations: query.recommended_locations,
          weatherData: query.weather_data,
          queryId: query.id,
        },
      });
    } catch (err) {
      console.error("Error loading query:", err);
      
      if (err instanceof QueryServiceError) {
        toast({
          variant: "destructive",
          title: "Failed to Load Query",
          description: err.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load query details. Please try again.",
        });
      }
    } finally {
      setIsLoadingQuery(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    await authSignOut();
    navigate("/");
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedQueryIds(new Set());
  };

  const handleSelectQuery = (queryId: string, checked: boolean) => {
    const newSelected = new Set(selectedQueryIds);
    if (checked) {
      newSelected.add(queryId);
    } else {
      newSelected.delete(queryId);
    }
    setSelectedQueryIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedQueryIds.size === recentQueries.length) {
      setSelectedQueryIds(new Set());
    } else {
      setSelectedQueryIds(new Set(recentQueries.map(q => q.id)));
    }
  };

  const handleShareSelected = () => {
    setIsShareDialogOpen(true);
  };

  const handleShareComplete = () => {
    setIsShareDialogOpen(false);
    setIsSelectionMode(false);
    setSelectedQueryIds(new Set());
    toast({
      title: "Success!",
      description: "Reports shared successfully",
    });
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedQueryIds(new Set());
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
            {/* Weather Warning */}
            {weatherWarning && (
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-800 dark:text-amber-300">
                  Using estimated weather conditions. Real-time data unavailable.
                </AlertDescription>
              </Alert>
            )}

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{error}</span>
                  {lastFailedRequest && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      disabled={isLoading}
                      className="ml-4"
                    >
                      Retry
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

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
              {isLoading ? loadingMessage || "Processing..." : "Get Fishing Advice"}
            </Button>
            
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center">
                This typically takes 2-5 seconds...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Queries */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Queries</h2>
            {recentQueries.length > 0 && (
              <Button
                variant={isSelectionMode ? "default" : "outline"}
                size="sm"
                onClick={handleToggleSelectionMode}
                className="gap-2"
              >
                <Share2 className="w-4 h-4" />
                {isSelectionMode ? "Selecting..." : "Select to Share"}
              </Button>
            )}
          </div>
          
          {isLoadingQueries ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-muted rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/3"></div>
                  </div>
                </Card>
              ))}
            </div>
          ) : recentQueries.length === 0 ? (
            <Card className="p-12">
              <div className="text-center text-muted-foreground">
                <Fish className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No queries yet</p>
                <p className="text-sm">Select a venue and date above to get started!</p>
              </div>
            </Card>
          ) : (
            <>
              {isSelectionMode && (
                <div className="mb-4 flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="gap-2"
                    >
                      {selectedQueryIds.size === recentQueries.length ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      {selectedQueryIds.size === recentQueries.length ? "Deselect All" : "Select All"}
                    </Button>
                    <span className="text-sm font-medium">
                      {selectedQueryIds.size} {selectedQueryIds.size === 1 ? "report" : "reports"} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleShareSelected}
                      disabled={selectedQueryIds.size === 0}
                      className="gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      Share Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelSelection}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recentQueries.map((query) => {
                  const isSelected = selectedQueryIds.has(query.id);
                  
                  return (
                    <Card 
                      key={query.id} 
                      className={cn(
                        "p-6 transition-all",
                        !isSelectionMode && "hover:shadow-medium cursor-pointer group",
                        isSelectionMode && "cursor-default",
                        isSelected && "ring-2 ring-primary"
                      )}
                      onClick={() => {
                        if (!isSelectionMode) {
                          handleViewQuery(query.id);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        {isSelectionMode && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectQuery(query.id, checked as boolean)}
                            className="mt-1"
                          />
                        )}
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Fish className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {query.venue}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(query.query_date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      
                      {!isSelectionMode && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>
                              {formatDistanceToNow(new Date(query.created_at), { 
                                addSuffix: true 
                              })}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary group-hover:translate-x-1 transition-transform"
                            disabled={isLoadingQuery}
                          >
                            View
                            <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Debug Panel */}
      <DebugPanel />

      {/* Share Dialog */}
      <ShareDialog
        open={isShareDialogOpen}
        selectedQueryIds={Array.from(selectedQueryIds)}
        onClose={() => setIsShareDialogOpen(false)}
        onShareComplete={handleShareComplete}
      />
    </div>
  );
};

export default Dashboard;
