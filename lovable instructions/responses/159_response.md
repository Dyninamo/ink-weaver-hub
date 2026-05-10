# 159 — Mobile density pass

## Pre-flight
- `tokens.json` does NOT exist anywhere in the repo — `tokens.css` is the de facto source. Edited `tokens.css` directly (header still claims "DO NOT EDIT — generated from tokens.json" but no source exists; left header alone, added inline comment on the new media block).
- Diary-flow padding audit: `rg -n 'p-6|p-8|space-y-6|space-y-8|gap-6|gap-8' src/pages/DiaryNew.tsx src/pages/Diary.tsx src/components/diary/` returned **zero hits**. The PWA diary surfaces already use `p-4` / `space-y-5` (e.g. `DiaryNew.tsx:312, 328`). §C is therefore a no-op — already mobile-tight. Skipped.
- Heaviest `p-6` users are shadcn primitives (Card, Sheet, Dialog) and admin/manager pages — out of scope per the prompt.

## §A — tokens.css mobile/desktop split
- `:root` Type block: `--font-size-xs` 11→10, `sm` 13→12, `base` 15→14, `md` 16→15, `lg` 18→16, `xl` 22→19, `2xl` 26→22, `3xl` 30→26, `4xl` 34→30, `5xl` 38→34, `--font-size-score` 96→84.
- Appended `@media (min-width: 768px) { :root { ... } }` block restoring all original sizes. Desktop unchanged from pre-159.

## §B — index.css html font-size
- Inserted block right after `@tailwind utilities;`:
  ```css
  html { font-size: 87.5%; }
  @media (min-width: 768px) { html { font-size: 100%; } }
  ```
- Uses %-based scaling so OS/browser font-size preference is respected (per accessibility caveat in the prompt).

## §C — Diary container padding
- **Skipped.** Pre-flight grep confirmed diary flow already uses `p-4` / `space-y-5`. No `p-6`/`p-8`/`space-y-6`/`space-y-8`/`gap-6`/`gap-8` substitutions made.

## §D — Tap targets
- No defensive `min-h-[44px]` added. Existing primary buttons in DiaryNew already carry `min-h-[52px]` / `min-h-[44px]` and remain in `px`, so §B rem shrinkage does not affect them. Standard shadcn `<Button>` default `h-10` becomes ~35px on phone — flagged for follow-up if the user reports tap-target shrinkage on secondary actions.

## Verification
TypeScript compiles. Live phone smoke deferred to user per §Verification in prompt.

## Out of scope / unchanged
- `tokens.json` regen — file doesn't exist.
- Diary container padding — already tight.
- Manager portal, Landing hero — explicitly excluded.
