import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, ArrowRight, Cloud, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getWeatherForecast } from "@/services/weatherService";
import AutocompleteTagInput from "@/components/AutocompleteTagInput";

interface VenueOption {
  name: string;
}


const DiaryNew = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Form state
  const [venue, setVenue] = useState("");
  const [customVenue, setCustomVenue] = useState("");
  const [tripDate, setTripDate] = useState<Date>(new Date());
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [fishingType, setFishingType] = useState<string>("Bank");

  // Weather
  const [weatherTemp, setWeatherTemp] = useState<string>("");
  const [weatherWind, setWeatherWind] = useState<string>("");
  const [weatherConditions, setWeatherConditions] = useState("");
  const [weatherDirection, setWeatherDirection] = useState("");
  const [weatherAutoFilled, setWeatherAutoFilled] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Tags
  const [methods, setMethods] = useState<string[]>([]);
  const [flies, setFlies] = useState<string[]>([]);
  const [spots, setSpots] = useState<string[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Competition
  const [isCompetition, setIsCompetition] = useState(false);
  const [competitionName, setCompetitionName] = useState("");

  // Reference data - venues only (autocomplete handles the rest)
  const [venues, setVenues] = useState<VenueOption[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  const selectedVenue = venue === "__other__" ? customVenue : venue;

  // Load venues and reference data
  useEffect(() => {
    const loadVenues = async () => {
      const { data } = await supabase.from("venue_metadata").select("name").order("name");
      if (data) setVenues(data as VenueOption[]);
    };
    loadVenues();
  }, []);


  // Auto-fill weather
  const fetchWeather = useCallback(async () => {
    if (!selectedVenue || !tripDate) return;
    setIsLoadingWeather(true);
    try {
      const dateStr = format(tripDate, "yyyy-MM-dd");
      const weather = await getWeatherForecast(selectedVenue, dateStr);
      setWeatherTemp(String(weather.temperature));
      setWeatherWind(String(weather.windSpeed));
      setWeatherDirection(weather.windDirection || "");
      setWeatherConditions(weather.conditions || "");
      setWeatherAutoFilled(true);
    } catch {
      // Silently fail - user can fill manually
    } finally {
      setIsLoadingWeather(false);
    }
  }, [selectedVenue, tripDate]);

  useEffect(() => {
    if (selectedVenue && tripDate) {
      fetchWeather();
    }
  }, [selectedVenue, tripDate, fetchWeather]);

  const handleSave = async (continueToFish: boolean) => {
    if (!selectedVenue) {
      toast({ variant: "destructive", title: "Venue required", description: "Please select a venue." });
      return;
    }
    if (!user) return;

    setIsSaving(true);
    try {
      const weatherAuto = weatherAutoFilled
        ? {
            temperature: Number(weatherTemp) || null,
            windSpeed: Number(weatherWind) || null,
            windDirection: weatherDirection,
            conditions: weatherConditions,
          }
        : null;

      const { data, error } = await supabase
        .from("diary_entries")
        .insert({
          user_id: user.id,
          venue: selectedVenue,
          trip_date: format(tripDate, "yyyy-MM-dd"),
          arrival_time: arrivalTime || null,
          departure_time: departureTime || null,
          fishing_type: fishingType || null,
          weather_auto: weatherAuto,
          methods_used: methods.length > 0 ? JSON.stringify(methods) : "[]",
          flies_used: flies.length > 0 ? JSON.stringify(flies) : "[]",
          spots_fished: spots.length > 0 ? JSON.stringify(spots) : "[]",
          lines_used: lines.length > 0 ? JSON.stringify(lines) : "[]",
          notes: notes || null,
          is_competition: isCompetition,
          competition_name: isCompetition ? competitionName : null,
          t_mean_week: Number(weatherTemp) || null,
          wind_speed_mean_week: Number(weatherWind) || null,
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      toast({ title: "Saved!", description: "Diary entry created." });

      if (continueToFish && data) {
        navigate(`/diary/${data.id}`, { state: { addFish: true } });
      } else {
        navigate("/diary");
      }
    } catch (err: any) {
      console.error("Error saving diary entry:", err);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err.message || "Could not save diary entry.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const windDirections = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">New Entry</h1>
              <p className="text-sm text-white/80">Step 1 — Trip Details</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 md:p-8 space-y-6 pb-24">
        {/* WHERE & WHEN */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground uppercase tracking-wide">Where & When</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Venue */}
            <div className="space-y-2">
              <Label>Venue</Label>
              <Select value={venue} onValueChange={setVenue}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a venue..." />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((v) => (
                    <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                  ))}
                  <SelectItem value="__other__">Other...</SelectItem>
                </SelectContent>
              </Select>
              {venue === "__other__" && (
                <Input
                  placeholder="Enter venue name"
                  value={customVenue}
                  onChange={(e) => setCustomVenue(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(tripDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tripDate}
                    onSelect={(d) => d && setTripDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Arrival time</Label>
                <Input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Departure time</Label>
                <Input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} />
              </div>
            </div>

            {/* Fishing type */}
            <div className="space-y-2">
              <Label>Fishing type</Label>
              <RadioGroup value={fishingType} onValueChange={setFishingType} className="flex gap-4">
                {["Bank", "Boat", "Both"].map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <RadioGroupItem value={type} id={`type-${type}`} />
                    <Label htmlFor={`type-${type}`} className="cursor-pointer font-normal">{type}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* CONDITIONS */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-muted-foreground uppercase tracking-wide">Conditions</CardTitle>
              {isLoadingWeather && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading forecast...
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {weatherAutoFilled && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Cloud className="w-3 h-3" />
                Weather auto-filled from forecast. Edit if different.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Temperature °C</Label>
                <Input
                  type="number"
                  value={weatherTemp}
                  onChange={(e) => setWeatherTemp(e.target.value)}
                  placeholder="e.g. 14"
                />
              </div>
              <div className="space-y-2">
                <Label>Wind speed mph</Label>
                <Input
                  type="number"
                  value={weatherWind}
                  onChange={(e) => setWeatherWind(e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Wind direction</Label>
                <Select value={weatherDirection} onValueChange={setWeatherDirection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Direction" />
                  </SelectTrigger>
                  <SelectContent>
                    {windDirections.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conditions</Label>
                <Input
                  value={weatherConditions}
                  onChange={(e) => setWeatherConditions(e.target.value)}
                  placeholder="e.g. Overcast"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QUICK SUMMARY */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground uppercase tracking-wide">Quick Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Methods used</Label>
              <AutocompleteTagInput category="method" value={methods} onChange={setMethods} placeholder="e.g. Buzzer, Lure..." />
            </div>
            <div className="space-y-2">
              <Label>Flies used</Label>
              <AutocompleteTagInput category="fly" value={flies} onChange={setFlies} placeholder="e.g. Diawl Bach, Snake..." />
            </div>
            <div className="space-y-2">
              <Label>Spots fished</Label>
              <AutocompleteTagInput category="spot" venue={selectedVenue} value={spots} onChange={setSpots} placeholder="e.g. Dam, Lodge..." />
            </div>
            <div className="space-y-2">
              <Label>Lines used</Label>
              <AutocompleteTagInput category="line" value={lines} onChange={setLines} placeholder="e.g. Floating, Intermediate..." />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="How was the day? Any observations?"
              />
            </div>
          </CardContent>
        </Card>

        {/* COMPETITION */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground uppercase tracking-wide">Competition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="competition-toggle" className="cursor-pointer">Is this a competition?</Label>
              <Switch
                id="competition-toggle"
                checked={isCompetition}
                onCheckedChange={setIsCompetition}
              />
            </div>
            {isCompetition && (
              <div className="space-y-2">
                <Label>Competition name</Label>
                <Input
                  value={competitionName}
                  onChange={(e) => setCompetitionName(e.target.value)}
                  placeholder="e.g. Spring Open"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => handleSave(true)}
            disabled={isSaving || !selectedVenue}
            className="w-full bg-gradient-water text-white hover:opacity-90 text-base py-6"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <>Next: Log Your Fish <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={isSaving || !selectedVenue}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Save Without Fish Details
          </button>
        </div>
      </main>
    </div>
  );
};

export default DiaryNew;
