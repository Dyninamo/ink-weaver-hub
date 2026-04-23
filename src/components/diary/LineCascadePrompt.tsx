import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface LineCascadePromptProps {
  open: boolean;
  onClose: () => void;
  newLineName: string;
  currentLeader?: string | null;
  currentFlies?: string | null;
  onContinue: (opts: { updateLeader: boolean; updateFlies: boolean }) => void;
}

export default function LineCascadePrompt({
  open,
  onClose,
  newLineName,
  currentLeader,
  currentFlies,
  onContinue,
}: LineCascadePromptProps) {
  const [updateLeader, setUpdateLeader] = useState(false);
  const [updateFlies, setUpdateFlies] = useState(false);

  // Update flies implies leader — keep them coherent
  function handleFliesToggle(v: boolean) {
    setUpdateFlies(v);
    if (v && !updateLeader) setUpdateLeader(true);
  }

  const ctaLabel =
    updateLeader && updateFlies
      ? "Update leader → flies ›"
      : updateLeader
      ? "Update leader ›"
      : "Keep as-is";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Switching to {newLineName}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Want to update the rest of your rig too?
        </p>

        <div className="space-y-3 mt-2">
          <div className={cn("flex items-center justify-between rounded-lg border border-border p-3")}>
            <div>
              <div className="text-sm font-medium">Leader</div>
              <div className="text-xs text-muted-foreground">
                {currentLeader || "Not set"}
              </div>
            </div>
            <Switch checked={updateLeader} onCheckedChange={setUpdateLeader} />
          </div>

          <div className={cn("flex items-center justify-between rounded-lg border border-border p-3")}>
            <div>
              <div className="text-sm font-medium">Flies</div>
              <div className="text-xs text-muted-foreground">
                {currentFlies || "Not set"}
              </div>
            </div>
            <Switch checked={updateFlies} onCheckedChange={handleFliesToggle} />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onContinue({ updateLeader, updateFlies })}
            className="flex-1 h-11 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90"
          >
            {ctaLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
