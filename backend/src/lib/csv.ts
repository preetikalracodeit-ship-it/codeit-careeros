import type { Response } from "express";

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: unknown[][]): Buffer {
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n") + "\r\n";
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(body, "utf8")]);
}

export function sendCsv(res: Response, filename: string, bytes: Buffer): void {
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "text/csv;charset=UTF-8");
  res.setHeader("Content-Length", String(bytes.length));
  res.send(bytes);
}

/** Parses RFC-4180 style CSV (supports quoted cells and CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (closedQuote && char === ",") {
      row.push(cell);
      cell = "";
      closedQuote = false;
    } else if (closedQuote && (char === "\r" || char === "\n")) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      closedQuote = false;
      if (char === "\r" && source[index + 1] === "\n") index += 1;
    } else if (closedQuote) {
      throw new Error("CSV contains unexpected characters after a quoted field");
    } else if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === '"') {
      throw new Error("CSV contains a quote inside an unquoted field");
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (source[index + 1] === "\n") index += 1;
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => value.trim() !== ""));
}
