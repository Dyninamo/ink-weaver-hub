import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  Trophy,
  Star,
  Check,
  X,
  Minus,
  Eye,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Scope = "personal_best" | "venue_season" | "venue_alltime" | "group" | "platform_species";

const SCOPE_LABELS: { key: Scope; label: string }[] = [
  { key: "personal_best", label: "My Bests" },
  { key: "venue_season", label: "Venue Season" },
  { key: "venue_alltime", label: "Venue All-Time" },
  { key: "group", label: "Group" },
  { key: "platform_species", label: "Species" },
];

const ALL_SPECIES = [
  "Rainbow Trout", "Brown Trout", "Brook Trout", "Tiger Trout",
  "Blue Trout", "Char", "Grayling",
];

const tierLabels: Record<number, string> = {
  1: "Claimed", 2: "Photographed", 3: "Verified", 4: "Witnessed",
};

const rankColors: Record<number, string> = {
  1: "text-[#F59E0B]",
  2: "text-[#9CA3AF]",
  3: "text-[#D97706]",
};

interface FishEntry {
  fish_id: string;
  species: string;
  weight_kg: number | null;
  weight_lb: number | null;
  length_cm: number | null;
  length_in: number | null;
  verification_tier: number;
  confidence_score: number;
  photo_url: string | null;
  venue_name: string;
  submitted_at: string;
  profile_id: string;
  display_name?: string;
  check_location_pass?: boolean | null;
  check_time_pass?: boolean | null;
  check_edit_clean?: boolean | null;
  check_plausibility_pass?: boolean | null;
  check_measure_in_frame?: boolean | null;
  venue_percentile?: number | null;
  n_witnesses?: number;
  is_personal_best?: boolean;
}

export default function Leaderboard() {
  const { scope: urlScope } = useParams<{ scope: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>(
    (urlScope as Scope) || "personal_best"
  );
  const [entries, setEntries] = useState<FishEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Venue scope state
  const [affiliatedVenues, setAffiliatedVenues] = useState<{ venue_id: string; name: string }[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(searchParams.get("venue") || null);
  const [venueSearch, setVenueSearch] = useState("");
  const [venueResults, setVenueResults] = useState<{ venue_id: string; name: string }[]>([]);

  // Group scope state
  const [groups, setGroups] = useState<{ group_id: string; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupTimeFilter, setGroupTimeFilter] = useState<"season" | "30d" | "all">("season");

  // Species scope state
  const [selectedSpecies, setSelectedSpecies] = useState("Rainbow Trout");
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);

  // Detail sheet
  const [detailFish, setDetailFish] = useState<FishEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Witness
  const [witnessedIds, setWitnessedIds] = useState<Set<string>>(new Set());
  const [witnessingId, setWitnessingId] = useState<string | null>(null);

  // Get profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_profiles")
      .select("profile_id")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfileId(data.profile_id);
      });
  }, [user]);

  // Load affiliated venues + groups
  useEffect(() => {
    if (!profileId) return;

    supabase
      .from("venue_affiliations")
      .select("venue_id, venues_new(name)")
      .eq("profile_id", profileId)
      .eq("status", "active")
      .limit(5)
      .then(({ data }) => {
        if (data) {
          setAffiliatedVenues(
            data.map((d: any) => ({
              venue_id: d.venue_id,
              name: (d.venues_new as any)?.name || "Unknown",
            }))
          );
        }
      });

    supabase
      .from("group_memberships")
      .select("group_id, social_groups(name)")
      .eq("profile_id", profileId)
      .eq("status", "active")
      .then(({ data }) => {
        if (data) {
          setGroups(
            data.map((d: any) => ({
              group_id: d.group_id,
              name: (d.social_groups as any)?.name || "Unknown",
            }))
          );
        }
      });
  }, [profileId]);

  // Venue search
  useEffect(() => {
    if (venueSearch.length < 2) {
      setVenueResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("venues_new")
        .select("venue_id, name")
        .ilike("name", `%${venueSearch}%`)
        .limit(8);
      if (data) setVenueResults(data);
    }, 300);
    return () => clearTimeout(t);
  }, [venueSearch]);

  // Load entries based on scope
  const loadEntries = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setEntries([]);

    try {
      if (scope === "personal_best") {
        const { data } = await supabase
          .from("notable_fish")
          .select("*,user_profiles!profile_id(display_name)")
          .eq("profile_id", profileId)
          .eq("is_active", true)
          .eq("is_personal_best", true)
          .order("species");

        if (data) {
          setEntries(
            data.map((d: any) => ({
              ...d,
              display_name: d.user_profiles?.display_name || "You",
            }))
          );
        }
      } else if (scope === "venue_season" || scope === "venue_alltime") {
        if (!selectedVenueId) { setLoading(false); return; }
        let query = supabase
          .from("notable_fish")
          .select("*,user_profiles!profile_id(display_name)")
          .eq("venue_id", selectedVenueId)
          .eq("is_active", true)
          .order("weight_kg", { ascending: false })
          .limit(20);

        if (scope === "venue_season") {
          const yr = new Date().getFullYear();
          query = query.gte("submitted_at", `${yr}-01-01`);
        }
        if (speciesFilter) {
          query = query.eq("species", speciesFilter);
        }

        const { data } = await query;
        if (data) {
          setEntries(
            data.map((d: any) => ({
              ...d,
              display_name: d.user_profiles?.display_name || "Angler",
            }))
          );
        }
      } else if (scope === "group") {
        if (!selectedGroupId) { setLoading(false); return; }
        const { data: members } = await supabase
          .from("group_memberships")
          .select("profile_id")
          .eq("group_id", selectedGroupId)
          .eq("status", "active");

        if (!members || members.length === 0) { setLoading(false); return; }
        const memberIds = members.map((m) => m.profile_id);

        let query = supabase
          .from("notable_fish")
          .select("*,user_profiles!profile_id(display_name)")
          .in("profile_id", memberIds)
          .eq("is_active", true)
          .order("weight_kg", { ascending: false })
          .limit(30);

        if (groupTimeFilter === "season") {
          query = query.gte("submitted_at", `${new Date().getFullYear()}-01-01`);
        } else if (groupTimeFilter === "30d") {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          query = query.gte("submitted_at", d.toISOString());
        }

        const { data } = await query;
        if (data) {
          setEntries(
            data.map((d: any) => ({
              ...d,
              display_name: d.user_profiles?.display_name || "Angler",
            }))
          );
        }
      } else if (scope === "platform_species") {
        const { data } = await supabase
          .from("notable_fish")
          .select("*,user_profiles!profile_id(display_name)")
          .eq("species", selectedSpecies)
          .eq("is_active", true)
          .order("weight_kg", { ascending: false })
          .limit(20);

        if (data) {
          setEntries(
            data.map((d: any) => ({
              ...d,
              display_name: d.user_profiles?.display_name || "Angler",
            }))
          );
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [profileId, scope, selectedVenueId, selectedGroupId, selectedSpecies, speciesFilter, groupTimeFilter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Witness handler
  async function handleWitness(fishId: string) {
    if (!user) return;
    setWitnessingId(fishId);
    try {
      const { data, error } = await supabase.functions.invoke("witness-notable-fish", {
        body: { user_id: user.id, fish_id: fishId },
      });
      if (error) throw error;
      setWitnessedIds((prev) => new Set(prev).add(fishId));
      toast.success("Witness confirmed — verification upgraded!");
      loadEntries();
    } catch (err: any) {
      toast.error(err.message || "Failed to witness");
    } finally {
      setWitnessingId(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  }

  function renderStars(tier: number) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4].map((s) => (
          <Star
            key={s}
            className={cn(
              "h-4 w-4",
              s <= tier ? "text-[#F59E0B] fill-[#F59E0B]" : "text-muted"
            )}
          />
        ))}
      </div>
    );
  }

  function renderFishCard(fish: FishEntry, index: number, showRank: boolean) {
    const rank = index + 1;
    const isOwn = fish.profile_id === profileId;
    const canWitness = !isOwn && !witnessedIds.has(fish.fish_id);
    const belowTier3 = scope === "platform_species" && fish.verification_tier < 3;

    return (
      <Card
        key={fish.fish_id}
        className={cn(
          "cursor-pointer transition-colors hover:bg-muted/50",
          belowTier3 && "opacity-50"
        )}
        onClick={() => {
          setDetailFish(fish);
          setDetailOpen(true);
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {showRank && (
              <span
                className={cn(
                  "text-xl font-bold font-mono shrink-0 w-8",
                  rankColors[rank] || "text-muted-foreground"
                )}
              >
                #{rank}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">
                  {scope === "personal_best" ? fish.species : fish.display_name}
                </span>
                {renderStars(fish.verification_tier)}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {scope !== "personal_best" && `${fish.species}  |  `}
                {fish.weight_lb != null
                  ? `${fish.weight_lb.toFixed(1)} lb`
                  : fish.weight_kg != null
                  ? `${fish.weight_kg.toFixed(2)} kg`
                  : "—"}
                {fish.length_cm != null && `  |  ${fish.length_cm.toFixed(1)} cm`}
              </p>
              <p className="text-xs text-muted-foreground">
                {fish.venue_name}  |  {formatDate(fish.submitted_at)}
              </p>
              {belowTier3 && (
                <p className="text-xs text-amber-500 mt-1">Needs verification upgrade</p>
              )}
            </div>
            {fish.photo_url && (
              <img
                src={fish.photo_url}
                alt=""
                className="h-10 w-10 rounded-full object-cover shrink-0"
              />
            )}
          </div>
          {/* Witness button */}
          {showRank && canWitness && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full min-h-[44px]"
              onClick={(e) => {
                e.stopPropagation();
                handleWitness(fish.fish_id);
              }}
              disabled={witnessingId === fish.fish_id}
            >
              {witnessingId === fish.fish_id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Witness
            </Button>
          )}
          {showRank && witnessedIds.has(fish.fish_id) && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-green-500">
              <Check className="h-4 w-4" /> Witnessed
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderChips<T extends string>(
    items: { key: T; label: string }[],
    selected: T | null,
    onSelect: (key: T) => void
  ) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {items.map((item) => (
          <Button
            key={item.key}
            variant={selected === item.key ? "default" : "outline"}
            size="sm"
            className="shrink-0 min-h-[40px]"
            onClick={() => onSelect(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    );
  }

  const showRank = scope !== "personal_best";

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Trophy className="h-5 w-5 text-[#F59E0B]" />
        <h1 className="text-xl font-semibold">Leaderboard</h1>
      </div>

      <div className="max-w-[480px] mx-auto p-4 space-y-4">
        {/* Scope tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {SCOPE_LABELS.map((s) => (
            <Button
              key={s.key}
              variant={scope === s.key ? "default" : "outline"}
              size="sm"
              className="shrink-0 min-h-[40px]"
              onClick={() => setScope(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        {/* Scope-specific selectors */}
        {(scope === "venue_season" || scope === "venue_alltime") && (
          <div className="space-y-2">
            {affiliatedVenues.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {affiliatedVenues.map((v) => (
                  <Button
                    key={v.venue_id}
                    variant={selectedVenueId === v.venue_id ? "default" : "outline"}
                    size="sm"
                    className="shrink-0 min-h-[40px]"
                    onClick={() => {
                      setSelectedVenueId(v.venue_id);
                      setVenueSearch("");
                    }}
                  >
                    {v.name}
                  </Button>
                ))}
              </div>
            )}
            <div className="relative">
              <Input
                placeholder="Search venue…"
                value={venueSearch}
                onChange={(e) => setVenueSearch(e.target.value)}
                className="min-h-[48px]"
              />
              {venueResults.length > 0 && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {venueResults.map((v) => (
                    <button
                      key={v.venue_id}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                      onClick={() => {
                        setSelectedVenueId(v.venue_id);
                        setVenueSearch("");
                        setVenueResults([]);
                      }}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Species filter */}
            {selectedVenueId && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <Button
                  variant={!speciesFilter ? "default" : "outline"}
                  size="sm"
                  className="shrink-0 min-h-[36px] text-xs"
                  onClick={() => setSpeciesFilter(null)}
                >
                  All Species
                </Button>
                {ALL_SPECIES.map((s) => (
                  <Button
                    key={s}
                    variant={speciesFilter === s ? "default" : "outline"}
                    size="sm"
                    className="shrink-0 min-h-[36px] text-xs"
                    onClick={() => setSpeciesFilter(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {scope === "group" && (
          <div className="space-y-2">
            {groups.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {groups.map((g) => (
                  <Button
                    key={g.group_id}
                    variant={selectedGroupId === g.group_id ? "default" : "outline"}
                    size="sm"
                    className="shrink-0 min-h-[40px]"
                    onClick={() => setSelectedGroupId(g.group_id)}
                  >
                    {g.name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Join a group to see group leaderboards.
              </p>
            )}
            {selectedGroupId && (
              <div className="flex gap-2">
                {(["season", "30d", "all"] as const).map((f) => (
                  <Button
                    key={f}
                    variant={groupTimeFilter === f ? "default" : "outline"}
                    size="sm"
                    className="flex-1 min-h-[36px] text-xs"
                    onClick={() => setGroupTimeFilter(f)}
                  >
                    {f === "season" ? "This Season" : f === "30d" ? "Last 30 Days" : "All Time"}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {scope === "platform_species" && (
          <div className="space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {ALL_SPECIES.map((s) => (
                <Button
                  key={s}
                  variant={selectedSpecies === s ? "default" : "outline"}
                  size="sm"
                  className="shrink-0 min-h-[40px]"
                  onClick={() => setSelectedSpecies(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Platform records require Verified (3-star) minimum
            </p>
          </div>
        )}

        {/* Entries */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              {scope === "personal_best"
                ? "No notable fish submitted yet. Flag a fish as notable from your diary to start tracking your personal bests."
                : (scope === "venue_season" || scope === "venue_alltime") && !selectedVenueId
                ? "Select a venue to see rankings."
                : scope === "group" && !selectedGroupId
                ? "Select a group to see rankings."
                : "No entries yet for this scope."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((fish, i) => renderFishCard(fish, i, showRank))}
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
          {detailFish && (
            <div className="space-y-4 pb-4">
              <SheetHeader>
                <SheetTitle>{detailFish.species}</SheetTitle>
              </SheetHeader>

              <p className="text-sm text-muted-foreground">
                {detailFish.display_name}  |  {detailFish.venue_name}  |  {formatDate(detailFish.submitted_at)}
              </p>

              {/* Photo */}
              {detailFish.photo_url && (
                <img
                  src={detailFish.photo_url}
                  alt={detailFish.species}
                  className="w-full max-h-[300px] object-contain rounded-lg bg-muted"
                />
              )}

              {/* Measurements */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Weight</p>
                  <p className="font-medium">
                    {detailFish.weight_lb != null
                      ? `${detailFish.weight_lb.toFixed(1)} lb (${detailFish.weight_kg?.toFixed(2)} kg)`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Length</p>
                  <p className="font-medium">
                    {detailFish.length_cm != null
                      ? `${detailFish.length_cm.toFixed(1)} cm (${detailFish.length_in?.toFixed(1)} in)`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Tier + confidence */}
              <div className="flex items-center gap-3">
                {renderStars(detailFish.verification_tier)}
                <span className="text-sm font-medium">
                  {tierLabels[detailFish.verification_tier]}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="font-mono">{detailFish.confidence_score}/100</span>
                </div>
                <Progress
                  value={detailFish.confidence_score}
                  className={cn(
                    "h-2",
                    detailFish.confidence_score >= 60
                      ? "[&>div]:bg-green-500"
                      : detailFish.confidence_score >= 35
                      ? "[&>div]:bg-amber-500"
                      : "[&>div]:bg-muted-foreground"
                  )}
                />
              </div>

              {/* Checks grid */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Checks</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Measurement", status: true },
                    { label: "Plausibility", status: detailFish.check_plausibility_pass },
                    { label: "Photo", status: detailFish.photo_url !== null },
                    { label: "Location", status: detailFish.check_location_pass },
                    { label: "Time", status: detailFish.check_time_pass },
                    { label: "No edits", status: detailFish.check_edit_clean },
                    { label: "Scale (V2)", status: null },
                    { label: `Witness (${detailFish.n_witnesses || 0})`, status: (detailFish.n_witnesses || 0) > 0 ? true : null },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      {c.status === true && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                      {c.status === false && <X className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                      {c.status === null && <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Percentile */}
              {detailFish.venue_percentile != null && (
                <p className="text-sm text-center">
                  Top {(100 - detailFish.venue_percentile).toFixed(0)}% at {detailFish.venue_name}
                </p>
              )}

              {/* Witness in detail */}
              {detailFish.profile_id !== profileId && !witnessedIds.has(detailFish.fish_id) && (
                <Button
                  className="w-full min-h-[48px]"
                  onClick={() => handleWitness(detailFish.fish_id)}
                  disabled={witnessingId === detailFish.fish_id}
                >
                  {witnessingId === detailFish.fish_id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  Witness this catch
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full min-h-[48px]"
                onClick={() => setDetailOpen(false)}
              >
                Close
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
