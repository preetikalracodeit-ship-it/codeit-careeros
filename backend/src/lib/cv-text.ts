import { inflateRawSync, inflateSync } from "node:zlib";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(\+?\d[\d\s\-().]{7,}\d)/;

function decodePdfLiteral(raw: string): string {
  let result = "";
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]!;
    if (char !== "\\") {
      result += char;
      continue;
    }
    const next = raw[index + 1];
    index += 1;
    if (next === undefined) break;
    switch (next) {
      case "n":
        result += "\n";
        break;
      case "r":
        result += "\r";
        break;
      case "t":
        result += "\t";
        break;
      case "b":
        result += "\b";
        break;
      case "f":
        result += "\f";
        break;
      case "(":
      case ")":
      case "\\":
        result += next;
        break;
      case "\n":
        break;
      case "\r":
        if (raw[index + 1] === "\n") index += 1;
        break;
      default: {
        if (/[0-7]/.test(next)) {
          let octal = next;
          while (octal.length < 3 && /[0-7]/.test(raw[index + 1] ?? "")) {
            index += 1;
            octal += raw[index];
          }
          result += String.fromCharCode(Number.parseInt(octal, 8));
        } else {
          result += next;
        }
      }
    }
  }
  return result;
}

function decodePdfHex(raw: string): string {
  const hex = raw.replace(/[^0-9a-f]/gi, "");
  const padded = hex.length % 2 === 0 ? hex : `${hex}0`;
  const bytes: number[] = [];
  for (let index = 0; index < padded.length; index += 2) {
    bytes.push(Number.parseInt(padded.slice(index, index + 2), 16));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let result = "";
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      result += String.fromCharCode((bytes[index]! << 8) | bytes[index + 1]!);
    }
    return result;
  }
  return Buffer.from(bytes).toString("latin1");
}

function readPdfLiteral(content: string, start: number): [string, number] {
  let depth = 1;
  let index = start + 1;
  let raw = "";
  while (index < content.length && depth > 0) {
    const char = content[index]!;
    if (char === "\\") {
      raw += char + (content[index + 1] ?? "");
      index += 2;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        index += 1;
        break;
      }
    }
    raw += char;
    index += 1;
  }
  return [decodePdfLiteral(raw), index];
}

function extractFromContent(content: string): string {
  let output = "";
  let pending: string[] = [];
  let index = 0;
  const flush = (newline: boolean) => {
    if (pending.length > 0) {
      output += pending.join("");
      pending = [];
    }
    if (newline) output += "\n";
  };
  while (index < content.length) {
    const char = content[index]!;
    if (char === "%" ) {
      while (index < content.length && content[index] !== "\n" && content[index] !== "\r") index += 1;
      continue;
    }
    if (char === "(") {
      const [text, next] = readPdfLiteral(content, index);
      pending.push(text);
      index = next;
      continue;
    }
    if (char === "<" && content[index + 1] !== "<") {
      const end = content.indexOf(">", index + 1);
      if (end === -1) break;
      pending.push(decodePdfHex(content.slice(index + 1, end)));
      index = end + 1;
      continue;
    }
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    let end = index;
    while (end < content.length && !/[\s()<>[\]{}]/.test(content[end]!)) end += 1;
    if (end === index) {
      index += 1;
      continue;
    }
    const token = content.slice(index, end);
    index = end;
    if (token === "Tj" || token === "TJ" || token === "'" || token === '"') {
      flush(false);
    } else if (token === "Td" || token === "TD" || token === "T*" || token === "ET") {
      flush(true);
    } else if (token === "BT") {
      pending = [];
    }
  }
  flush(true);
  return output;
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .split(String.fromCharCode(0)).join("")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, lines) => line.length > 0 && (index === 0 || line !== lines[index - 1]))
    .join("\n")
    .trim();
}

export function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < raw.length) {
    const streamIndex = raw.indexOf("stream", cursor);
    if (streamIndex === -1) break;
    const dictionaryStart = raw.lastIndexOf("<<", streamIndex);
    const dictionary = dictionaryStart === -1 ? "" : raw.slice(dictionaryStart, streamIndex);
    let dataStart = streamIndex + "stream".length;
    if (raw[dataStart] === "\r") dataStart += 1;
    if (raw[dataStart] === "\n") dataStart += 1;
    const endIndex = raw.indexOf("endstream", dataStart);
    if (endIndex === -1) break;
    const data = buffer.subarray(dataStart, endIndex);
    let decoded: Buffer | null;
    if (dictionary.includes("/FlateDecode")) {
      try {
        decoded = inflateSync(data);
      } catch {
        try {
          decoded = inflateRawSync(data);
        } catch {
          decoded = null;
        }
      }
    } else {
      decoded = data;
    }
    if (decoded) chunks.push(extractFromContent(decoded.toString("latin1")));
    cursor = endIndex + "endstream".length;
  }
  const text = cleanExtractedText(chunks.join("\n"));
  if (text.length < 20) {
    throw new Error("We could not read any text from this PDF. Upload a text-based PDF instead of a scan.");
  }
  return text;
}

interface ZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd === -1) throw new Error("This DOCX file is not a valid Office document.");
  const count = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const compression = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    entries.push({ name, compression, compressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  const local = entry.localHeaderOffset;
  if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error("This DOCX file is damaged.");
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const dataStart = local + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compression === 0) return compressed;
  if (entry.compression === 8) return inflateRawSync(compressed);
  throw new Error("This DOCX file uses an unsupported compression method.");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, digits: string) => String.fromCodePoint(Number.parseInt(digits, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function extractDocxText(buffer: Buffer): string {
  const entries = readZipEntries(buffer);
  const documentEntry = entries.find((entry) => entry.name === "word/document.xml");
  if (!documentEntry) throw new Error("This DOCX file does not contain a readable document.");
  const xml = readZipEntry(buffer, documentEntry).toString("utf8");
  const text = xml
    .replace(/<w:tab[^>]*\/>/gi, "\t")
    .replace(/<w:br[^>]*\/>/gi, "\n")
    .replace(/<w:cr[^>]*\/>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<\/w:tr>/gi, "\n")
    .replace(/<\/w:tc>/gi, "\t")
    .replace(/<[^>]+>/g, "");
  const cleaned = cleanExtractedText(decodeXmlEntities(text));
  if (cleaned.length < 20) throw new Error("We could not read any text from this DOCX file.");
  return cleaned;
}

export function extractLegacyDocText(buffer: Buffer): string {
  const ascii = buffer.toString("latin1").match(/[\x20-\x7e\r\n\t]{4,}/g) ?? [];
  const utf16: string[] = [];
  let run = "";
  for (let index = 0; index + 1 < buffer.length; index += 2) {
    const code = buffer.readUInt16LE(index);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) {
      run += String.fromCharCode(code);
    } else {
      if (run.length >= 4) utf16.push(run);
      run = "";
    }
  }
  if (run.length >= 4) utf16.push(run);
  const combined = cleanExtractedText([...utf16, ...ascii].join("\n"));
  if (combined.length < 20) {
    throw new Error("We could not read this DOC file. Save it as PDF or DOCX and upload again.");
  }
  return combined;
}

export function extractCvText(buffer: Buffer, extension: string): string {
  if (extension === "pdf") return extractPdfText(buffer);
  if (extension === "docx") return extractDocxText(buffer);
  return extractLegacyDocText(buffer);
}

export function emailEvidence(text: string): string | null {
  const match = EMAIL_PATTERN.exec(text);
  return match ? truncateEvidence(match[0]) : null;
}

export function phoneEvidence(text: string): string | null {
  const pattern = new RegExp(PHONE_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const digits = match[1]!.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) return truncateEvidence(match[1]!);
  }
  return null;
}

function truncateEvidence(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export function candidateNameFromText(text: string): string | null {
  for (const rawLine of text.split("\n").slice(0, 12)) {
    const line = rawLine.trim();
    if (line.length < 2 || line.length > 60) continue;
    if (EMAIL_PATTERN.test(line) || phoneEvidence(line)) continue;
    if (/resume|curriculum vitae|^cv$/i.test(line)) continue;
    if (/codeit|careeros|page \d+/i.test(line)) continue;
    if (/^(professional |career |work )?(summary|profile|objective|skills|experience|education|projects|certifications|contact)/i.test(line)) continue;
    if (/\d/.test(line) || /[|<>{}]/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length > 4 || words.some((word) => !/^[A-Za-z][A-Za-z.'-]*$/.test(word))) continue;
    return line;
  }
  return null;
}

const STOPWORDS = new Set([
  "administration", "administrator", "fundamentals", "fundamental", "operations", "operation", "testing", "design", "designer",
  "analysis", "analyst", "analytics", "engineering", "engineer", "development", "developer", "management", "manager",
  "language", "languages", "processing", "learning", "system", "systems", "application", "applications", "rest", "data",
  "power", "deep", "natural", "security",
]);

const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ["js", "es 6"], typescript: ["ts"], python: ["py"],
  sql: ["mysql", "postgresql", "postgres", "sqlite", "pl sql", "t sql"],
  react: ["reactjs", "react.js"], "node.js": ["nodejs", "node"], "machine learning": ["ml"],
  "deep learning": ["dl"], "natural language processing": ["nlp"], "generative ai": ["genai", "ai"],
  kubernetes: ["k 8 s"], mongodb: ["mongo"], "rest apis": ["rest api", "restful"],
  microservices: ["microservice"], java: ["core java", "j 2 ee"], aws: ["amazon web services"],
  "ci cd jenkins": ["cicd"], "api testing": ["postman"], "penetration testing": ["pentest", "pen test"],
  "data visualization": ["tableau"], "database administration": ["database administrator"],
};

export function normalizeSkillText(value: string): string {
  return value.toLowerCase()
    .replace(/(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/g, " ")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();
}

function containsWord(text: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`).test(text);
}

function segmentMatches(text: string, segment: string): boolean {
  const tokens = segment.split(/[. ]+/).filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  if (tokens.length === 0) return false;
  if (tokens.length === 1 && (tokens[0] === "cloud" || tokens[0] === "database")) return containsWord(text, segment);
  let allPresent = true;
  for (const token of tokens) {
    if (containsWord(text, token)) {
      if (token.length >= 8) return true;
    } else {
      allPresent = false;
    }
  }
  return allPresent;
}

function segmentsOf(raw: string): string[] {
  const segments: string[] = [];
  const remainder = raw.replace(/\(([^()]*)\)/g, (_match, inner: string) => {
    for (const part of inner.split(/[&/]+/)) {
      const normalized = normalizeSkillText(part);
      if (normalized) segments.push(normalized);
    }
    return " ";
  });
  for (const part of remainder.split(/[&/]+/)) {
    const normalized = normalizeSkillText(part);
    if (normalized) segments.push(normalized);
  }
  return segments;
}

export function skillMentioned(normalizedText: string, skillName: string): boolean {
  const normalizedSkill = normalizeSkillText(skillName);
  if (!normalizedSkill) return false;
  if (containsWord(normalizedText, normalizedSkill)) return true;
  const compact = normalizedSkill.replace(/[^a-z0-9]+/g, "");
  if (compact.length >= 6 && normalizedText.replace(/[^a-z0-9]+/g, "").includes(compact)) return true;
  if ((SKILL_ALIASES[normalizedSkill] ?? []).some((alias) => containsWord(normalizedText, alias))) return true;
  const segments = segmentsOf(skillName);
  if (segments.length > 1) return segments.some((segment) => segmentMatches(normalizedText, segment));
  return segmentMatches(normalizedText, normalizedSkill);
}

