# 187 — Ghillie chip fly_name validation

## §1 Edge function (`supabase/functions/ask-ghillie/index.ts`)
- `ChipAction` interface gained optional `fly_name?: string`.
- System prompt instructs Anthropic that `swap_in` chips MUST include a canonical `fly_name` matching GROUND TRUTH list, or be skipped.
- Chip parse pass now filters non-objects, narrows fields, copies `fly_name` only on `swap_in` category, slices to 5.

## §2 Client (`src/components/diary/AskGhillieOverlay.tsx`)
- Loads `flies(name, aliases)` once into a lowercase Set on mount.
- `validatedChips` memo drops `swap_in` chips whose `fly_name` is unrecognised, logs `warning / ghillie_chip_no_fly_match` with chip label + fly_name.
- Older payloads without `fly_name` are kept (can't validate).
- Renders `validatedChips` and an italic "N suggestion(s) hidden — pattern not in your fly catalogue yet." note when chips were filtered.

## Cache note
- Existing 6h `user_queries` rows lack `fly_name`; they pass through the can't-validate branch and evict naturally.
