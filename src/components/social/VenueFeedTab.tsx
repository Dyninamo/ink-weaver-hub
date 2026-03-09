import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import VenueCard from "./VenueCard";
import ManageAffiliations from "./ManageAffiliations";

interface VenueFeedTabProps {
  userId?: string;
}

interface VenueCardData {
  daily_card_id: string;
  venue_id: string;
  card_date: string;
  n_sessions: number;
  rod_average: number | null;
  top_fly_1: string | null;
  top_fly_2: string | null;
  top_fly_3: string | null;
  dominant_method: string | null;
  conditions_temp_c: number | null;
  conditions_wind: string | null;
  conditions_weather: string | null;
  best_fish_species: string | null;
  best_fish_weight_lb: number | null;
  narrative: string;
  has_leaderboard_event: boolean;
  leaderboard_summary: string | null;
  venue_name: string;
}

const VenueFeedTab = ({ userId }: VenueFeedTabProps) => {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [cards, setCards] = useState<VenueCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noAffiliations, setNoAffiliations] = useState(false);
  const [showManage, setShowManage] = useState(false);

  const fetchFeed = useCallback(async (showSpinner = false) => {
    if (!userId) return;

    if (showSpinner) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Get or create profile
      let { data: profile } = await supabase
        .from("user_profiles")
        .select("profile_id")
        .eq("id", userId)
        .single();

      if (!profile) {
        const { data: newProfile } = await supabase
          .from("user_profiles")
          .insert({
            id: userId,
            display_name: "Angler",
            notify_venue_card: true,
            notify_group_post: true,
            notify_notable_fish: true,
          })
          .select("profile_id")
          .single();
        profile = newProfile;
      }

      if (!profile) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setProfileId(profile.profile_id);

      // 2. Get active affiliations
      const { data: affiliations } = await supabase
        .from("venue_affiliations")
        .select("venue_id, venues_new(name)")
        .eq("profile_id", profile.profile_id)
        .eq("status", "active");

      if (!affiliations || affiliations.length === 0) {
        setNoAffiliations(true);
        setCards([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setNoAffiliations(false);
      const venueIds = affiliations.map((a) => a.venue_id);
      const venueNameMap = new Map<string, string>();
      affiliations.forEach((a) => {
        const venueName = (a as any).venues_new?.name ?? "Unknown Venue";
        venueNameMap.set(a.venue_id, venueName);
      });

      // 3. Fetch cards for last 14 days
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: rawCards } = await supabase
        .from("venue_daily_cards")
        .select("*")
        .in("venue_id", venueIds)
        .gte("card_date", fourteenDaysAgo.toISOString().split("T")[0])
        .order("card_date", { ascending: false })
        .limit(50);

      if (rawCards) {
        setCards(
          rawCards.map((c) => ({
            ...c,
            venue_name: venueNameMap.get(c.venue_id) ?? "Unknown Venue",
          }))
        );
      } else {
        setCards([]);
      }
    } catch (err) {
      console.error("VenueFeedTab fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-muted-foreground">Sign in to see venue updates</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin mb-3" />
        <p className="text-muted-foreground text-sm">Loading venue feed…</p>
      </div>
    );
  }

  if (noAffiliations) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <MapPin className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-medium text-lg mb-2 text-foreground">No venue updates yet</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Log a session at any venue and you'll automatically join its community. Daily fishing reports will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Refresh button */}
      <div className="flex justify-end px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchFeed(true)}
          disabled={refreshing}
          className="gap-2 text-muted-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Cards */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground text-sm max-w-xs">
            Your venues have been quiet recently. Cards appear when 3 or more sessions are logged at a venue on the same day.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {cards.map((card) => (
            <VenueCard key={card.daily_card_id} card={card} />
          ))}
        </div>
      )}

      {/* Manage affiliations link */}
      {profileId && (
        <div className="flex justify-center py-4 border-t border-border">
          <Button
            variant="link"
            size="sm"
            className="text-muted-foreground gap-2"
            onClick={() => setShowManage(true)}
          >
            <Settings className="h-3.5 w-3.5" />
            Manage venue affiliations
          </Button>
        </div>
      )}

      {/* Manage affiliations drawer */}
      {profileId && (
        <ManageAffiliations
          open={showManage}
          onOpenChange={setShowManage}
          profileId={profileId}
          onUpdate={() => fetchFeed(true)}
        />
      )}
    </div>
  );
};

export default VenueFeedTab;
