# Lovable Prompt 135 — Kill the Round 4 wizard UI from the PWA

**Context:** Verdict from feel-test (2026-05-08): the per-session setup
wizard is too heavy for real use. RN app's lighter session-start flow
is the canonical model. We're removing the wizard UI from the PWA so it
matches the RN footprint, while keeping the schema intact (the 12
setup-wizard columns and the `fly_lines` / `leaders` / `tippets`
reference tables stay for now — they'll be reused by the RN app's
upcoming setup-screen rebuild, which adds material picker, brown-trout
river default, user-extensible reference data).

This prompt **deletes the wizard UI only** — no schema changes, no
column drops, no route deletion. The `/diary/new` route stays but
becomes a thin one-page form matching what the RN app sends (venue,
date, time, fishing type, plan, rods, weather), without any of the
9-step setup wizard.

The follow-up prompts (136 schema migration for leader materials, RN
build for the setup screen) will deliver the captured-but-cleaner
replacement.

---

## Pre-flight check

```bash
grep -rIn -E "SetupWizard|DiaryNew|/diary/new" src/ supabase/functions/
```

Expected hits — these are all the references this prompt touches or removes:

1. `src/pages/DiaryNew.tsx` — the file being rewritten (Phase 2 wizard removed, Phase 1 header preserved as the entire page)
2. `src/components/diary/SetupWizard.tsx` — file being deleted
3. `src/App.tsx` — import + route, route stays, import to DiaryNew stays (it's the same file, just simpler)
4. `src/components/diary/EndSessionView.tsx:67` — CTA stays as-is
5. `src/layouts/AppShell.tsx:24, :64-65` — top-nav button + footer tab stay as-is
6. `src/manager/ManagerLayout.tsx:65` — dropdown link stays
7. `src/manager/pages/ManagerNoAccess.tsx:20` — link stays
8. `src/pages/Diary.tsx:244` — CTA stays
9. `src/pages/VenueDetail.tsx:491` — CTA with `?venue=` querystring stays (DiaryNew should still honour this)

If grep returns anything outside this list — particularly any other reader
of `SetupWizard` or any route that depends on the wizard — **stop and
report back**.

---

## Required changes

### 1. Delete `src/components/diary/SetupWizard.tsx`

Remove the file entirely.

### 2. Rewrite `src/pages/DiaryNew.tsx` to be just the Phase 1 header

The existing file has two phases (`"header"` and `"setup"`). Remove the
`"setup"` phase and the `<SetupWizard>` invocation. On submit, instead
of awaiting `WizardResult`, just call `createSession` with the header
fields directly (no wizard data) and navigate to `/diary/{id}`.

**Keep everything from the "header" phase as the new entire page**:
- Venue dropdown (loaded from `reports_enriched.venue`)
- Date / arrival time inputs
- Fishing type (Bank / Boat / Both)
- Plan textarea
- Rods (1-4)
- Weather details panel (optional, collapsible — keep the `<details>` element)
- Honours `?venue=Name` querystring from VenueDetail

**Remove**:
- `Phase` type and the `phase` state
- All `setPhase("setup")` calls
- The `<SetupWizard ... onComplete={handleStartSession}>` block
- `WizardResult` import and 11 of the 12 wizard-derived fields from the `createSession` payload (lines 122-133 in the current file): drop `rod_weight`, `rod_length_ft`, `leader_id`, `line_profile`, `tippet_length_ft`, `tippet_strength`, `tippet_unit`, `dropper_count`, `spot_name`, `size_mode`, `size_units`
- The "Initial setup change event" block (lines 137-155 in the current file) — without setup data there's nothing to record

**Keep**:
- The `createSession` call with the basic 16 header fields
- **`keep_limit` as a session-level field** — add a small numeric input on the new simplified form: label "Keep limit", placeholder "0 = catch & release", `<Input type="number" min={0} max={20}>`. Pass it through to `createSession` as `keep_limit: keepLimit`. This is the only wizard field that survives at session level — it's session-specific (varies by fishery rules) and doesn't change mid-session.
- The venue_id resolution from `venues_new`
- The `on-session-logged` edge function call (venue affiliation)
- The `find-venue-email` background call
- The toast + `refreshActiveSession()` + `navigate(\`/diary/\${session.id}\`)` outcome

**Simplify the Save button**: change "Next: Choose Setup" to "Start Session" with the play icon. Single click saves and navigates straight to DiaryEntry.

### 3. Fix the silent auth-failure footgun

In the existing file, `handleStartSession` opens with:

```ts
if (!user || !venue.trim()) return;
```

This silently returns on auth expiry — user clicks save, nothing happens, no message. Replace with explicit toasts:

```ts
if (!user) {
  toast.error("Please sign in again");
  navigate("/auth");
  return;
}
if (!venue.trim()) {
  toast.error("Pick a venue first");
  return;
}
```

### 4. No DB changes

Do **not** drop the 12 setup-wizard columns from `fishing_sessions`.
Do **not** delete the `fly_lines` / `leaders` / `tippets` tables. Both
will be reused by the RN app's setup-screen rebuild.

### 5. No type regeneration impact

The supabase types file already includes the 12 columns and the three
ref tables — those stay. Build should succeed without regenerating
types.

---

## Verification

1. **File gone**:
   ```bash
   ls src/components/diary/SetupWizard.tsx
   # expect: cannot access (file deleted)
   ```

2. **Import gone**:
   ```bash
   grep -rIn "SetupWizard" src/
   # expect: no matches
   ```

3. **`/diary/new` still loads** with the simplified form. Pre-fill from
   `?venue=Grafham%20Water` still works (VenueDetail's "Start session
   here" CTA).

4. **Build**: `npm run build` succeeds.

5. **End-to-end smoke**: log a session via the new simplified form.
   Confirm the row lands in `fishing_sessions` with the basic header
   fields populated and the 12 wizard columns NULL (matching RN
   app behaviour).

6. **9 CTAs unchanged**: each of the 9 inbound links to `/diary/new`
   still navigates correctly. None is broken.

---

## Out of scope (handled by separate prompts)

- **Adding `material` column to `leaders`** + the 5-value CHECK constraint
  (nylon / copolymer / mono / fluoro / furled): prompt 136
- **Brown trout default** for river venues (`user_profiles.river_default_species`):
  prompt 136
- **RN-app setup screen rebuild** with material chips and brown default:
  handled by the RN-app Claude Code agent, separate from Lovable.
- **Eventual drop of the 12 wizard columns from `fishing_sessions`**:
  parked. Decide after RN-app rebuild lands and we know which (if any)
  setup fields the new RN flow captures at session level vs per-event.

User-extensible reference tables (allowing users to add their own leader
brands / fly lines from inside the app) was considered and **dropped** —
ref tables stay admin-curated.

---

## Response capture

Per protocol prompt 128, log the outcome to
`lovable instructions/responses/135_response.md` in the same change.

If you find related surfaces I missed — particularly any styles in
`src/index.css` referenced only by `.wizard-*` classes that are now
orphaned — list them as **deferred deletions** in the response file. Do
not delete them this turn; surface them so I can decide if they go in
135 follow-up or with the schema work in 136.
