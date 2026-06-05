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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Mail,
  ChevronRight,
  Download,
  ShieldCheck,
  HelpCircle,
  ListChecks,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SPECIES_OPTIONS = ["Rainbow trout", "Brown trout", "Grayling", "Sea trout", "Salmon"];
const ROD_WEIGHTS = ["3", "4", "5", "6", "7", "8", "9", "10"];
const LINE_OPTIONS = ["Floating", "Midge tip", "Slow intermediate", "Fast intermediate", "Sinking"];

const APP_VERSION = "0.9.0";

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [editingDefaults, setEditingDefaults] = useState(false);

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
  const [storageOpen, setStorageOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

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
    setEditingName(false);
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
    setEditingDefaults(false);
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
    toast.success("Saved");
  }

  function persistAppearance(next: { theme?: typeof theme; reduceMotion?: boolean }) {
    if (next.theme) {
      setTheme(next.theme);
      localStorage.setItem("ic.theme", next.theme);
    }
    if (typeof next.reduceMotion === "boolean") {
      setReduceMotion(next.reduceMotion);
      localStorage.setItem("ic.reduceMotion", String(next.reduceMotion));
      document.documentElement.setAttribute("data-motion", next.reduceMotion ? "reduced" : "");
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

  // Auto-save behaviour toggles after first interaction
  function handleConfirmDeleteToggle(v: boolean) {
    if (!user) return;
    setConfirmDelete(v);
    void supabase
      .from("user_profiles")
      .update({ confirm_delete_enabled: v })
      .eq("id", user.id)
      .then(() => refreshProfile());
  }

  const initial = (profile?.display_name || user?.email || "A").charAt(0).toUpperCase();

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-[420px] mx-auto p-4 pb-12">
        {/* Page title */}
        <h1 className="text-xl font-semibold tracking-tight pt-1 mb-2">Settings</h1>

        {/* Profile card */}
        <section className="settings-profile">
          <div className="settings-avatar">{initial}</div>
          <div className="settings-profile-body">
            <div className="settings-profile-name">{profile?.display_name || "No name set"}</div>
            <div className="settings-profile-email">{user?.email ?? "—"}</div>
          </div>
          <button
            type="button"
            className="settings-edit-btn"
            onClick={() => setEditingName(true)}
          >
            Edit
          </button>
        </section>

        {/* Defaults by water type */}
        <div className="settings-section-label">Defaults by water type</div>
        <div className="settings-water-grid">
          <div className="settings-water-card settings-water-still">
            <div className="settings-water-label">Stillwater</div>
            <div className="settings-water-value">
              {stillSpecies} · {stillRod}# · {stillLine}
            </div>
          </div>
          <div className="settings-water-card settings-water-river">
            <div className="settings-water-label">River</div>
            <div className="settings-water-value">
              {riverSpecies} · {riverRod}# · {riverLine}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="settings-row-link"
          onClick={() => setEditingDefaults(true)}
        >
          <div className="settings-row-label">Edit water defaults ›</div>
          <div className="settings-row-help">
            Stillwater and river are seeded from profile setup; editable here.
          </div>
        </button>

        {/* Diary behaviour */}
        <div className="settings-section-label">Diary behaviour</div>

        <div className="settings-row">
          <div className="settings-row-main">
            <div className="settings-row-label">Daily keep limit</div>
            <div className="settings-row-help">
              Catches default to Kept until this many in a session. 0 = no limit.
            </div>
          </div>
          <div className="settings-row-control" style={{ width: 64 }}>
            <Input
              type="number"
              min={0}
              value={keepLimit}
              onChange={(e) => setKeepLimit(e.target.value)}
              onBlur={saveBehaviour}
              className="h-9 text-center"
            />
          </div>
        </div>

        <ChipSettingRow
          label="Default size mode"
          help="What you record each catch as."
          value={sizeMode}
          options={["weight", "length"]}
          onSelect={(v) => { setSizeMode(v as "weight" | "length"); setTimeout(saveBehaviour, 0); }}
        />

        <ChipSettingRow
          label="Default size units"
          help="Imperial or metric."
          value={sizeUnits}
          options={["imperial", "metric"]}
          onSelect={(v) => { setSizeUnits(v as "imperial" | "metric"); setTimeout(saveBehaviour, 0); }}
        />

        <div className="settings-row">
          <div className="settings-row-main">
            <div className="settings-row-label">Ask before deleting</div>
            <div className="settings-row-help">Confirm dialog on event + session deletes.</div>
          </div>
          <div className="settings-row-control">
            <Switch checked={confirmDelete} onCheckedChange={handleConfirmDeleteToggle} aria-label="Ask before deleting sessions" />
          </div>
        </div>

        {/* Appearance */}
        <div className="settings-section-label">Appearance</div>

        <ChipSettingRow
          label="Theme"
          help="Day, dusk, or match your phone."
          value={theme}
          options={["day", "dusk", "system"]}
          onSelect={(v) => persistAppearance({ theme: v as typeof theme })}
        />

        <div className="settings-row">
          <div className="settings-row-main">
            <div className="settings-row-label">Reduce motion</div>
            <div className="settings-row-help">
              Disables the session-active pulse and slide-in cards.
            </div>
          </div>
          <div className="settings-row-control">
            <Switch
              checked={reduceMotion}
              onCheckedChange={(v) => persistAppearance({ reduceMotion: v })}
              aria-label="Reduce motion"
            />
          </div>
        </div>

        {/* Gear */}
        <div className="settings-section-label">Gear</div>
        {/* TODO: preset rigs UI in 3-col grid (deferred — uses .settings-presets styles) */}
        <NavRow
          icon={<ListChecks className="h-4 w-4" />}
          label="Preset rigs"
          sub="Manage saved rigs (rod + line + leader)"
          onClick={() => navigate("/diary/settings/setups")}
        />

        {/* Data */}
        <div className="settings-section-label">Data</div>
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
        <div className="settings-section-label">Help</div>
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
        {/* TODO: unsynced warning on sign-out (no offline queue infra yet) */}
        <div className="pt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/40 hover:bg-destructive/5"
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of It's Catching?</AlertDialogTitle>
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

        <p className="text-center text-[11px] text-muted-foreground pt-4">
          It's Catching · v{APP_VERSION}
        </p>
      </div>

      {/* Edit name dialog */}
      <Dialog open={editingName} onOpenChange={setEditingName}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit display name</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dn">Display name</Label>
            <Input
              id="dn"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
              placeholder="Your name"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">2–30 characters.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingName(false)}>Cancel</Button>
            <Button onClick={saveDisplayName} disabled={savingName}>
              {savingName ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit water defaults dialog */}
      <Dialog open={editingDefaults} onOpenChange={setEditingDefaults}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Water-type defaults</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="settings-water-card settings-water-still">
              <div className="settings-water-label">Stillwater</div>
              <ChipRow label="Species" value={stillSpecies} options={SPECIES_OPTIONS} onSelect={setStillSpecies} />
              <ChipRow label="Rod weight" value={stillRod} options={ROD_WEIGHTS} onSelect={setStillRod} suffix="#" />
              <ChipRow label="Usual line" value={stillLine} options={LINE_OPTIONS} onSelect={setStillLine} />
            </div>
            <div className="settings-water-card settings-water-river">
              <div className="settings-water-label">River</div>
              <ChipRow label="Species" value={riverSpecies} options={SPECIES_OPTIONS} onSelect={setRiverSpecies} />
              <ChipRow label="Rod weight" value={riverRod} options={ROD_WEIGHTS} onSelect={setRiverRod} suffix="#" />
              <ChipRow label="Usual line" value={riverLine} options={LINE_OPTIONS} onSelect={setRiverLine} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDefaults(false)}>Cancel</Button>
            <Button onClick={saveDefaults} disabled={savingDefaults}>
              {savingDefaults ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
      className="w-full flex items-center gap-3 rounded-lg border border-border bg-card hover:bg-muted/40 px-3 py-2.5 text-left transition-colors mb-2"
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

function ChipSettingRow({
  label,
  help,
  value,
  options,
  onSelect,
}: {
  label: string;
  help: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-main">
        <div className="settings-row-label">{label}</div>
        <div className="settings-row-help">{help}</div>
      </div>
      <div className="settings-row-control flex flex-wrap gap-1.5 justify-end max-w-[55%]">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs border transition-colors capitalize",
              value === opt
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
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
    <div className="space-y-1.5 mt-2">
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
