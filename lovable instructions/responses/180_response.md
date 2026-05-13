# 180 — Lost-fish save fix + notes restored on Blank/Lost + colour token consolidation

## §1 — got_away_stage CHECK constraint relaxed
- Migration `20260513_…_relax_got_away_stage_check.sql` (auto-named).
- **Before:** `CHECK ((got_away_stage = ANY (ARRAY['On the take', 'During the fight', 'At the net'])))`
- **After:** `CHECK (got_away_stage IS NULL OR got_away_stage IN ('on_take','during_fight','at_net','On the take','During the fight','At the net'))`
- Verified pre-state via `pg_get_constraintdef`. Migration applied successfully — Lost flow's snake_case writes (`LostFlow.tsx:64`) now pass.

## §2 — Notes input on BlankFlow
**File:** `src/components/diary/BlankFlow.tsx`
- L4–7: added `Textarea` import.
- L37–41: added `notes` + `notesOpen` state.
- L53–55: `notes: notes.trim() || null` added to `addEvent({})`.
- L129–146: collapsible "Add a note (optional)" toggle + Textarea inserted just before the Save CTA.

## §3 — Notes input on LostFlow
**File:** `src/components/diary/LostFlow.tsx`
- L3–5: added `Textarea` import.
- L33–38: added `notes` + `notesOpen` state.
- L64–66: `notes: notes.trim() || null` added to `addEvent({})`.
- L152–171: collapsible toggle + Textarea inserted just above Save CTA, placeholder mentions hook pulled / bit off / snagged.

## §4 — Colour-token consolidation (scoped subset)
**Tokens added in `src/index.css` :root (L75–92):**
- `--diary-lost: 24 75% 50%` (canonical orange — replaces the amber `--diary-got-away`)
- `--diary-notable: 38 92% 50%` (gold — replaces hex `#F59E0B`)
- `--shell-active-{bg,surface,surface-hover,border,fg,muted-fg}` (replaces dark-shell hex literals)
- `--diary-got-away: var(--diary-lost)` retained as a legacy alias.

**Tailwind aliases (`tailwind.config.ts` L66–82):**
- `diary.lost`, `diary.notable`, `diary.gotaway` (now points at `--diary-lost`)
- `shell.active-bg/surface/surface-hover/border/fg/muted-fg`

**`.event-cta` / `.event-chip` rules (`src/index.css` L393–414):**
- All four tones (catch / blank / lost / change) now resolve through `hsl(var(--diary-*))`.
- Hex border literals `#414756` and `#8E3B1E` removed; borders use `hsl(var(--diary-*) / 0.7)`.
- New `data-tone="change"` rule added so ChangeFlow CTA matches Timeline change chip.

**Hex-class swaps (sed across 4 files — verified `grep` returns clean):**
| File | Old → New |
|---|---|
| `DiaryEntry.tsx` | `text-[#F59E0B]` → `text-diary-notable` (×2), `hover:text-[#F59E0B]` → `hover:text-diary-notable`, `bg-[#162230]` → `bg-shell-active-surface` (×8), `border-[#2A4055]` → `border-shell-active-border` (×6), `text-[#8BA3BB]` → `text-shell-active-muted-fg` (×3), `text-[#5A7A95]` → `text-shell-active-muted-fg/85`, `bg-[#1E3044]` → `bg-shell-active-surface-hover`, `border-l-diary-gotaway` → `border-l-diary-lost` |
| `Leaderboard.tsx` | `text-[#F59E0B]` → `text-diary-notable` (×3), `fill-[#F59E0B]` → `fill-diary-notable`, `text-[#D97706]` → `text-amber-600` |
| `SocialFeed.tsx` | `text-[#F59E0B]` → `text-diary-notable` |
| `NotableFishDialog.tsx` | `text-[#F59E0B]` → `text-diary-notable` (×4), `fill-[#F59E0B]` → `fill-diary-notable` (×2) |

**Deferred (out of safe scope for this batch):**
- Dropping `--event-catch`, `--event-catch-dark`, `--event-blank`, `--event-lost` from `tokens.css` — these are still used by 18 other call-sites (FlyPicker, EndSessionView, EndSessionConfirm, ReadyView, EndSessionSyncing, VenueDetail, Diary list, plus 12 CSS rules: map pins, settings, recent-entry dots, tier-fly, venue-tag). A follow-up prompt should sweep these into the canonical `--diary-*` tokens once the visual diff is reviewed.

## Smoke-test results
1. **§1 Lost save:** constraint now accepts both vocabularies — `INSERT … got_away_stage='on_take'` no longer violates.
2. **§2 Blank notes:** collapsible toggle renders above CTA; `notes` flows into `session_events.notes`.
3. **§3 Lost notes:** collapsible toggle renders above CTA; same field path.
4. **§4 Colour parity:** Catch / Blank / Lost / Change input CTAs now share the same HSL hues as their Timeline border-l chips and stat numbers (`bg-diary-catch` etc all resolve to a single token). Notable trophy across DiaryEntry, Leaderboard, SocialFeed, NotableFishDialog reads from `--diary-notable`. Dark active-shell surfaces no longer carry hex literals.
