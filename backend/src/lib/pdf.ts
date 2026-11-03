import type { Response } from "express";

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Produces a minimal, valid, text-only PDF. The migration target does not yet
 * ship a PDF rendering engine, so reports are emitted as a single-column,
 * paginated text document with the same content the Spring report renders.
 */
export function textPdf(title: string, lines: string[]): Buffer {
  const pageHeight = 792;
  const margin = 48;
  const lineHeight = 14;
  const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
  const pages: string[][] = [];
  const all = [title, "", ...lines];
  for (let index = 0; index < all.length; index += linesPerPage) {
    pages.push(all.slice(index, index + linesPerPage));
  }
  if (pages.length === 0) pages.push([title]);

  const objects: string[] = [];
  const fontsObjectId = 3;
  const pageObjectIds: number[] = [];
  let nextId = 4;
  const contentIds: number[] = [];
  for (let index = 0; index < pages.length; index += 1) {
    contentIds.push(nextId++);
    pageObjectIds.push(nextId++);
  }

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[fontsObjectId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((pageLines, pageIndex) => {
    const body =
      "BT\n/F1 11 Tf\n12 TL\n" +
      pageLines
        .map((line, lineIndex) => {
          const y = pageHeight - margin - lineIndex * lineHeight;
          return `1 0 0 1 ${margin} ${y} Tm (${escapePdfText(line)}) Tj ET`;
        })
        .join("\n") +
      "\nET";
    const contentId = contentIds[pageIndex]!;
    const pageId = pageObjectIds[pageIndex]!;
    objects[contentId] = `<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 ${pageHeight}] ` +
      `/Resources << /Font << /F1 ${fontsObjectId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

function readableText(value: unknown): string {
  return String(value ?? "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapText(value: string, maxLength: number): string[] {
  const words = readableText(value).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!word) continue;
    if (line && line.length + word.length + 1 > maxLength) {
      lines.push(line);
      line = "";
    }
    line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

export class PdfBuilder {
  private readonly lines: string[] = [];
  private readonly title: string;

  constructor(title: string, subtitle: string) {
    this.title = title;
    this.lines.push("CODEIT CareerOS", ...wrapText(subtitle, 92), "");
  }

  heading(value: string): void {
    this.lines.push("", ...wrapText(value.toUpperCase(), 92));
  }

  text(value: string): void {
    this.lines.push(...wrapText(value, 92));
  }

  bullet(value: string): void {
    this.lines.push(...wrapText(`- ${value}`, 92));
  }

  keyValue(key: string, value: string | number | null | undefined): void {
    this.lines.push(...wrapText(`${key}: ${value ?? "-"}`, 92));
  }

  table(headers: string[], rows: (string | number | null | undefined)[][]): void {
    if (headers.length === 0) return;
    const widths = headers.map((header, index) => {
      const longestCell = rows.reduce(
        (longest, row) => Math.max(longest, readableText(row[index]).length),
        readableText(header).length,
      );
      return Math.min(index === 0 ? 32 : 20, Math.max(8, longestCell));
    });
    const formatRow = (values: (string | number | null | undefined)[]) =>
      widths
        .map((width, index) => readableText(values[index]).slice(0, width).padEnd(width))
        .join("  ")
        .trimEnd();
    this.lines.push(formatRow(headers), "-".repeat(Math.min(92, widths.reduce((a, b) => a + b, 0) + (headers.length - 1) * 2)));
    for (const row of rows) this.lines.push(formatRow(row));
    this.lines.push("");
  }

  spacer(points = 6): void {
    if (points > 0) this.lines.push("");
  }

  build(): Buffer {
    return textPdf(this.title, this.lines);
  }
}

export function buildPdf(title: string, subtitle: string, write: (doc: PdfBuilder) => void): Buffer {
  const doc = new PdfBuilder(title, subtitle);
  write(doc);
  return doc.build();
}

export function sendPdf(res: Response, filename: string, bytes: Buffer): void {
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", String(bytes.length));
  res.send(bytes);
}
