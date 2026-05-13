# 183 — Re-apply 179 §4/§5/§6 + Timeline got_away + ChangeFlow droppers

## Status: NO-OP (all sections already applied)

Audit confirms every change in 183 is present in HEAD. Likely landed as part of the 184–187 batch which touched the same files. Verified file:line below.

## Verification

- §1 SetupWizard preset-name label — `src/components/diary/setup/SetupWizard.tsx:719` `<Label htmlFor="preset-name">Name this rig (optional)</Label>` + `<Input id="preset-name" …>` at L721.
- §2 ChangeFlow auto-save on FlyPicker Add — `src/components/diary/ChangeFlow.tsx:56` `lastAutoSavedRef`, L86–96 auto-save effect with fingerprint guard, resets at L72 (`pickField`) and L82 (`backToPicker`). Bottom action row gated `field !== "fly"` at L372–385; "Saving…" placeholder L387–389. Why input duplicated: above editor for fly (L336–346), below for other fields (L360–370).
- §3 PHASES_WITH_PILL — `src/components/diary/ActiveSessionShell.tsx:41` `new Set<SessionPhase>(["ready"])`.
- §4 Timeline got_away body — `src/pages/DiaryEntry.tsx:535–550` renders `Lost · <stage> · <fly> #<size>` exactly as specified.
- §5 ChangeFlow droppers branch — `ChangeFlow.tsx:178–189` writes `fromBlob.droppers` / `toBlob.droppers` and `next.dropper_count`. `KNOWN_KEYS` in `DiaryEntry.tsx:211` includes `'droppers'`.
- §6 FlyChangeEditor `positionsForFlyCount` — `ChangeFlow.tsx:491–498` uses `dropper_count + 1` with filled-count fallback; legacy empty-state block removed.

No code changes needed this turn.
