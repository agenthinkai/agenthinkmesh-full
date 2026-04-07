/**
 * dealIngestionRoute.ts
 *
 * POST /api/deals/ingest
 *
 * Deal Data Room Ingestion V1 endpoint.
 * Accepts multiple files (PDF, Excel, CSV, TXT, DOCX, ZIP — max 20 MB each,
 * max 10 files per request), parses them, and runs strict LLM extraction
 * to return a structured deal data object for the frontend review step.
 *
 * This route does NOT run the Council of 10. It only ingests and extracts.
 * The frontend review step then submits the reviewed data to the existing
 * /api/trpc/dealScreener.screen endpoint.
 *
 * Non-negotiable rules (enforced here and in dealExtraction.ts):
 *   - No hallucination
 *   - No inferred financials
 *   - Null for any missing field
 *   - Source snippets attached to critical fields
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { ingestFiles } from "./fileIngestion";
import { extractDealData } from "./dealExtraction";

const MAX_FILES       = 10;
const MAX_FILE_SIZE   = 20 * 1024 * 1024; // 20 MB per file

const ALLOWED_MIMETYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  // xlsx
  "application/vnd.ms-excel",                                            // xls
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword",                                                  // doc
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream", // some browsers send this for xlsx/zip
]);

const ALLOWED_EXTENSIONS = /\.(pdf|xlsx|xls|csv|txt|docx|doc|zip|md|json|yaml|yml)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter: (_req, file, cb) => {
    const mimeOk = ALLOWED_MIMETYPES.has(file.mimetype);
    const extOk  = ALLOWED_EXTENSIONS.test(file.originalname);
    if (mimeOk || extOk) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.originalname}. Allowed: PDF, Excel, CSV, TXT, DOCX, ZIP.`));
    }
  },
});

const dealIngestionRouter = Router();

/**
 * POST /api/deals/ingest
 *
 * Multipart form-data fields:
 *   files[]  — one or more files (max 10, max 20 MB each)
 *
 * Response:
 *   {
 *     success: true,
 *     extraction: ExtractedDealData,
 *     ingestion: {
 *       fileCount: number,
 *       totalChars: number,
 *       truncated: boolean,
 *       files: Array<{ fileName, charCount, fromZip, zipSource? }>,
 *       errors: Array<{ fileName, error }>,
 *     }
 *   }
 */
dealIngestionRouter.post(
  "/ingest",
  upload.array("files", MAX_FILES),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        res.status(400).json({ error: "No files provided. Please upload at least one file." });
        return;
      }

      // ── Step 1: Parse all files ──────────────────────────────────────────
      const ingestionResult = await ingestFiles(
        files.map((f) => ({
          originalname: f.originalname,
          buffer: f.buffer,
          mimetype: f.mimetype,
          size: f.size,
        }))
      );

      if (ingestionResult.combinedText.trim().length === 0) {
        res.status(422).json({
          error:
            "No text could be extracted from the uploaded files. " +
            "Files may be scanned images, password-protected, or in an unsupported format.",
          ingestionErrors: ingestionResult.errors,
        });
        return;
      }

      // ── Step 2: LLM extraction ───────────────────────────────────────────
      const extraction = await extractDealData(ingestionResult.combinedText);

      // ── Step 3: Return structured result ────────────────────────────────
      res.json({
        success: true,
        extraction,
        ingestion: {
          fileCount: ingestionResult.files.length,
          totalChars: ingestionResult.totalChars,
          truncated: ingestionResult.truncated,
          files: ingestionResult.files.map((f) => ({
            fileName: f.fileName,
            charCount: f.charCount,
            fromZip: f.fromZip,
            zipSource: f.zipSource ?? null,
          })),
          errors: ingestionResult.errors,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingestion failed";
      console.error("[dealIngestion] Error:", err);
      res.status(500).json({ error: message });
    }
  }
);

export default dealIngestionRouter;
