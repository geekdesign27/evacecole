import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ReportBlock, ReportLine, ReportModel, ReportPhoto, SchoolReport } from "../domain/buildReport";
import { typo } from "../lib/typo";
import { mapRuns, parseRich, type RichRun } from "../domain/rich";
import { FOOTER_TEXT, type ExportAssets } from "./assets";

const BRAND = "#C71A1A";
const INK = "#1A1D24";
const MUTED = "#5F6672";
const LINE = "#E7E9EE";

const t = typo;

function infoTable(model: ReportModel): Content {
  const rows = [
    ["Objet", model.object],
    ["Date", model.dateLong],
    ["Destinataires", model.recipients],
    ["Rédigé par", model.author],
  ].filter(([, v]) => v);
  return {
    table: {
      widths: [110, "*"],
      body: rows.map(([k, v]) => [{ text: k, bold: true }, t(v)]),
    },
    layout: { hLineColor: () => LINE, vLineColor: () => LINE },
    margin: [0, 0, 0, 14],
  };
}

function pdfRuns(runs: RichRun[]): Content[] {
  return runs.map(
    (r) => ({ text: r.text, bold: r.bold, italics: r.italic, decoration: r.underline ? "underline" : undefined }) as Content,
  );
}

/** Rich report field to pdfmake paragraphs and lists. */
function richContent(value: string): Content[] {
  return mapRuns(parseRich(value), t).map((b) =>
    b.kind === "p"
      ? ({ text: pdfRuns(b.runs), margin: [0, 0, 0, 5] } as Content)
      : b.kind === "h"
        ? ({ text: pdfRuns(b.runs), bold: true, fontSize: 11.5, margin: [0, 6, 0, 3] } as Content)
      : b.kind === "ul"
        ? ({ ul: b.items.map((it) => ({ text: pdfRuns(it), margin: [0, 0, 0, 2] })), margin: [0, 0, 0, 6] } as Content)
        : ({ ol: b.items.map((it) => ({ text: pdfRuns(it), margin: [0, 0, 0, 2] })), margin: [0, 0, 0, 6] } as Content),
  );
}

/** Heading kept on the same page as the first paragraph; short sections stay whole. */
function richSection(title: string, value: string): Content[] {
  const blocks = richContent(value);
  const head: Content = { text: title, style: "h2" };
  if (blocks.length <= 2) return [{ stack: [head, ...blocks], unbreakable: true }];
  return [{ stack: [head, blocks[0]], unbreakable: true }, ...blocks.slice(1)];
}

function photoGrid(photos: ReportPhoto[], assets: ExportAssets): Content | null {
  const usable = photos.filter((p) => assets.photos.has(p.url));
  if (!usable.length) return null;
  const cells: Content[] = usable.map((p) => {
    const img = assets.photos.get(p.url)!;
    return {
      stack: [
        { image: img.dataUrl, fit: [235, 170] },
        { text: t(p.caption), fontSize: 9, color: MUTED, margin: [0, 3, 0, 0] },
      ],
      margin: [0, 0, 0, 10],
      unbreakable: true,
    } as Content;
  });
  const rows: Content[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push([cells[i], cells[i + 1] ?? { text: "" }]);
  return { table: { widths: ["*", "*"], body: rows }, layout: "noBorders" };
}

function lineContent(line: ReportLine): Content[] {
  return [
    { text: t(line.text), margin: [0, 0, 0, 2] },
    ...line.comments.map((c) => ({ text: t(c), italics: true, color: MUTED, margin: [12, 0, 0, 2] }) as Content),
  ];
}

function blockContent(b: ReportBlock, assets: ExportAssets, lead: Content[] = []): Content[] {
  const out: Content[] = [];
  // Headings travel with their first lines, so none is left alone at the bottom of a page.
  let head: Content[] = [
    ...lead,
    { text: t(b.title), style: "h3" },
    { text: t(b.observers), fontSize: 9, color: MUTED, margin: [0, -2, 0, 4] },
  ];
  const groups = [...b.groups];
  if (b.remarks.length) {
    groups.push({ title: "Remarques", lines: b.remarks.map((r) => ({ text: r, comments: [] })) });
  }
  for (const g of groups) {
    out.push({ stack: [...head, { text: t(g.title), style: "h4" }, ...g.lines.flatMap(lineContent)], unbreakable: g.lines.length < 15 });
    head = [];
  }
  if (head.length) out.push({ stack: head, unbreakable: true });
  const grid = photoGrid(b.photos, assets);
  if (grid) out.push({ text: "Photos", style: "h4" }, grid);
  return out;
}

function schoolBlock(s: SchoolReport, model: ReportModel, assets: ExportAssets): Content[] {
  const out: Content[] = [];
  out.push({ text: model.mode === "day" ? t(s.school) : "Déroulement", style: "h2" });
  out.push({
    table: {
      widths: [170, "*"],
      body: s.facts.map((f) => [{ text: t(f.label), bold: true }, t(f.value)]),
    },
    layout: { hLineColor: () => LINE, vLineColor: () => LINE, fillColor: (i: number) => (i % 2 ? "#F7F8FA" : null) },
    margin: [0, 4, 0, 6],
  });
  for (const n of s.timingNotes) out.push({ text: t(n), fontSize: 9.5, color: MUTED, margin: [0, 0, 0, 2] });
  out.push({ text: t(s.summary), bold: true, margin: [0, 6, 0, 8] });
  s.blocks.forEach((b, i) => {
    out.push(...blockContent(b, assets, i === 0 ? [{ text: "Observations", style: "h2" }] : []));
  });
  return out;
}

export function buildPdfDefinition(model: ReportModel, assets: ExportAssets): TDocumentDefinitions {
  const header: Content = {
    columns: [
      assets.logo ? { image: assets.logo.dataUrl, width: 54 } : { text: "" },
      { text: t(model.title), style: "title", margin: [12, 8, 0, 0] },
    ],
    margin: [0, 0, 0, 16],
  };

  const content: Content[] = [header, infoTable(model)];
  content.push(...richSection("Introduction", model.intro));
  content.push(...richSection("Objectif", model.objective));
  model.schools.forEach((s) => content.push(...schoolBlock(s, model, assets)));
  if (model.recommendations) {
    content.push(...richSection("Recommandations", model.recommendations));
  }
  content.push(...richSection("Conclusion", model.conclusion));

  return {
    pageSize: "A4",
    pageMargins: [50, 45, 50, 55],
    info: { title: model.title, author: "Compagnie des sapeurs-pompiers Moncor" },
    content,
    footer: (page, pages) => ({
      columns: [
        { text: FOOTER_TEXT, fontSize: 8, color: MUTED },
        { text: `Page ${page}/${pages}`, fontSize: 8, color: MUTED, alignment: "right" },
      ],
      margin: [50, 20, 50, 0],
    }),
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.2, color: INK },
    styles: {
      title: { fontSize: 17, bold: true, color: INK },
      h2: { fontSize: 15, bold: true, color: BRAND, margin: [0, 14, 0, 6] },
      h3: { fontSize: 14, bold: true, color: "#9E1414", margin: [0, 12, 0, 1] },
      h4: { fontSize: 11, bold: true, margin: [0, 6, 0, 3] },
    },
  };
}

export async function renderPdf(model: ReportModel, assets: ExportAssets): Promise<Blob> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfMake as any).addVirtualFileSystem(vfs);
  return pdfMake.createPdf(buildPdfDefinition(model, assets)).getBlob();
}
