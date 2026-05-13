# 184 — Mobile button & ledger compaction

## Diff
- `src/index.css` lines 190-206 (.ready-hero) — padding 12/24→8/16; .hero-count 112px→80px; .hero-label 13px font added; .hero-meta margin 10px→8px, font 13→12px.
- `src/index.css` lines 236-291 (.rod-summary, .ledger) — rod-summary cols 62→56px, padding 18→12px, gap 16→14px, line 15→14px, flies 13→12px; ledger cols 4 40 1fr 18→4 32 1fr 18, gap 16→12, padding 18/20→10/16, min-height 72→56, icon 40→32, label 18→15, hint added font-size 11px, chev 18→16px.
- `src/components/diary/CatchFlow.tsx` lines 376/403 56→48px; 442/457/495/545/569 40→44px (594 already 44).
- `src/components/diary/setup/SetupWizard.tsx` line 289 280→220px scroll floor; 367/389 52→48; 483 56→48; 554 52→44; 582 56→48; 636 60→52.

## Out of scope
- §6 event-cta / event-chip rules — kept as-is.
- §7 ChangeFlow field-picker 68px — kept.
- shadcn `<Button>` primitive — untouched.

## Verification
TS clean. All interactive elements remain ≥ 44 CSS px. Visual smoke deferred to user (live preview).
