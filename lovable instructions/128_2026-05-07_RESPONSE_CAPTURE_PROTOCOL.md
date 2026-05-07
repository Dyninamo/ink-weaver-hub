# Lovable Prompt 128 — Response capture protocol (commit replies to git, don't ask me to paste)

**Context:** I work with Lovable on this Supabase project and a separate
Claude Code agent on the SQLite/Python pipeline side. Today the only way
Claude Code knows what you did is for me to copy-paste your chat reply
into Claude Code. That's fragile (truncation, formatting loss, missed
follow-up options) and slow.

This prompt establishes a one-time **response-capture protocol** so every
future Lovable prompt leaves a self-contained log file in the repo that
Claude Code can read directly. After this lands, my workflow becomes:

1. I send a Lovable prompt
2. Lovable applies the change AND writes a structured response file
3. Lovable commits both in the same change
4. Claude Code does `git pull` and reads the response file — no paste

---

## Required changes

### 1. Create the response directory

```bash
mkdir -p "lovable instructions/responses"
```

Add a one-line `README.md` inside it explaining the convention:

```markdown
# Lovable response logs

One file per applied Lovable prompt, named `<NNN>_response.md` where `<NNN>`
matches the prompt number. Written by Lovable at the end of each prompt
following the protocol in `128_2026-05-07_RESPONSE_CAPTURE_PROTOCOL.md`.

Read these instead of pasting Lovable's chat reply.
```

Commit with a message like `Add lovable response log directory + convention`.

### 2. Adopt this protocol for every future prompt

For every prompt I send from now on, before completing your work and
returning control to me:

#### A. Write a response file

Path: `lovable instructions/responses/<NNN>_response.md`, where `<NNN>` is
the three-digit prompt number from the prompt's filename (e.g. `129`,
`130`, …).

Use this exact template — it's parsed by Claude Code:

```markdown
# Lovable response — Prompt <NNN>

**Prompt file:** `lovable instructions/<NNN>_<DATE>_<NAME>.md`
**Applied:** <ISO timestamp>
**Status:** applied | partially applied | aborted

## Pre-flight check

<paste the grep / sanity-check output verbatim, or "skipped — no pre-flight
required by prompt">

## Changes applied

<one bullet per ALTER / DROP / CREATE / file-edit. Include the SQL
verbatim for migrations. For frontend/edge-function edits, list the files
touched and the rough nature of each change.>

## Errors / warnings

<every warning, every error, even "linter warnings unrelated to this prompt".
If pre-existing warnings, count them; don't quote them all.>

## Verification ran

<each step from the prompt's Verification section, with the result>

## Follow-up options I offered

<the 4 (or however many) follow-ups you'd suggest in chat — I want them
captured here too. One bullet each, terse, no marketing copy.>

## Anything else Claude Code should know

<rare. E.g. "this also bumped a Supabase types file at <path>" or "RLS
inheritance worked but I noticed policy X may need review separately".>
```

#### B. Commit the response file in the same change

Lovable commits should batch the migration / code edit AND the response
file in a single commit. Commit message format:

```
<NNN>: <one-line summary of what the prompt did>

(See lovable instructions/responses/<NNN>_response.md for full log.)
```

If the prompt didn't trigger any other code changes (e.g. it was pure SQL
via `supabase migration`), the response file alone is fine in its own
commit.

#### C. After committing, return a one-line confirmation in chat

Just: *"Applied, response logged to `lovable instructions/responses/<NNN>_response.md`."*

No need to repeat the response in the chat reply — it's already in the
file. This is the bit that saves me the paste.

### 3. Backfill the most recent responses

For prompts already applied this week — **122, 123, 125** — write the same
response files retroactively from your chat history if you still have it.
Use what you remember; it's better than nothing. If a prompt's chat is no
longer in your context, write a stub:

```markdown
# Lovable response — Prompt <NNN>

**Status:** applied (logged retroactively, original chat reply not preserved)

## Notes

Prompt was applied prior to the response-capture protocol. See the prompt
file itself for the change set; live DB schema reflects what shipped.
```

Don't backfill prompts older than this week — diminishing returns.

---

## Verification

1. **Directory exists** with the README:
   ```bash
   ls "lovable instructions/responses/"
   # expect: README.md  122_response.md  123_response.md  125_response.md
   ```

2. **Pull from Claude Code side** and read one of the backfilled files:
   ```bash
   git pull
   cat "lovable instructions/responses/125_response.md"
   ```
   Should show structured Markdown matching the template, with whatever
   detail you have for prompt 125.

3. **Next live prompt** (likely 126 or 127): when I send it, verify the
   response file appears in the repo before you return control.

---

## Why this matters

I run two agents in parallel — a SQLite/Python pipeline agent on the
desktop, and you on the cloud. The pipeline agent needs to know what you
did to make consistent decisions (e.g. master-side ALTERs to mirror your
Supabase ALTERs). When the pipeline agent has to ask "what did Lovable
say about prompt 125?" the answer should be a `cat` away, not a 10-minute
copy-paste round trip. This is plumbing that pays back from prompt 129
onward.
