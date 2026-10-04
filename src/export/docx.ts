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
import type { ReportModel, SchoolReport } from "../domain/buildReport";
import { dataUrlToBytes, type RasterImage } from "../lib/images";
import { typo } from "../lib/typo";
import { FOOTER_TEXT, type ExportAssets } from "./assets";

const t = typo;
const BRAND = "C71A1A";
const MUTED = "5F6672";
const LINE = "D5D8DE";

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };

function kvTable(
  rows: { label: string; value: string }[],
  labelPct = 35,
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [labelPct * 90, (100 - labelPct) * 90],
    rows: rows.map(
      (r, i) =>
        new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: labelPct, type: WidthType.PERCENTAGE },
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
              width: { size: 100 - labelPct, type: WidthType.PERCENTAGE },
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

function schoolBlock(
  s: SchoolReport,
  model: ReportModel,
  assets: ExportAssets,
): FileChild[] {
  const out: FileChild[] = [];
  if (model.mode === "day") out.push(heading(s.school, HeadingLevel.HEADING_2));
  out.push(kvTable(s.facts));
  out.push(
    new Paragraph({
      spacing: { before: 160 },
      children: [new TextRun({ text: t(s.summary), bold: true })],
    }),
  );
  if (s.sections.length)
    out.push(heading("Observations", HeadingLevel.HEADING_3));
  for (const sec of s.sections) {
    out.push(heading(sec.title, HeadingLevel.HEADING_4));
    for (const line of sec.lines) {
      out.push(new Paragraph(t(line.text)));
      for (const c of line.comments) {
        out.push(
          new Paragraph({
            indent: { left: 360 },
            children: [
              new TextRun({ text: t(c), italics: true, color: MUTED }),
            ],
          }),
        );
      }
    }
  }
  if (s.remarks.length) {
    out.push(heading("Remarques", HeadingLevel.HEADING_4));
    for (const r of s.remarks) out.push(new Paragraph(t(r)));
  }
  const photos = s.photos.filter((p) => assets.photos.has(p.url));
  if (photos.length) {
    out.push(heading("Photos", HeadingLevel.HEADING_4));
    for (const p of photos) {
      out.push(
        new Paragraph({
          keepNext: true,
          children: [image(assets.photos.get(p.url)!, 300, 225, "jpg")],
        }),
      );
      out.push(
        new Paragraph({
          children: [
            new TextRun({ text: t(p.caption), size: 18, color: MUTED }),
          ],
        }),
      );
    }
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
  children.push(
    heading("Introduction", HeadingLevel.HEADING_2),
    new Paragraph(t(model.intro)),
  );
  for (const s of model.schools)
    children.push(...schoolBlock(s, model, assets));
  if (model.recommendations.length) {
    children.push(heading("Recommandations", HeadingLevel.HEADING_2));
    for (const r of model.recommendations) {
      children.push(
        new Paragraph({
          numbering: { reference: "reco", level: 0 },
          children: [new TextRun(t(r))],
        }),
      );
    }
  }
  children.push(
    heading("Conclusion", HeadingLevel.HEADING_2),
    new Paragraph(t(model.conclusion)),
  );

  const doc = new Document({
    creator: "Compagnie des sapeurs-pompiers Moncor",
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
          run: { font: "Arial", size: 24, bold: true },
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
          reference: "reco",
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
