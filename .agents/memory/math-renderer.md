---
name: MathRenderer component
description: Universal LaTeX + markdown renderer using KaTeX; where it's applied and key patterns
---

# MathRenderer — LaTeX + Markdown Rendering

## Location
`artifacts/aperti/src/components/math-renderer.tsx`

## Exports
- `MathRenderer` — renders plain text with LaTeX and markdown (display or inline)
- `MathHtml` — renders existing HTML with LaTeX injected into text nodes (for contentEditable output)
- `smartTextToHtml(text)` — converts plain text clipboard content with $math$ and **bold** to HTML; used in RichTextEditor onPaste handler
- `hasMath(text)` — quick boolean check for LaTeX presence

## Syntax detected (auto)
- Inline: `$...$` and `\(...\)`
- Block/display: `$$...$$` and `\[...\]`
- Markdown: `**bold**`, `__bold__`, `*italic*`, `_italic_`, `` `code` ``

## Pages where MathRenderer is applied
- `content-craft.tsx` — rich text editor preview mode (MathHtml); paste handler (smartTextToHtml); LaTeX insert button
- `the-mentor.tsx` — AI assistant messages (MathRenderer)
- `my-cardstack.tsx` — flashcard front/back (MathRenderer)
- `micro-assessment.tsx` — question text, options, explanations (MathRenderer)
- `exam-session.tsx` — question text, MCQ options (MathRenderer)
- `take-exam.tsx` — question text (MathRenderer)

## Package
- `katex` installed in `@workspace/aperti` frontend only
- KaTeX CSS imported inside the component via `import "katex/dist/katex.min.css"`
- Vite auto-optimizes katex on first use

## ContentCraft improvements (same session)
- LaTeX insert popover on toolbar (∑TeX button) — opens inline input, inserts $...$ or $$...$$
- Smart paste: converts **bold**, *italic*, `code`, $math$ from clipboard to HTML automatically
- Preview/Edit toggle button — renders full MathHtml preview in place
- Keyboard shortcut ⌘S to save
- Delete lesson button on cards
- Section type dropdown now shows emoji labels

## Bug fixed
- `automation_tasks` DB table was missing (AutoPilot scheduler), created via SQL directly
