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
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  includeFlies: boolean;
  onIncludeFliesChange: (v: boolean) => void;
  onSkip: () => void;
  onSave: () => void;
}

export default function SaveRigPromptDialog({
  open, onOpenChange, name, onNameChange,
  includeFlies, onIncludeFliesChange, onSkip, onSave,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save this rig for next time?</AlertDialogTitle>
          <AlertDialogDescription>
            Saved rigs appear at the top of the wizard so you can re-use them with one tap.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="save-prompt-name">Rig name</Label>
            <Input
              id="save-prompt-name"
              autoFocus
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Buzzer 3-fly stillwater"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Switch
              id="save-prompt-include-flies"
              checked={includeFlies}
              onCheckedChange={onIncludeFliesChange}
            />
            <Label htmlFor="save-prompt-include-flies" className="cursor-pointer">
              Include today's fly choices in the saved rig
            </Label>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onSkip}>Skip — just start</AlertDialogCancel>
          <AlertDialogAction onClick={onSave}>Save it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
