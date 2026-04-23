import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Mail,
  ChevronRight,
  Download,
  ShieldCheck,
  HelpCircle,
  ListChecks,
  LogOut,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SPECIES_OPTIONS = ["Rainbow trout", "Brown trout", "Grayling", "Sea trout", "Salmon"];
const ROD_WEIGHTS = ["3", "4", "5", "6", "7", "8"];
const LINE_OPTIONS = ["Floating", "Midge tip", "Slow intermediate", "Fast intermediate", "Sinking"];

const APP_VERSION = "0.9.0";

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Defaults
  const [stillSpecies, setStillSpecies] = useState("Rainbow trout");
  const [stillRod, setStillRod] = useState("7");
  const [stillLine, setStillLine] = useState("Floating");
  const [riverSpecies, setRiverSpecies] = useState("Brown trout");
  const [riverRod, setRiverRod] = useState("5");
  const [riverLine, setRiverLine] = useState("Floating");

  // Diary behaviour
  const [keepLimit, setKeepLimit] = useState<string>("0");
  const [sizeMode, setSizeMode] = useState<"weight" | "length">("weight");
  const [sizeUnits, setSizeUnits] = useState<"imperial" | "metric">("imperial");
  const [confirmDelete, setConfirmDelete] = useState(true);

  // Appearance
  const [theme, setTheme] = useState<"day" | "dusk" | "system">("system");
  const [reduceMotion, setReduceMotion] = useState(false);

  const [savingDefaults, setSavingDefaults] = useState(false);
  const [savingBehaviour, setSavingBehaviour] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name || "");
    setStillSpecies(profile.stillwater_default_species || "Rainbow trout");
    setStillRod(String(profile.stillwater_default_rod_weight ?? 7));
    setStillLine(profile.stillwater_default_line || "Floating");
    setRiverSpecies(profile.river_default_species || "Brown trout");
    setRiverRod(String(profile.river_default_rod_weight ?? 5));
    setRiverLine(profile.river_default_line || "Floating");
    setConfirmDelete(profile.confirm_delete_enabled ?? true);
  }, [profile]);

  // Load global defaults the wizard saved
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("default_size_mode, default_size_units, default_keep_limit")
        .eq("id", user.id)
        .single();
      if (data) {
        if (data.default_size_mode === "weight" || data.default_size_mode === "length") setSizeMode(data.default_size_mode);
        if (data.default_size_units === "imperial" || data.default_size_units === "metric") setSizeUnits(data.default_size_units);
        if (typeof data.default_keep_limit === "number") setKeepLimit(String(data.default_keep_limit));
      }
    })();
  }, [user]);

  // Local-only appearance prefs
  useEffect(() => {
    const t = localStorage.getItem("ic.theme");
    if (t === "day" || t === "dusk" || t === "system") setTheme(t);
    setReduceMotion(localStorage.getItem("ic.reduceMotion") === "true");
  }, []);

  async function saveDisplayName() {
    if (!user) return;
    if (displayName.trim().length < 2) {
      toast.error("Display name must be at least 2 characters");
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({ display_name: displayName.trim() })
      .eq("id", user.id);
    setSavingName(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Display name updated");
  }

  async function saveDefaults() {
    if (!user) return;
    setSavingDefaults(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({
        stillwater_default_species: stillSpecies,
        stillwater_default_rod_weight: Number(stillRod),
        stillwater_default_line: stillLine,
        river_default_species: riverSpecies,
        river_default_rod_weight: Number(riverRod),
        river_default_line: riverLine,
      })
      .eq("id", user.id);
    setSavingDefaults(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Defaults saved");
  }

  async function saveBehaviour() {
    if (!user) return;
    setSavingBehaviour(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({
        default_size_mode: sizeMode,
        default_size_units: sizeUnits,
        default_keep_limit: Number(keepLimit) || 0,
        confirm_delete_enabled: confirmDelete,
      })
      .eq("id", user.id);
    setSavingBehaviour(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Diary behaviour saved");
  }

  function persistAppearance(next: { theme?: typeof theme; reduceMotion?: boolean }) {
    if (next.theme) {
      setTheme(next.theme);
      localStorage.setItem("ic.theme", next.theme);
    }
    if (typeof next.reduceMotion === "boolean") {
      setReduceMotion(next.reduceMotion);
      localStorage.setItem("ic.reduceMotion", String(next.reduceMotion));
    }
  }

  async function exportSessions() {
    if (!user) return;
    const { data, error } = await supabase
      .from("fishing_sessions")
      .select("*")
      .eq("user_id", user.id);
    if (error) {
      toast.error("Export failed");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itscatching-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data?.length ?? 0} sessions`);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[420px] mx-auto p-4 space-y-4 pb-12">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        </div>

        {/* Profile card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-semibold text-primary">
                {(displayName || "A").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{displayName || "Angler"}</p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {user?.email ?? "—"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dn" className="text-xs">Display name</Label>
              <div className="flex gap-2">
                <Input
                  id="dn"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
                  placeholder="Your name"
                />
                <Button onClick={saveDisplayName} disabled={savingName} size="sm">
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Defaults by water type */}
        <SectionHeader title="Defaults by water type" />
        <div className="grid grid-cols-1 gap-3">
          <DefaultsCard
            stripe="foreground"
            label="Stillwater"
            species={stillSpecies}
            setSpecies={setStillSpecies}
            rod={stillRod}
            setRod={setStillRod}
            line={stillLine}
            setLine={setStillLine}
          />
          <DefaultsCard
            stripe="amber"
            label="River"
            species={riverSpecies}
            setSpecies={setRiverSpecies}
            rod={riverRod}
            setRod={setRiverRod}
            line={riverLine}
            setLine={setRiverLine}
          />
        </div>
        <Button onClick={saveDefaults} disabled={savingDefaults} variant="outline" className="w-full">
          {savingDefaults ? "Saving…" : "Save water-type defaults"}
        </Button>

        {/* Diary behaviour */}
        <SectionHeader title="Diary behaviour" />
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Daily keep limit</Label>
              <Input
                type="number"
                min={0}
                value={keepLimit}
                onChange={(e) => setKeepLimit(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">0 = no limit</p>
            </div>

            <ChipRow
              label="Size mode"
              value={sizeMode}
              options={["weight", "length"]}
              onSelect={(v) => setSizeMode(v as "weight" | "length")}
            />
            <ChipRow
              label="Units"
              value={sizeUnits}
              options={["imperial", "metric"]}
              onSelect={(v) => setSizeUnits(v as "imperial" | "metric")}
            />

            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                <p className="text-sm font-medium">Ask before deleting</p>
                <p className="text-[11px] text-muted-foreground">Show a confirm dialog when removing entries.</p>
              </div>
              <Switch checked={confirmDelete} onCheckedChange={setConfirmDelete} />
            </div>

            <Button onClick={saveBehaviour} disabled={savingBehaviour} variant="outline" className="w-full">
              {savingBehaviour ? "Saving…" : "Save diary behaviour"}
            </Button>
          </CardContent>
        </Card>

        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <Card>
          <CardContent className="p-4 space-y-3">
            <ChipRow
              label="Theme"
              value={theme}
              options={["day", "dusk", "system"]}
              onSelect={(v) => persistAppearance({ theme: v as typeof theme })}
            />
            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                <p className="text-sm font-medium">Reduce motion</p>
                <p className="text-[11px] text-muted-foreground">Disable animations and transitions.</p>
              </div>
              <Switch
                checked={reduceMotion}
                onCheckedChange={(v) => persistAppearance({ reduceMotion: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Preset rigs */}
        <SectionHeader title="Gear" />
        <NavRow
          icon={<ListChecks className="h-4 w-4" />}
          label="Preset rigs"
          sub="Manage saved rigs (rod + line + leader)"
          onClick={() => navigate("/diary/settings/setups")}
        />

        {/* Data */}
        <SectionHeader title="Data" />
        <NavRow
          icon={<Download className="h-4 w-4" />}
          label="Export sessions"
          sub="Download a JSON copy of your sessions"
          onClick={exportSessions}
        />
        <NavRow
          icon={<ShieldCheck className="h-4 w-4" />}
          label="What we store"
          sub="Sessions, weather snapshots, fly choices."
          onClick={() => toast.info("We store session details and weather snapshots only. No tracking.")}
        />

        {/* Help */}
        <SectionHeader title="Help" />
        <NavRow
          icon={<HelpCircle className="h-4 w-4" />}
          label="How this works"
          sub="A short tour of the diary."
          onClick={() => toast.info("Quick tour coming soon.")}
        />
        <NavRow
          icon={<Mail className="h-4 w-4" />}
          label="Get in touch"
          sub="hello@itscatching.uk"
          onClick={() => window.location.assign("mailto:hello@itscatching.uk")}
        />

        {/* Sign out */}
        <div className="pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full text-amber-700 dark:text-amber-500 border-amber-300/60 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out?</AlertDialogTitle>
                <AlertDialogDescription>
                  Any unsynced sessions will stay on this device. You can sign back in to continue.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={signOut}>Sign out</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <p className="text-center text-[11px] text-muted-foreground pt-2">
          It's Catching · v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold pt-2 pl-1">
      {title}
    </h2>
  );
}

function NavRow({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-lg border border-border bg-card hover:bg-muted/40 px-3 py-2.5 text-left transition-colors"
    >
      <span className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {sub && <span className="block text-[11px] text-muted-foreground truncate">{sub}</span>}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function DefaultsCard({
  stripe,
  label,
  species,
  setSpecies,
  rod,
  setRod,
  line,
  setLine,
}: {
  stripe: "foreground" | "amber";
  label: string;
  species: string;
  setSpecies: (v: string) => void;
  rod: string;
  setRod: (v: string) => void;
  line: string;
  setLine: (v: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 space-y-2.5 border-l-4",
        stripe === "foreground" ? "border-l-foreground/70" : "border-l-amber-500/70"
      )}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <ChipRow label="Species" value={species} options={SPECIES_OPTIONS} onSelect={setSpecies} />
      <ChipRow label="Rod weight" value={rod} options={ROD_WEIGHTS} onSelect={setRod} suffix="#" />
      <ChipRow label="Usual line" value={line} options={LINE_OPTIONS} onSelect={setLine} />
    </div>
  );
}

function ChipRow({
  label,
  value,
  options,
  onSelect,
  suffix,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs border transition-colors",
              value === opt
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40"
            )}
          >
            {opt}{suffix}
          </button>
        ))}
      </div>
    </div>
  );
}
