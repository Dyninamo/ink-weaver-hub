# 158 — Mobile-first typography pass

## Pre-flight counts
- text-3xl/4xl/5xl: 11
- text-2xl: 20
- responsive prefixes (sm:/md:/lg: text-): 11

## §1 — Page sweep (className-only diffs)
Rule: shrink one tier on mobile, restore at `md:`.

- `src/pages/DiaryNew.tsx` — no oversized headings present; nothing to change.
- `src/pages/Diary.tsx:211` — h1 `text-3xl` → `text-2xl md:text-3xl`.
- `src/pages/Auth.tsx:121` — h1 `text-3xl` → `text-2xl md:text-3xl`.
- `src/pages/PasswordReset.tsx:75`, `ResetPassword.tsx:107` — h1 `text-3xl` → `text-2xl md:text-3xl`.
- `src/pages/Landing.tsx`:
  - hero h1 (24): `text-4xl md:text-6xl` → `text-3xl md:text-6xl` (kept dramatic at desktop).
  - section h2s (54, 105, 129): `text-3xl md:text-4xl` → `text-2xl md:text-4xl`.
- `src/pages/Results.tsx:257` — `text-4xl` → `text-3xl md:text-4xl`.
- `src/pages/NotFound.tsx:14` — `text-4xl` → `text-3xl md:text-4xl`.
- `src/pages/Dashboard.tsx:236, 287` — `text-2xl` → `text-xl md:text-2xl`.
- `src/pages/ShareView.tsx:177` — CardTitle `text-2xl` → `text-xl md:text-2xl`.
- `src/pages/AdminVenueSubmissions.tsx`:123 `text-2xl` → `text-xl md:text-2xl`; :149 `text-3xl` → `text-2xl md:text-3xl`.

## §2 — CatchFlow numeric inputs
- `src/components/diary/CatchFlow.tsx:491, 505` — `text-2xl font-mono` → `text-xl md:text-2xl font-mono`. `h-12` preserved (tap target).

## §3 — Token-level scale
Deferred per spec ("skip this step on first pass"). `src/styles/tokens.css` untouched.

## Skipped / out of scope
- Other diary children (BlankFlow / LostFlow / ChangeFlow / ReadyView / EndPill / EndSession* / Ask Ghillie / VenuePicker / RodPicker / SetupCascade / FlyPicker / LeaderPicker / SpotPicker) — none use text-2xl+ headings; nothing to retire.
- Admin pages beyond AdminVenueSubmissions, Manager portal, AdminUpload — out of scope.

## Verification
Class-string-only edits across 11 files; no layout, state, or logic changes. Visual smoke on phone vs desktop deferred to user per §Verification in the prompt.
