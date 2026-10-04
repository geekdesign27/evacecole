import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ReportGroup, ReportLine, ReportModel, ReportPhoto, SchoolReport } from "../domain/buildReport";
import { factRows } from "./layout";
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
        { image: img.dataUrl, fit: [150, 105] },
        { text: t(p.caption), fontSize: 8, color: MUTED, margin: [0, 2, 0, 0] },
      ],
      margin: [0, 0, 0, 6],
      unbreakable: true,
    } as Content;
  });
  const rows: Content[][] = [];
  for (let i = 0; i < cells.length; i += 3) rows.push([cells[i], cells[i + 1] ?? { text: "" }, cells[i + 2] ?? { text: "" }]);
  return { table: { widths: ["*", "*", "*"], body: rows }, layout: "noBorders" };
}

function factsTable(facts: SchoolReport["facts"]): Content {
  const body = factRows(facts).map((row) => {
    const cell = (c: (typeof row)[number]) => [
      { text: t(c.label), bold: true, fontSize: 9, color: MUTED },
      { text: t(c.value), bold: c.strong, fontSize: c.strong ? 11 : 10 },
    ];
    if (row.length === 2) return [...cell(row[0]), ...cell(row[1])];
    const [l, v] = cell(row[0]);
    return [l, { ...v, colSpan: 3 }, {}, {}];
  });
  return {
    table: { widths: [95, "*", 110, "*"], body },
    layout: {
      hLineColor: () => LINE,
      vLineColor: () => LINE,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 2, 0, 4],
  } as Content;
}

function lineContent(line: ReportLine): Content[] {
  return [
    { text: t(line.text), margin: [0, 0, 0, 1] },
    ...line.comments.map((c) => ({ text: t(c), italics: true, fontSize: 9, color: MUTED, margin: [10, 0, 0, 1] }) as Content),
  ];
}

function groupContent(g: ReportGroup): Content {
  const parts: Content[] = [{ text: t(g.title), style: "h3" }];
  parts.push(...g.issues.flatMap(lineContent));
  if (g.ok.length) {
    parts.push({
      text: [{ text: "En ordre : ", bold: true }, t(g.ok.join(" "))].map((x) => (typeof x === "string" ? x : { ...x, text: t(x.text) })),
      fontSize: 9.5,
      color: MUTED,
      margin: [0, g.issues.length ? 2 : 0, 0, 0],
    });
  }
  return { stack: parts, unbreakable: g.issues.length < 12 };
}

function schoolBlock(s: SchoolReport, model: ReportModel, assets: ExportAssets): Content[] {
  const out: Content[] = [];
  // School title, facts and summary stay together.
  out.push({
    // Day report: each school on its own page.
    ...(model.mode === "day" ? { pageBreak: "before" as const } : {}),
    stack: [
      { text: model.mode === "day" ? t(s.school) : "Déroulement", style: "h2" },
      factsTable(s.facts),
      ...s.timingNotes.map((n) => ({ text: t(n), fontSize: 9, color: MUTED, margin: [0, 0, 0, 1] }) as Content),
      { text: t(s.summary), bold: true, margin: [0, 3, 0, 2] },
      ...(s.zonesObserved ? [{ text: [{ text: "Zones observées : ", bold: true }, t(s.zonesObserved)], fontSize: 9.5, color: MUTED } as Content] : []),
    ],
    unbreakable: true,
  });
  for (const g of s.groups) out.push(groupContent(g));
  if (s.remarks.length) {
    out.push({ stack: [{ text: "Remarques", style: "h3" }, ...s.remarks.map((r) => ({ text: t(r), margin: [0, 0, 0, 1] }) as Content)], unbreakable: s.remarks.length < 8 });
  }
  const grid = photoGrid(s.photos, assets);
  if (grid) out.push({ text: "Photos", style: "h3" }, grid);
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
    pageMargins: [45, 40, 45, 50],
    info: { title: model.title, author: "Compagnie des sapeurs-pompiers Moncor" },
    content,
    footer: (page, pages) => ({
      columns: [
        { text: FOOTER_TEXT, fontSize: 8, color: MUTED },
        { text: `Page ${page}/${pages}`, fontSize: 8, color: MUTED, alignment: "right" },
      ],
      margin: [50, 20, 50, 0],
    }),
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.15, color: INK },
    styles: {
      title: { fontSize: 17, bold: true, color: INK },
      h2: { fontSize: 14, bold: true, color: BRAND, margin: [0, 10, 0, 4] },
      h3: { fontSize: 11, bold: true, color: "#9E1414", margin: [0, 7, 0, 2] },
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
