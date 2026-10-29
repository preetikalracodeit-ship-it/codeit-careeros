const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const TOP_Y = 796;
const BOTTOM_Y = 58;

type FontName = "regular" | "bold" | "mono" | "monoBold";

interface PdfLine {
  text: string;
  font: FontName;
  size: number;
  color?: "orange" | "muted" | "black";
  height: number;
}

const FONT_RESOURCE: Record<FontName, string> = {
  regular: "F1",
  bold: "F2",
  mono: "F3",
  monoBold: "F4",
};

const MAX_CHARS: Record<FontName, number> = {
  regular: 94,
  bold: 86,
  mono: 92,
  monoBold: 92,
};

function sanitize(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7e]/g, "?");
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(value: string, maxChars: number): string[] {
  const text = sanitize(value).replace(/\s+/g, " ").trim();
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + word.length + 1 <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function truncate(value: string, maxChars: number): string {
  const text = sanitize(value);
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

export class PdfBuilder {
  private readonly pages: PdfLine[][] = [[]];
  private y = TOP_Y;

  constructor(title: string, subtitle: string) {
    this.pushLine("CODEIT CareerOS", "bold", 10, "muted", 8);
    this.pushLine(title, "bold", 19, "black", 10);
    this.pushLine(subtitle, "regular", 9, "muted", 4);
    this.spacer(6);
    this.rule();
  }

  private get current(): PdfLine[] {
    return this.pages[this.pages.length - 1]!;
  }

  private pushLine(
    text: string,
    font: FontName,
    size: number,
    color: PdfLine["color"],
    gapBefore = 0,
  ): void {
    const height = size * 1.55 + gapBefore;
    if (this.y - height < BOTTOM_Y) {
      this.pages.push([]);
      this.y = TOP_Y;
    } else {
      this.y -= gapBefore;
    }
    this.current.push({ text, font, size, color, height });
    this.y -= height - gapBefore;
  }

  private lines(
    value: string,
    font: FontName,
    size: number,
    color: PdfLine["color"],
    gapBefore = 0,
  ): void {
    const wrapped = wrapText(value, MAX_CHARS[font]);
    wrapped.forEach((line, index) => {
      this.pushLine(line, font, size, color, index === 0 ? gapBefore : 0);
    });
  }

  spacer(points = 6): void {
    this.pushLine("", "regular", points, "black");
  }

  private rule(): void {
    this.lines("-".repeat(MAX_CHARS.mono), "mono", 8, "muted", 2);
  }

  heading(value: string): void {
    this.lines(value, "bold", 12.5, "orange", 12);
  }

  text(value: string): void {
    this.lines(value, "regular", 10, "black");
  }

  bullet(value: string): void {
    this.lines(`- ${value}`, "regular", 10, "black");
  }

  keyValue(key: string, value: string | number | null | undefined): void {
    this.lines(`${key}: ${value ?? "-"}`, "regular", 10, "black");
  }

  table(headers: string[], rows: (string | number | null | undefined)[][]): void {
    const columns = headers.length;
    if (columns === 0) return;
    const firstWidth = columns === 1 ? MAX_CHARS.mono : Math.min(34, Math.max(18, Math.floor(MAX_CHARS.mono * 0.36)));
    const otherWidth = columns === 1 ? 0 : Math.floor((MAX_CHARS.mono - firstWidth - 2 * (columns - 1)) / (columns - 1));
    const widths = headers.map((_, index) => (index === 0 ? firstWidth : otherWidth));
    const formatRow = (values: (string | number | null | undefined)[]) =>
      widths
        .map((width, index) => truncate(String(values[index] ?? "-"), width).padEnd(width))
        .join("  ")
        .trimEnd();

    this.lines(formatRow(headers), "monoBold", 8.5, "black", 3);
    this.lines("-".repeat(MAX_CHARS.mono), "mono", 8, "muted");
    for (const row of rows) {
      this.lines(formatRow(row), "mono", 8.5, "black");
    }
    this.spacer(4);
  }

  build(): Buffer {
    const body: string[] = [];
    const objects: string[] = [];
    const pageCount = this.pages.length;
    const firstFontObject = 3 + pageCount * 2;
    const fontObjects: Record<FontName, number> = {
      regular: firstFontObject,
      bold: firstFontObject + 1,
      mono: firstFontObject + 2,
      monoBold: firstFontObject + 3,
    };
    const totalObjects = 2 + pageCount * 2 + 4;

    const pageContent = this.pages.map((lines, pageIndex) => {
      const commands: string[] = [];
      let y = TOP_Y;
      for (const line of lines) {
        if (line.text) {
          const color =
            line.color === "orange"
              ? "0.96 0.45 0.09 rg"
              : line.color === "muted"
                ? "0.42 0.45 0.43 rg"
                : "0 0 0 rg";
          commands.push(
            `${color} BT /${FONT_RESOURCE[line.font]} ${line.size} Tf ${MARGIN_X} ${y.toFixed(2)} Td (${escapePdf(line.text)}) Tj ET`,
          );
        }
        y -= line.height;
      }
      const footer = `0.56 0.6 0.58 rg BT /F1 8 Tf ${MARGIN_X} 30 Td (CareerOS - Career Development Report   Page ${pageIndex + 1} of ${pageCount}) Tj ET`;
      commands.push(footer);
      return commands.join("\n");
    });

    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    const kids = this.pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ");
    objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
    this.pages.forEach((_, index) => {
      const pageObject = 3 + index * 2;
      const contentObject = pageObject + 1;
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjects.regular} 0 R /F2 ${fontObjects.bold} 0 R /F3 ${fontObjects.mono} 0 R /F4 ${fontObjects.monoBold} 0 R >> >> /Contents ${contentObject} 0 R >>`,
      );
      const content = pageContent[index]!;
      objects.push(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
    });
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>");

    body.push("%PDF-1.4");
    const offsets: number[] = [];
    let cursor = Buffer.byteLength(body[0]!, "latin1") + 1;
    for (let index = 0; index < objects.length; index += 1) {
      const objectText = `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
      offsets.push(cursor);
      body.push(objectText.replace(/\n$/, ""));
      cursor += Buffer.byteLength(objectText, "latin1");
    }
    const xrefOffset = cursor;
    const xrefLines = [`xref`, `0 ${totalObjects + 1}`, "0000000000 65535 f "];
    for (const offset of offsets) {
      xrefLines.push(`${String(offset).padStart(10, "0")} 00000 n `);
    }
    xrefLines.push("trailer", `<< /Size ${totalObjects + 1} /Root 1 0 R >>`, "startxref", String(xrefOffset), "%%EOF");
    body.push(xrefLines.join("\n"));
    return Buffer.from(body.join("\n"), "latin1");
  }
}

export function buildPdf(title: string, subtitle: string, write: (doc: PdfBuilder) => void): Buffer {
  const doc = new PdfBuilder(title, subtitle);
  write(doc);
  return doc.build();
}
