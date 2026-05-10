# 161 — Mobile density pass: tighten unconditional desktop padding/spacing

## Scope (per ask)
User-facing pages with `space-y-6/8`, `p-6/8`, `gap-6/8`, `mb-8`, `mt-8`, `py-6/8` applied unconditionally. Diary active-session components (CatchFlow, EndPill, ActiveSessionShell, AskGhillieOverlay, BlankFlow, ChangeFlow, LostFlow, ReadyView) audited and **already tight** (`p-3`/`p-4`, `space-y-4`/`space-y-5`) — no edits there. Admin pages skipped (DEV/admin-only).

## Changes — all add `md:` breakpoint, mobile shrinks, desktop preserved

### `src/pages/Landing.tsx`
- Hero subtitle: `text-lg → text-base md:text-lg`, `mb-8 → mb-5 md:mb-8`
- Hero CTAs: `text-lg px-8 → text-base md:text-lg px-6 md:px-8`
- Sections: `py-20 → py-12 md:py-20`, h2 `mb-12 → mb-8 md:mb-12`, `mb-6 → mb-4 md:mb-6`, p `mb-8 → mb-5 md:mb-8`
- Feature cards (×4): `p-6 → p-4 md:p-6`, icon `w-12 h-12 → w-10 h-10 md:w-12 md:h-12`, title `text-xl → text-lg md:text-xl`, body `text-muted-foreground → text-sm md:text-base text-muted-foreground`
- Card grid `gap-6 → gap-4 md:gap-6`
- CTA button `text-lg px-8 → text-base md:text-lg px-6 md:px-8`

### `src/pages/Dashboard.tsx`
- Header `py-6 → py-4 md:py-6`
- CardContent `space-y-6 → space-y-4 md:space-y-6`
- Recent Queries section `mt-8 → mt-6 md:mt-8`
- Skeleton + query cards `p-6 → p-4 md:p-6`
- Empty state card `p-12 → p-6 md:p-12`

### `src/pages/ShareView.tsx`
- main `py-8 → py-5 md:py-8`
- CardContent `space-y-6 → space-y-4 md:space-y-6`
- Footer `mt-8 → mt-6 md:mt-8`

### `src/pages/SessionShareView.tsx`, `src/pages/GroupJoinView.tsx`
- Card empty/CTA `py-8 → py-6 md:py-8` (×3 across the two files)

### `src/pages/PasswordReset.tsx`, `src/pages/ResetPassword.tsx`
- Logo block `mb-8 → mb-5 md:mb-8`

### `src/components/social/NotableFishDialog.tsx`
- Photo dropzone `p-8 → p-5 md:p-8`

## Skipped (intentional)
- `py-6/8` empty-state placeholders (`Loading…`, `No replies yet`, `No fish caught yet`) in ThreadView, GroupsFeedTab, GroupDetail, ManageAffiliations, DiarySetups, DiaryEntry, RodPickerSheet, VenuePickerOverlay, DiaryAutocomplete — those are intentionally airy fillers, not wasted space around real content.
- Admin pages (`AdminUpload`, `AdminDbStatus`, `AdminTestAdvice`, `AdminRecompute`, `AdminVenueSubmissions`) — admin-only, desktop-first OK.
- Diary active-session components — already mobile-optimised per prompts 158/159 audit.
- `Leaderboard pb-8` — single bottom-page padding, leave.

## Verification
TypeScript clean (no logic changes; tailwind class swaps only). Visual smoke deferred to user — diary active-session UX unchanged.
