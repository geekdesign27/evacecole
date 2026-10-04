import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ReportModel, SchoolReport } from "../domain/buildReport";
import { typo } from "../lib/typo";
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

function schoolBlock(s: SchoolReport, model: ReportModel, assets: ExportAssets): Content[] {
  const out: Content[] = [];
  if (model.mode === "day") out.push({ text: t(s.school), style: "h2", pageBreak: undefined });
  out.push({
    table: {
      widths: [170, "*"],
      body: s.facts.map((f) => [{ text: t(f.label), bold: true }, t(f.value)]),
    },
    layout: { hLineColor: () => LINE, vLineColor: () => LINE, fillColor: (i: number) => (i % 2 ? "#F7F8FA" : null) },
    margin: [0, 4, 0, 8],
  });
  out.push({ text: t(s.summary), bold: true, margin: [0, 0, 0, 8] });
  if (s.sections.length) out.push({ text: "Observations", style: "h3" });
  for (const sec of s.sections) {
    out.push({ text: t(sec.title), style: "h4" });
    for (const line of sec.lines) {
      out.push({ text: t(line.text), margin: [0, 0, 0, 2] });
      for (const c of line.comments) out.push({ text: t(c), italics: true, color: MUTED, margin: [12, 0, 0, 2] });
    }
  }
  if (s.remarks.length) {
    out.push({ text: "Remarques", style: "h4" });
    for (const r of s.remarks) out.push({ text: t(r), margin: [0, 0, 0, 3] });
  }
  const photos = s.photos.filter((p) => assets.photos.has(p.url));
  if (photos.length) {
    out.push({ text: "Photos", style: "h4" });
    const cells: Content[] = photos.map((p) => {
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
    out.push({ table: { widths: ["*", "*"], body: rows }, layout: "noBorders" });
  }
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
  content.push({ text: "Introduction", style: "h2" }, { text: t(model.intro), margin: [0, 0, 0, 10] });
  model.schools.forEach((s) => content.push(...schoolBlock(s, model, assets)));
  if (model.recommendations.length) {
    content.push({ text: "Recommandations", style: "h2" });
    content.push({ ol: model.recommendations.map((r) => ({ text: t(r), margin: [0, 0, 0, 4] })) });
  }
  content.push({ text: "Conclusion", style: "h2" }, { text: t(model.conclusion) });

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
      h2: { fontSize: 14, bold: true, color: BRAND, margin: [0, 12, 0, 6] },
      h3: { fontSize: 12, bold: true, margin: [0, 8, 0, 4] },
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
