/**
 * dataRoomUploadRoute.ts
 *
 * POST /api/dataroom/upload
 *   Accepts: multipart/form-data with one or more files (TXT, PDF, DOCX, MD) or a single ZIP.
 *   Each filename should contain "gcc", "global", or "india" to indicate council mode.
 *   Returns: array of { dealName, dealText, councilMode } for the frontend to process.
 *
 * POST /api/dataroom/bulk-pdf
 *   Accepts: JSON array of IC Memo inputs.
 *   Returns: ZIP file containing all IC Memo PDFs.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import JSZip from "jszip";
import { ingestFiles, type IngestedFile } from "./fileIngestion";
import { generateICMemoPdf, type ICMemoInput } from "./icMemoPdf";
import { sdk } from "./_core/sdk";

const router = Router();

// ── Multer config ─────────────────────────────────────────────────────────────
const ALLOWED_MIMETYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);
const ALLOWED_EXTENSIONS = /\.(pdf|txt|md|docx|doc|zip)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED_MIMETYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.test(file.originalname);
    if (!ok) { cb(new Error(`Unsupported file: ${file.originalname}`)); return; }
    cb(null, true);
  },
});

// ── Council mode detection from filename ─────────────────────────────────────
export function detectCouncilMode(filename: string): "gcc" | "global_vc" | "india_pe" {
  const lower = filename.toLowerCase();
  if (lower.includes("india") || lower.includes("india_pe") || lower.includes("indiape")) return "india_pe";
  if (lower.includes("global") || lower.includes("globalvc") || lower.includes("global_vc")) return "global_vc";
  return "gcc"; // default
}

// ── Auth helper ───────────────────────────────────────────────────────────────
function isInternalMode(): boolean {
  return process.env.ENABLE_INTERNAL_SCREEN_API === "true";
}

async function resolveUser(req: Request): Promise<{ id: number } | null> {
  // Allow bypass in internal testing / open-access mode
  if (isInternalMode()) return { id: 0 };
  try {
    return await sdk.authenticateRequest(req) ?? null;
  } catch {
    return null;
  }
}

// ── POST /api/dataroom/upload ─────────────────────────────────────────────────
router.post(
  "/upload",
  upload.array("files", 50),
  async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ success: false, error: "No files uploaded." });
        return;
      }

      // Ingest all files (handles ZIP extraction, PDF parsing, etc.)
      const ingested = await ingestFiles(
        files.map((f) => ({ buffer: f.buffer, originalname: f.originalname, mimetype: f.mimetype, size: f.size }))
      );

      if (ingested.files.length === 0) {
        res.status(400).json({ success: false, error: "No readable content found in uploaded files." });
        return;
      }

      // Build deal list — one deal per ingested file
      const deals = ingested.files
        .filter((r: IngestedFile) => r.text && r.text.trim().length > 50)
        .map((r: IngestedFile) => {
          // Strip extension for deal name
          const dealName = r.fileName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim();
          const councilMode = detectCouncilMode(r.fileName);
          return {
            dealName,
            dealText: r.text.trim(),
            councilMode,
            sourceFile: r.fileName,
            fromZip: r.fromZip ?? false,
            zipSource: r.zipSource,
          };
        });

      if (deals.length === 0) {
        res.status(400).json({ success: false, error: "Files contained no usable deal text (minimum 50 characters per file)." });
        return;
      }

      res.json({
        success: true,
        deals,
        summary: {
          totalFiles: files.length,
          totalDeals: deals.length,
          councilBreakdown: {
            gcc: deals.filter((d) => d.councilMode === "gcc").length,
            global_vc: deals.filter((d) => d.councilMode === "global_vc").length,
            india_pe: deals.filter((d) => d.councilMode === "india_pe").length,
          },
        },
      });
    } catch (err) {
      console.error("[DataRoom/upload]", err);
      res.status(500).json({ success: false, error: "Upload processing failed." });
    }
  }
);

// ── POST /api/dataroom/bulk-pdf ───────────────────────────────────────────────
/**
 * Accepts an array of IC Memo inputs, generates a PDF for each, and returns
 * a ZIP file containing all PDFs — for bulk download (like Gmail attachment zip).
 */
router.post("/bulk-pdf", async (req: Request, res: Response) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      res.status(401).json({ success: false, error: "Authentication required." });
      return;
    }

    const { memos } = req.body as { memos: Array<ICMemoInput & { dealName: string }> };
    if (!Array.isArray(memos) || memos.length === 0) {
      res.status(400).json({ success: false, error: "memos array is required." });
      return;
    }

    const zip = new JSZip();
    const errors: string[] = [];

    // Generate PDFs sequentially to avoid memory spikes
    for (const memo of memos) {
      try {
        const pdfBuffer = await generateICMemoPdf(memo);
        const safeName = (memo.dealName || "Deal")
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .slice(0, 60);
        zip.file(`IC-Memo-${safeName}.pdf`, pdfBuffer);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${memo.dealName}: ${msg}`);
        console.error(`[DataRoom/bulk-pdf] Failed for ${memo.dealName}:`, err);
      }
    }

    if (Object.keys(zip.files).length === 0) {
      res.status(500).json({ success: false, error: "All PDF generations failed.", errors });
      return;
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `AgenThinkMesh-IC-Memos-${timestamp}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", zipBuffer.length);
    res.send(zipBuffer);
  } catch (err) {
    console.error("[DataRoom/bulk-pdf]", err);
    res.status(500).json({ success: false, error: "Bulk PDF generation failed." });
  }
});

export { router as dataRoomUploadRouter };
