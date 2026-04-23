import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ChangeField =
  | "fly"
  | "line"
  | "leader"
  | "style"
  | "droppers"
  | "retrieve"
  | "rod";

interface ChangeWhatPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (field: ChangeField) => void;
}

const FIELD_CARDS: { value: Exclude<ChangeField, "rod">; label: string; sub: string }[] = [
  { value: "fly", label: "Fly", sub: "Swap a pattern" },
  { value: "line", label: "Line", sub: "Density / profile" },
  { value: "leader", label: "Leader", sub: "Tippet section" },
  { value: "style", label: "Style", sub: "Buzzer · Dry · …" },
  { value: "droppers", label: "Droppers", sub: "Cast structure" },
  { value: "retrieve", label: "Retrieve", sub: "How you fish it" },
];

export default function ChangeWhatPicker({
  open,
  onClose,
  onPick,
}: ChangeWhatPickerProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>What's changing?</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2.5">
          {FIELD_CARDS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={cn(
                "rounded-lg border border-border p-3 text-left",
                "hover:border-foreground/40 hover:bg-muted/40 transition-colors",
                "min-h-[68px] flex flex-col justify-center gap-0.5"
              )}
              onClick={() => onPick(f.value)}
            >
              <span className="text-sm font-medium">{f.label}</span>
              <span className="text-[11px] text-muted-foreground">{f.sub}</span>
            </button>
          ))}
        </div>

        {/* Rod card — full width, gild-tinted */}
        <button
          type="button"
          className={cn(
            "rounded-lg border-2 p-3.5 text-left mt-2",
            "border-[hsl(var(--gild,42_70%_55%))]/40 bg-[hsl(var(--gild,42_70%_55%))]/8",
            "hover:bg-[hsl(var(--gild,42_70%_55%))]/15 transition-colors",
            "flex flex-col gap-0.5"
          )}
          onClick={() => onPick("rod")}
        >
          <span className="text-sm font-semibold">Set up a new rod</span>
          <span className="text-[11px] text-muted-foreground">
            Keeps Rod 1 in history
          </span>
        </button>
      </DialogContent>
    </Dialog>
  );
}
