/**
 * fileIngestion.ts
 *
 * Multi-file ingestion engine for Deal Data Room V1.
 * Accepts in-memory Multer file buffers and extracts plain text from:
 *   PDF, Excel (.xlsx/.xls), CSV, TXT, DOCX, and ZIP (recursively processes contents).
 *
 * Rules:
 *   - All parsing is done in-memory (no temp files written to disk).
 *   - ZIP files are unpacked and each contained file is processed individually.
 *   - Extraction errors per file are non-fatal: they are captured and returned
 *     in the `errors` array so the caller can surface them to the user.
 *   - Total combined text is capped at MAX_COMBINED_CHARS to protect LLM context.
 */

import * as XLSX from "xlsx";
import JSZip from "jszip";
import mammoth from "mammoth";
// pdf-parse v2 exports a class-based API: new PDFParse({ data: buffer }).getText()
// Direct ESM import so vitest vi.mock("pdf-parse") can intercept it in tests.
import { PDFParse } from "pdf-parse";

/** Maximum combined characters fed to the extraction LLM (~60k tokens). */
const MAX_COMBINED_CHARS = 80_000;

/** Maximum size per individual file (20 MB). */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface IngestedFile {
  /** Original filename as uploaded or found inside a ZIP. */
  fileName: string;
  /** Extracted plain text content. Empty string if extraction failed. */
  text: string;
  /** MIME type or inferred type. */
  mimeType: string;
  /** Number of characters extracted. */
  charCount: number;
  /** True if the file was inside a ZIP archive. */
  fromZip: boolean;
  /** Name of the parent ZIP file if fromZip is true. */
  zipSource?: string;
}

export interface IngestionResult {
  /** All successfully parsed files with their extracted text. */
  files: IngestedFile[];
  /** Combined text from all files, truncated to MAX_COMBINED_CHARS. */
  combinedText: string;
  /** Total characters before truncation. */
  totalChars: number;
  /** True if combinedText was truncated. */
  truncated: boolean;
  /** Non-fatal per-file errors (file name → error message). */
  errors: Array<{ fileName: string; error: string }>;
}

// ── Supported MIME types / extensions ────────────────────────────────────────

const PDF_EXTS   = new Set(["pdf"]);
const EXCEL_EXTS = new Set(["xlsx", "xls", "xlsm", "xlsb"]);
const CSV_EXTS   = new Set(["csv"]);
const TEXT_EXTS  = new Set(["txt", "md", "json", "xml", "yaml", "yml", "html", "htm", "log", "rst"]);
const DOCX_EXTS  = new Set(["docx", "doc"]);
const ZIP_EXTS   = new Set(["zip"]);

function getExt(fileName: string): string {
  return (fileName.split(".").pop() ?? "").toLowerCase();
}

// ── Single-file text extractor ────────────────────────────────────────────────

async function extractTextFromBuffer(buf: Buffer, fileName: string): Promise<string> {
  const ext = getExt(fileName);

  if (PDF_EXTS.has(ext)) {
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    return result.text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  if (EXCEL_EXTS.has(ext)) {
    const workbook = XLSX.read(buf, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) parts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }
    return parts.join("\n\n").trim();
  }

  if (CSV_EXTS.has(ext) || TEXT_EXTS.has(ext)) {
    return buf.toString("utf-8").trim();
  }

  if (DOCX_EXTS.has(ext)) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Fallback: attempt UTF-8 decode
  const fallback = buf.toString("utf-8").trim();
  if (fallback.length > 0) return fallback;

  throw new Error(`Unsupported file type: .${ext}`);
}

// ── ZIP unpacker ──────────────────────────────────────────────────────────────

async function processZip(
  buf: Buffer,
  zipName: string
): Promise<{ files: IngestedFile[]; errors: Array<{ fileName: string; error: string }> }> {
  const zip = await JSZip.loadAsync(buf);
  const files: IngestedFile[] = [];
  const errors: Array<{ fileName: string; error: string }> = [];

  const entries = Object.values(zip.files).filter((f) => !f.dir);

  for (const entry of entries) {
    const entryName = entry.name;
    const ext = getExt(entryName);

    // Skip unsupported or system files
    if (
      entryName.startsWith("__MACOSX") ||
      entryName.startsWith(".") ||
      ext === "zip" // nested ZIPs: skip to avoid recursion complexity
    ) {
      continue;
    }

    try {
      const entryBuf = Buffer.from(await entry.async("arraybuffer"));
      if (entryBuf.length > MAX_FILE_BYTES) {
        errors.push({ fileName: entryName, error: "File exceeds 20 MB limit — skipped" });
        continue;
      }
      const text = await extractTextFromBuffer(entryBuf, entryName);
      files.push({
        fileName: entryName,
        text,
        mimeType: `application/${ext}`,
        charCount: text.length,
        fromZip: true,
        zipSource: zipName,
      });
    } catch (err) {
      errors.push({
        fileName: entryName,
        error: err instanceof Error ? err.message : "Extraction failed",
      });
    }
  }

  return { files, errors };
}

// ── Main ingestion function ───────────────────────────────────────────────────

/**
 * Ingest an array of Multer file objects (in-memory buffers).
 * Returns combined text and per-file metadata.
 */
export async function ingestFiles(
  multerFiles: Array<{ originalname: string; buffer: Buffer; mimetype: string; size: number }>
): Promise<IngestionResult> {
  const allFiles: IngestedFile[] = [];
  const allErrors: Array<{ fileName: string; error: string }> = [];

  for (const mf of multerFiles) {
    if (mf.size > MAX_FILE_BYTES) {
      allErrors.push({ fileName: mf.originalname, error: "File exceeds 20 MB limit — skipped" });
      continue;
    }

    const ext = getExt(mf.originalname);

    if (ZIP_EXTS.has(ext)) {
      const { files, errors } = await processZip(mf.buffer, mf.originalname);
      allFiles.push(...files);
      allErrors.push(...errors);
      continue;
    }

    try {
      const text = await extractTextFromBuffer(mf.buffer, mf.originalname);
      allFiles.push({
        fileName: mf.originalname,
        text,
        mimeType: mf.mimetype,
        charCount: text.length,
        fromZip: false,
      });
    } catch (err) {
      allErrors.push({
        fileName: mf.originalname,
        error: err instanceof Error ? err.message : "Extraction failed",
      });
    }
  }

  // Build combined text with clear file separators
  const parts = allFiles
    .filter((f) => f.text.length > 0)
    .map((f) => {
      const source = f.fromZip ? `${f.zipSource} → ${f.fileName}` : f.fileName;
      return `\n\n=== SOURCE: ${source} ===\n${f.text}`;
    });

  const rawCombined = parts.join("").trim();
  const truncated = rawCombined.length > MAX_COMBINED_CHARS;
  const combinedText = truncated
    ? rawCombined.slice(0, MAX_COMBINED_CHARS) + "\n\n[... content truncated to fit context window ...]"
    : rawCombined;

  return {
    files: allFiles,
    combinedText,
    totalChars: rawCombined.length,
    truncated,
    errors: allErrors,
  };
}
