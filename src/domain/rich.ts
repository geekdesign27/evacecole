// Rich text for the editable report fields (introduction, objective, recommendations, conclusion).
// Stored as HTML from the editor, but NEVER injected as HTML: it is parsed into this small
// whitelist structure (paragraphs, sub-headings, bold, italic, underline, bullet and numbered
// lists) and rendered from it.
// Plain text values (older reports, default texts) are accepted too.

export interface RichRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export type RichBlock =
  | { kind: "p"; runs: RichRun[] }
  | { kind: "h"; runs: RichRun[] }
  | { kind: "ul" | "ol"; items: RichRun[][] };

export type RichDoc = RichBlock[];

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain text (one paragraph per line) to editor HTML. */
export function plainToHtml(text: string): string {
  return text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join("");
}

export function isHtml(value: string): boolean {
  return /^\s*<(p|ul|ol|h3)[\s>]/i.test(value);
}

/** Editor value for any stored value (HTML kept, plain text converted). */
export function toEditorHtml(value: string): string {
  return isHtml(value) ? value : plainToHtml(value);
}

function runsOf(
  node: Node,
  marks: { bold?: boolean; italic?: boolean; underline?: boolean } = {},
): RichRun[] {
  const out: RichRun[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      const text = child.textContent ?? "";
      if (text)
        out.push({
          text,
          ...(marks.bold ? { bold: true } : {}),
          ...(marks.italic ? { italic: true } : {}),
          ...(marks.underline ? { underline: true } : {}),
        });
      return;
    }
    if (child.nodeType !== 1) return;
    const tag = (child as Element).tagName.toLowerCase();
    if (tag === "br") {
      out.push({ text: "\n" });
      return;
    }
    const next = {
      bold: marks.bold || tag === "strong" || tag === "b",
      italic: marks.italic || tag === "em" || tag === "i",
      underline: marks.underline || tag === "u",
    };
    // Unknown tags keep their text only (whitelist).
    out.push(...runsOf(child, next));
  });
  return out;
}

function trimRuns(runs: RichRun[]): RichRun[] {
  return runs.filter((r) => r.text.length > 0);
}

/** Parses a stored value into the whitelist structure. Requires DOMParser (browser or happy-dom). */
export function parseRich(value: string | undefined): RichDoc {
  const v = (value ?? "").trim();
  if (!v) return [];
  if (!isHtml(v)) {
    return v
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => ({ kind: "p" as const, runs: [{ text: l }] }));
  }
  const doc = new DOMParser().parseFromString(`<body>${v}</body>`, "text/html");
  const blocks: RichDoc = [];
  doc.body.childNodes.forEach((node) => {
    if (node.nodeType !== 1) {
      const text = node.textContent?.trim();
      if (text) blocks.push({ kind: "p", runs: [{ text }] });
      return;
    }
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      const items: RichRun[][] = [];
      el.querySelectorAll(":scope > li").forEach((li) => {
        const runs = trimRuns(runsOf(li));
        if (runs.some((r) => r.text.trim())) items.push(runs);
      });
      if (items.length) blocks.push({ kind: tag, items });
      return;
    }
    const runs = trimRuns(runsOf(el));
    const kind: "h" | "p" = /^h[1-6]$/.test(tag) ? "h" : "p";
    if (runs.some((r) => r.text.trim())) blocks.push({ kind, runs } as RichBlock);
  });
  return blocks;
}

export function isRichEmpty(value: string | undefined): boolean {
  const v = (value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return v.length === 0;
}

/** Applies a text transform (e.g. Swiss typography) to every run. */
export function mapRuns(doc: RichDoc, fn: (s: string) => string): RichDoc {
  return doc.map((b) =>
    "runs" in b
      ? ({ kind: b.kind, runs: b.runs.map((r) => ({ ...r, text: fn(r.text) })) } as RichBlock)
      : {
          kind: b.kind,
          items: b.items.map((it) =>
            it.map((r) => ({ ...r, text: fn(r.text) })),
          ),
        },
  );
}
