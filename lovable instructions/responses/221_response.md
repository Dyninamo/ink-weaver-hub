# 221 — Results advice rendered via react-markdown

## Diff
- `package.json`: added `react-markdown` + `remark-gfm`.
- `src/pages/Results.tsx`:
  - Imported `ReactMarkdown` and `remarkGfm`.
  - Replaced hand-rolled `renderAdvice` (split on `^## `, bold regex on preamble only, no `#` h1, `whitespace-pre-wrap` section bodies) with a `<ReactMarkdown remarkPlugins={[remarkGfm]}>` block mapped to the card's existing styling: h1 → `text-base font-semibold`, h2 → `font-semibold text-sm`, p → `text-sm text-muted-foreground leading-relaxed`, strong → `font-semibold text-foreground`, ul/ol → list with `pl-5`, links underlined `text-primary`.
- Ask-the-Ghillie left untouched (no artifact reported).
