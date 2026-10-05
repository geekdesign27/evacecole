import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { FloorNote, FloorTable, ReportModel, ReportPhoto, SchoolReport, StepSection, Verdict } from "../domain/buildReport";
import { CELL_WORD, factRows, FLOOR_LEGEND, STEP_WORD, VERDICT_COLOR } from "./layout";
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

function pdfList(kind: "ul" | "ol", items: RichRun[][]): Content {
  const li = (it: RichRun[]) => ({ text: pdfRuns(it), margin: [0, 0, 0, 1] });
  // Long lists (e.g. the evaluation criteria) on two columns to save space.
  if (items.length > 6) {
    const half = Math.ceil(items.length / 2);
    const first = items.slice(0, half).map(li);
    const second = items.slice(half).map(li);
    const second2 = kind === "ol" ? { ol: second, start: half + 1 } : { ul: second };
    return {
      columns: [{ [kind]: first }, second2],
      columnGap: 14,
      fontSize: 9.5,
      margin: [0, 0, 0, 5],
    } as unknown as Content;
  }
  return ({ [kind]: items.map(li), margin: [0, 0, 0, 6] } as unknown) as Content;
}

/** Rich report field to pdfmake paragraphs and lists. */
function richContent(value: string): Content[] {
  return mapRuns(parseRich(value), t).map((b) =>
    b.kind === "p"
      ? ({ text: pdfRuns(b.runs), margin: [0, 0, 0, 4] } as Content)
      : b.kind === "h"
        ? ({ text: pdfRuns(b.runs), bold: true, fontSize: 11, margin: [0, 5, 0, 2] } as Content)
        : pdfList(b.kind, b.items),
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


const tableLayout = {
  hLineColor: () => LINE,
  vLineColor: () => LINE,
  hLineWidth: () => 0.6,
  vLineWidth: () => 0.6,
  paddingTop: () => 2,
  paddingBottom: () => 2,
  paddingLeft: () => 4,
  paddingRight: () => 4,
};

const verdictText = (v: Verdict, word: string): Content => ({ text: word, bold: true, color: VERDICT_COLOR[v] });

function explanation(finding: string | undefined, comments: string[]): Content {
  const stack: Content[] = [];
  if (finding) stack.push({ text: [{ text: "Constat : ", bold: true }, t(finding)], fontSize: 9 });
  for (const c of comments) stack.push({ text: [{ text: "Pourquoi : ", bold: true }, t(c)], fontSize: 9, italics: true, color: MUTED });
  return { stack };
}

/** Interpellated person: numbered steps with En ordre / Hésitant / Pas fait, explained when not in order. */
function stepsContent(sections: StepSection[]): Content[] {
  if (!sections.length) return [];
  const body: TableCell[][] = [
    [
      { text: "N°", bold: true, fontSize: 9, color: MUTED },
      { text: "Étape de la procédure", bold: true, fontSize: 9, color: MUTED },
      { text: "Appréciation", bold: true, fontSize: 9, color: MUTED },
    ],
  ];
  for (const sec of sections) {
    body.push([{ text: t(sec.title), bold: true, colSpan: 3, fillColor: "#F4F5F7", fontSize: 9.5 }, {}, {}]);
    for (const r of sec.rows) {
      body.push([{ text: String(r.n), color: MUTED }, t(r.label), verdictText(r.verdict, STEP_WORD[r.verdict])]);
      if (r.finding || r.comments.length) body.push([{ text: "" }, { ...(explanation(r.finding, r.comments) as object), colSpan: 2 } as TableCell, {}]);
    }
  }
  return [
    { text: "Personne interpellée", style: "h3" },
    { table: { headerRows: 1, widths: [16, "*", 62], body, dontBreakRows: true }, layout: tableLayout, fontSize: 9.5 },
  ];
}

/** Floors: points × zones table (Oui / Partiel / Non), then the points to improve in plain words. */
function floorsContent(f: FloorTable | null): Content[] {
  if (!f) return [];
  const zoneW = Math.max(34, Math.min(60, Math.floor(300 / f.zones.length)));
  const head: TableCell[] = [
    { text: "Point contrôlé", bold: true, fontSize: 8.5, color: MUTED },
    ...f.zones.map((z) => ({ text: t(z), bold: true, fontSize: 8.5, color: MUTED, alignment: "center" }) as TableCell),
  ];
  const body: TableCell[][] = [head];
  let section = "";
  for (const r of f.rows) {
    if (r.section !== section) {
      section = r.section;
      body.push([{ text: section, bold: true, colSpan: f.zones.length + 1, fillColor: "#F4F5F7", fontSize: 9 }, ...f.zones.map(() => ({}))]);
    }
    body.push([
      { text: t(r.label), fontSize: 9 },
      ...f.zones.map((z) => {
        const v = r.cells[z];
        return (v ? { ...(verdictText(v, CELL_WORD[v]) as object), alignment: "center", fontSize: 9 } : { text: "" }) as TableCell;
      }),
    ]);
  }
  const out: Content[] = [
    { text: "Dans les étages", style: "h3" },
    { table: { headerRows: 1, widths: ["*", ...f.zones.map(() => zoneW)], body, dontBreakRows: true }, layout: tableLayout },
    { text: FLOOR_LEGEND, fontSize: 8, color: MUTED, margin: [0, 2, 0, 0] },
  ];
  const notes = (title: string, list: FloorNote[]) =>
    list.length
      ? [
          { text: title, bold: true, fontSize: 10, margin: [0, 6, 0, 2] } as Content,
          {
            ul: list.map((n) => ({
              stack: [
                { text: [{ text: `${t(n.label)}${n.finding ? " : " : ""}`, bold: true }, n.finding ? t(n.finding) : ""] },
                ...n.comments.map((c) => ({ text: t(c), italics: true, color: MUTED, fontSize: 9 }) as Content),
              ],
              margin: [0, 0, 0, 2],
            })),
            fontSize: 9.5,
          } as Content,
        ]
      : [];
  out.push(...notes("À améliorer", f.toImprove), ...notes("Précisions des observateurs", f.precisions));
  return out;
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
  out.push(...stepsContent(s.steps), ...floorsContent(s.floors));
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
  content.push(...richSection("Critères d'évaluation", model.criteria));
  model.schools.forEach((s) => content.push(...schoolBlock(s, model, assets)));
  if (model.recommendations) {
    content.push(...richSection("Recommandations", model.recommendations));
  }
  content.push(...richSection("Conclusion", model.conclusion));

  return {
    pageSize: "A4",
    pageMargins: [45, 40, 45, 50],
    info: { title: model.title, author: "CP Moncor" },
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
