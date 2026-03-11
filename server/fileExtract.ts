/**
 * fileExtract.ts
 * Downloads a file from a URL and extracts its text content.
 * Supports: XLSX, XLS, CSV, TXT, PDF, DOCX, DOC
 */
import https from "https";
import http from "http";
import * as XLSX from "xlsx";

/** Download a URL to a Buffer (follows redirects, up to 3 hops) */
async function downloadBuffer(url: string, hops = 0): Promise<Buffer> {
  if (hops > 3) throw new Error("Too many redirects downloading file");
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadBuffer(res.headers.location, hops + 1));
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} downloading file`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/** Extract plain text from a file buffer given its filename */
async function extractTextFromBuffer(buf: Buffer, fileName: string): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "csv" || ext === "txt") {
    return buf.toString("utf-8");
  }

  if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(buf, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) parts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }
    return parts.join("\n\n");
  }

  if (ext === "pdf") {
    // Dynamic import to avoid ESM/CJS issues at module load time
    const mod = await import("pdf-parse");
    // pdf-parse v2 is ESM-native; the named export is the function itself
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (mod as any).default ?? (mod as any);
    const result = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buf);
    return result.text;
  }

  if (ext === "docx" || ext === "doc") {
    const mod = await import("mammoth");
    const mammoth = (mod.default ?? mod) as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value;
  }

  // Fallback: try UTF-8 text
  return buf.toString("utf-8");
}

/** Maximum characters to inject into LLM context (~60k tokens) */
const MAX_CHARS = 80_000;

/**
 * Download and extract text from a remote file URL.
 * Returns a trimmed string ready to inject into an LLM prompt.
 */
export async function extractFileContent(fileUrl: string, fileName: string): Promise<string> {
  const buf = await downloadBuffer(fileUrl);
  const text = await extractTextFromBuffer(buf, fileName);
  if (text.length > MAX_CHARS) {
    return text.slice(0, MAX_CHARS) + "\n\n[... content truncated to fit context window ...]";
  }
  return text;
}
