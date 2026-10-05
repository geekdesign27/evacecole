import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type FileChild,
} from "docx";
import type { ReportGroup, ReportLine, ReportModel, SchoolReport } from "../domain/buildReport";
import { factRows } from "./layout";
import { dataUrlToBytes, type RasterImage } from "../lib/images";
import { typo } from "../lib/typo";
import { mapRuns, parseRich, type RichRun } from "../domain/rich";
import { FOOTER_TEXT, type ExportAssets } from "./assets";

const t = typo;
const BRAND = "C71A1A";
const MUTED = "5F6672";
const LINE = "D5D8DE";

// A4 width (11906 twips) minus left and right margins (1100 each)
const CONTENT_WIDTH = 11906 - 2 * 1100;

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };

function kvTable(
  rows: { label: string; value: string }[],
  labelPct = 35,
): Table {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [Math.round((CONTENT_WIDTH * labelPct) / 100), Math.round((CONTENT_WIDTH * (100 - labelPct)) / 100)],
    rows: rows.map(
      (r, i) =>
        new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: Math.round((CONTENT_WIDTH * labelPct) / 100), type: WidthType.DXA },
              shading:
                i % 2
                  ? { type: ShadingType.CLEAR, fill: "F7F8FA", color: "auto" }
                  : undefined,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: t(r.label), bold: true })],
                }),
              ],
            }),
            new TableCell({
              borders,
              width: { size: Math.round((CONTENT_WIDTH * (100 - labelPct)) / 100), type: WidthType.DXA },
              shading:
                i % 2
                  ? { type: ShadingType.CLEAR, fill: "F7F8FA", color: "auto" }
                  : undefined,
              children: [new Paragraph(t(r.value))],
            }),
          ],
        }),
    ),
  });
}

let numberedListInstance = 0;

function richRuns(runs: RichRun[]): TextRun[] {
  return runs.map((r) =>
    r.text === "\n" ? new TextRun({ text: "", break: 1 }) : new TextRun({ text: r.text, bold: r.bold, italics: r.italic, underline: r.underline ? {} : undefined }),
  );
}

/** Rich report field to real Word paragraphs and lists (editable in Word). */
function richParagraphs(value: string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const b of mapRuns(parseRich(value), t)) {
    if (b.kind === "p") {
      out.push(new Paragraph({ spacing: { after: 120 }, children: richRuns(b.runs) }));
    } else if (b.kind === "h") {
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_4, children: richRuns(b.runs) }));
    } else {
      // Each numbered list restarts at 1.
      const instance = b.kind === "ol" ? ++numberedListInstance : 0;
      for (const item of b.items) {
        out.push(
          new Paragraph({
            numbering: { reference: b.kind === "ol" ? "numbers" : "bullets", level: 0, ...(b.kind === "ol" ? { instance } : {}) },
            children: richRuns(item),
          }),
        );
      }
    }
  }
  return out;
}

function heading(
  text: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
) {
  return new Paragraph({ heading: level, children: [new TextRun(t(text))] });
}

function image(
  img: RasterImage,
  maxW: number,
  maxH: number,
  type: "jpg" | "png",
) {
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  return new ImageRun({
    type,
    data: dataUrlToBytes(img.dataUrl),
    transformation: {
      width: Math.round(img.width * scale),
      height: Math.round(img.height * scale),
    },
  });
}

function lineParagraphs(line: ReportLine): Paragraph[] {
  return [
    new Paragraph({ spacing: { after: 20 }, children: [new TextRun(t(line.text))] }),
    ...line.comments.map(
      (c) =>
        new Paragraph({
          indent: { left: 300 },
          spacing: { after: 20 },
          children: [new TextRun({ text: t(c), italics: true, color: MUTED, size: 18 })],
        }),
    ),
  ];
}

function groupParagraphs(g: ReportGroup): Paragraph[] {
  const out: Paragraph[] = [heading(g.title, HeadingLevel.HEADING_3)];
  for (const line of g.issues) out.push(...lineParagraphs(line));
  if (g.ok.length) {
    out.push(
      new Paragraph({
        spacing: { before: 40 },
        children: [
          new TextRun({ text: t("En ordre : "), bold: true, color: MUTED, size: 19 }),
          new TextRun({ text: t(g.ok.join(" ")), color: MUTED, size: 19 }),
        ],
      }),
    );
  }
  return out;
}

const cellMargins = { top: 30, bottom: 30, left: 80, right: 80 };

/** Facts on two label/value columns, like the PDF. */
function factsTable(facts: SchoolReport["facts"]): Table {
  const w = [Math.round(CONTENT_WIDTH * 0.2), Math.round(CONTENT_WIDTH * 0.3), Math.round(CONTENT_WIDTH * 0.22), 0];
  w[3] = CONTENT_WIDTH - w[0] - w[1] - w[2];
  const label = (text: string, width: number) =>
    new TableCell({
      borders,
      margins: cellMargins,
      width: { size: width, type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text: t(text), bold: true, size: 18, color: MUTED })] })],
    });
  const value = (text: string, width: number, strong?: boolean, span?: number) =>
    new TableCell({
      borders,
      margins: cellMargins,
      columnSpan: span,
      width: { size: width, type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text: t(text), bold: strong, size: strong ? 22 : 20 })] })],
    });
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: w,
    rows: factRows(facts).map(
      (row) =>
        new TableRow({
          children:
            row.length === 2
              ? [label(row[0].label, w[0]), value(row[0].value, w[1]), label(row[1].label, w[2]), value(row[1].value, w[3])]
              : [label(row[0].label, w[0]), value(row[0].value, w[1] + w[2] + w[3], row[0].strong, 3)],
        }),
    ),
  });
}

function schoolBlock(s: SchoolReport, model: ReportModel, assets: ExportAssets): FileChild[] {
  const out: FileChild[] = [
    model.mode === "day"
      ? new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true, children: [new TextRun(t(s.school))] })
      : heading("Déroulement", HeadingLevel.HEADING_2),
  ];
  out.push(factsTable(s.facts));
  for (const n of s.timingNotes) out.push(new Paragraph({ children: [new TextRun({ text: t(n), size: 18, color: MUTED })] }));
  out.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: t(s.summary), bold: true })] }));
  if (s.zonesObserved) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: t("Zones observées : "), bold: true, size: 19, color: MUTED }),
          new TextRun({ text: t(s.zonesObserved), size: 19, color: MUTED }),
        ],
      }),
    );
  }
  for (const g of s.groups) out.push(...groupParagraphs(g));
  if (s.remarks.length) {
    out.push(heading("Remarques", HeadingLevel.HEADING_3));
    for (const r of s.remarks) out.push(new Paragraph({ spacing: { after: 20 }, children: [new TextRun(t(r))] }));
  }
  const photos = s.photos.filter((p) => assets.photos.has(p.url));
  if (photos.length) {
    out.push(heading("Photos", HeadingLevel.HEADING_3));
    // Three small photos per row in a borderless table, each with its caption.
    const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const noBorders = { top: none, bottom: none, left: none, right: none };
    const colW = Math.floor(CONTENT_WIDTH / 3);
    const rows: TableRow[] = [];
    for (let i = 0; i < photos.length; i += 3) {
      const slice = photos.slice(i, i + 3);
      rows.push(
        new TableRow({
          children: [0, 1, 2].map((k) => {
            const p = slice[k];
            return new TableCell({
              borders: noBorders,
              width: { size: colW, type: WidthType.DXA },
              children: p
                ? [
                    new Paragraph({ children: [image(assets.photos.get(p.url)!, 190, 135, "jpg")] }),
                    new Paragraph({ children: [new TextRun({ text: t(p.caption), size: 16, color: MUTED })] }),
                  ]
                : [new Paragraph("")],
            });
          }),
        }),
      );
    }
    out.push(new Table({ width: { size: colW * 3, type: WidthType.DXA }, columnWidths: [colW, colW, colW], rows }));
  }
  return out;
}

export async function renderDocx(
  model: ReportModel,
  assets: ExportAssets,
): Promise<Blob> {
  const children: FileChild[] = [];

  children.push(
    new Paragraph({
      children: [
        ...(assets.logo
          ? [image(assets.logo, 70, 70, "png"), new TextRun("  ")]
          : []),
        new TextRun({ text: t(model.title), bold: true, size: 32 }),
      ],
      spacing: { after: 240 },
    }),
  );
  children.push(
    kvTable(
      [
        { label: "Objet", value: model.object },
        { label: "Date", value: model.dateLong },
        { label: "Destinataires", value: model.recipients },
        { label: "Rédigé par", value: model.author },
      ].filter((r) => r.value),
      25,
    ),
  );
  children.push(heading("Introduction", HeadingLevel.HEADING_2), ...richParagraphs(model.intro));
  children.push(heading("Objectif", HeadingLevel.HEADING_2), ...richParagraphs(model.objective));
  children.push(heading("Critères d'évaluation", HeadingLevel.HEADING_2), ...richParagraphs(model.criteria));
  for (const s of model.schools) children.push(...schoolBlock(s, model, assets));
  if (model.recommendations) {
    children.push(heading("Recommandations", HeadingLevel.HEADING_2), ...richParagraphs(model.recommendations));
  }
  children.push(heading("Conclusion", HeadingLevel.HEADING_2), ...richParagraphs(model.conclusion));

  const doc = new Document({
    creator: "CP Moncor",
    title: model.title,
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 21 },
          paragraph: { spacing: { after: 80, line: 276 } },
        },
      },
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 21 },
          paragraph: { spacing: { after: 80, line: 276 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 28, bold: true, color: BRAND },
          paragraph: { spacing: { before: 280, after: 120 }, keepNext: true },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 26, bold: true, color: "9E1414" },
          paragraph: { spacing: { before: 200, after: 80 }, keepNext: true },
        },
        {
          id: "Heading4",
          name: "Heading 4",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 22, bold: true },
          paragraph: { spacing: { before: 160, after: 60 }, keepNext: true },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 400, hanging: 260 } } },
            },
          ],
        },
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 400, hanging: 300 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${FOOTER_TEXT}, page `,
                    size: 16,
                    color: MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: MUTED,
                  }),
                  new TextRun({ text: "/", size: 16, color: MUTED }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}
