# 221 — Fix: advice card renders literal markdown (`/results`)

**Live bug.** The AI advice on the Results page shows raw markdown: the `#`
heading renders as a literal `# Rutland Water — …` and `**bold**` shows literal
asterisks in the section bodies.

## Cause
`src/pages/Results.tsx` hand-rolls a mini-markdown parser (~lines 105–140): it
splits sections on `^## ` and only applies a `**bold**` regex to the *preamble*
lines — text inside each `## section` is rendered as plain
`whitespace-pre-wrap`, so its `**bold**` is never converted. The advice's
top-level `#` (h1) title isn't handled at all (only `##`).

## Fix
Replace the bespoke parser with a real markdown renderer:
- Add **`react-markdown`** (+ `remark-gfm` for lists/tables) as a dependency.
- Render `advice` (the resolved `v2?.advice ?? v1?.advice ?? state.advice_text`)
  through `<ReactMarkdown remarkPlugins={[remarkGfm]}>`.
- Map the elements to the existing card styling (heading sizes, paragraph =
  `text-sm text-muted-foreground leading-relaxed`, bold = semibold, lists
  indented). Keep the current card chrome around it.
- Remove the `text.split(/^## /m)` / `(\*\*[^*]+\*\*)` logic.

Apply the same renderer to **Ask-the-Ghillie** answers only if they show the
same artifact (they looked clean in testing — leave alone if so).

## Verify
- Generate advice for any venue → the `#`/`##` headings render as styled
  headings and `**bold**` renders bold, with **no literal `#` or `*`** anywhere.
- Lists/bullets (if present) render as a list, not raw `-`.
