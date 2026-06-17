import katex from "katex";
import "katex/dist/katex.min.css";
import DOMPurify from "dompurify";

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      errorColor: "#cc0000",
      trust: false,
    });
  } catch {
    return `<span class="font-mono text-red-500 text-xs bg-red-50 px-1 rounded">${tex}</span>`;
  }
}

type Seg = { type: "text" | "display" | "inline"; content: string };

function parseSegments(text: string): Seg[] {
  const out: Seg[] = [];
  const BLOCK = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g;
  const INLINE = /\$([^$\n]+?)\$|\\\(([^)]+?)\\\)/g;
  const tempSegs: Seg[] = [];

  let lastIdx = 0;
  let m: RegExpExecArray | null;
  BLOCK.lastIndex = 0;
  while ((m = BLOCK.exec(text)) !== null) {
    if (m.index > lastIdx) tempSegs.push({ type: "text", content: text.slice(lastIdx, m.index) });
    tempSegs.push({ type: "display", content: (m[1] || m[2]).trim() });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) tempSegs.push({ type: "text", content: text.slice(lastIdx) });

  for (const seg of tempSegs) {
    if (seg.type !== "text") { out.push(seg); continue; }
    INLINE.lastIndex = 0;
    let li = 0;
    while ((m = INLINE.exec(seg.content)) !== null) {
      if (m.index > li) out.push({ type: "text", content: seg.content.slice(li, m.index) });
      out.push({ type: "inline", content: (m[1] || m[2]).trim() });
      li = m.index + m[0].length;
    }
    if (li < seg.content.length) out.push({ type: "text", content: seg.content.slice(li) });
  }
  return out;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function mdToHtml(text: string): string {
  const safe = escapeHtml(text);
  return safe
    .replace(/\*\*\*(.*?)\*\*\*/gs, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/gs, "<strong>$1</strong>")
    .replace(/__(.*?)__/gs, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gs, "<em>$1</em>")
    .replace(/_((?!\s).*?(?!\s))_/gs, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class=\"bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[0.85em] font-mono\">$1</code>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

function segmentsToHtml(segs: Seg[]): string {
  return segs.map(seg => {
    if (seg.type === "display") {
      return `<div class="my-3 overflow-x-auto text-center py-1">${renderKatex(seg.content, true)}</div>`;
    }
    if (seg.type === "inline") {
      return renderKatex(seg.content, false);
    }
    return mdToHtml(seg.content);
  }).join("");
}

export function MathRenderer({
  content,
  className = "",
  inline = false,
}: {
  content: string;
  className?: string;
  inline?: boolean;
}) {
  if (!content) return null;
  const html = DOMPurify.sanitize(segmentsToHtml(parseSegments(content)), { ADD_TAGS: ["math", "svg"], ADD_ATTR: ["class", "style", "aria-hidden", "focusable", "role", "viewBox", "xmlns", "d", "fill", "stroke", "width", "height"] });
  if (inline) {
    return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <div
      className={`leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function MathHtml({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  if (!html) return null;
  const sanitizedInput = DOMPurify.sanitize(html, { ADD_TAGS: ["math", "svg"], ADD_ATTR: ["class", "style", "aria-hidden", "focusable", "role", "viewBox", "xmlns", "d", "fill", "stroke", "width", "height"] });
  const parts = sanitizedInput.split(/(<[^>]+>)/);
  const rawProcessed = parts
    .map(part => {
      if (part.startsWith("<") || !part.trim()) return part;
      const segs = parseSegments(part);
      return segs
        .map(seg => {
          if (seg.type === "display")
            return `<span class="block my-3 overflow-x-auto text-center">${renderKatex(seg.content, true)}</span>`;
          if (seg.type === "inline") return renderKatex(seg.content, false);
          return escapeHtml(seg.content);
        })
        .join("");
    })
    .join("");

  // Re-sanitize after KaTeX injection to close any XSS surface
  const processed = DOMPurify.sanitize(rawProcessed, {
    ADD_TAGS: ["math", "svg"],
    ADD_ATTR: ["class", "style", "aria-hidden", "focusable", "role", "viewBox", "xmlns", "d", "fill", "stroke", "width", "height"],
  });

  return (
    <div
      className={`leading-relaxed prose prose-sm max-w-none dark:prose-invert ${className}`}
      dangerouslySetInnerHTML={{ __html: processed }}
    />
  );
}

export function smartTextToHtml(text: string): string {
  const segs = parseSegments(text);
  return segs
    .map(seg => {
      if (seg.type === "display")
        return `<div class="math-display my-2 text-center overflow-x-auto">${renderKatex(seg.content, true)}</div>`;
      if (seg.type === "inline") return renderKatex(seg.content, false);
      return mdToHtml(seg.content);
    })
    .join("");
}

export function hasMath(text: string): boolean {
  return /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([^)]+?\\\)/.test(text);
}
