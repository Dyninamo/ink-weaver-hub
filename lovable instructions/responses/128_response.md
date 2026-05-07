# Lovable response — Prompt 128

**Prompt file:** `lovable instructions/128_2026-05-07_RESPONSE_CAPTURE_PROTOCOL.md`
**Applied:** 2026-05-07
**Status:** applied (with one caveat — see "Anything else")

## Pre-flight check

Skipped — no pre-flight required by prompt.

## Changes applied

- Created directory `lovable instructions/responses/`.
- Created `lovable instructions/responses/README.md` with the convention blurb.
- Copied the prompt itself into the repo at `lovable instructions/128_2026-05-07_RESPONSE_CAPTURE_PROTOCOL.md` (it was uploaded, not previously committed).
- Created this response file `lovable instructions/responses/128_response.md`.
- No DB / migration / edge-function / frontend changes.

## Errors / warnings

None.

## Verification ran

1. `mkdir -p "lovable instructions/responses"` → exit 0.
2. `ls "lovable instructions/"` → shows `responses`.
3. README + 128_response.md written.

## Follow-up options I offered

- Adopt protocol from prompt 129 onward (default — nothing more needed).
- Backfill stubs for 122/123/125 if you confirm those prompt numbers/filenames — I don't have them in repo or context.
- Add a tiny lint script that fails CI if a prompt file lands without a matching `<NNN>_response.md`.
- Extend protocol to also dump `supabase--linter` output into the response file automatically when a migration runs.

## Anything else Claude Code should know

**Important caveat re: git commits.** Lovable's environment does not let
the agent run `git add` / `git commit` — version control is managed
automatically by the Lovable harness when files change. So step 2B of the
protocol ("commits should batch the migration AND the response file in a
single commit") will be honoured implicitly: both files are written in
the same agent turn, so they will land together in whatever commit the
harness produces. The agent cannot author the commit message in the exact
`<NNN>: <summary>` format requested — that string lives in this response
file instead.

**Backfill of 122 / 123 / 125 not done.** Those prompt files are not in
the repo (`lovable instructions/` only contained the `responses/` dir
after creation) and their chat history is not in current context. Per
the prompt, stubs are "better than nothing" but I'd rather not invent
content. If you drop the three prompt files into `lovable instructions/`
I'll write proper retroactive stubs in a follow-up turn.
