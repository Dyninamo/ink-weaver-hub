import { Button } from "@/components/ui/button";
import { readPresetRod, type PresetRow } from "./presetSchema";

interface Props {
  presets: PresetRow[];
  onPickExisting: (p: PresetRow) => void;
  onPickNew: () => void;
  onCancel: () => void;
}

export default function ChooserView({ presets, onPickExisting, onPickNew, onCancel }: Props) {
  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Pick a rig</h3>
          <p className="text-sm text-muted-foreground">
            Tap a saved rig to use it, or create a new one from scratch.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground px-1">
          Your saved rigs
        </div>
        <ul role="list" className="space-y-2">
          {presets.map((p) => {
            const rod = readPresetRod(p.rod);
            const subtitle = [
              rod.rodWeight ? `#${rod.rodWeight}` : null,
              rod.lineProfile,
              rod.style,
              `${rod.flyCount}-fly`,
            ].filter(Boolean).join(" · ");
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPickExisting(p)}
                  aria-label={`Apply saved rig "${p.name}", ${subtitle}`}
                  className="w-full text-left px-4 py-3 rounded-lg border bg-card hover:border-primary transition-colors"
                >
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="pt-2">
        <Button variant="outline" className="w-full" onClick={onPickNew}>
          Create new rig
        </Button>
      </div>
    </div>
  );
}
