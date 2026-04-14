/**
 * dealScreenerUploadRoute.ts
 * POST /api/deals/upload-pdf
 * Accepts a PDF file (max 5MB), extracts text via pdf-parse,
 * returns the first 1500 chars of extracted text.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PDFParse } = _require("pdf-parse") as { PDFParse: new (opts: { data: Buffer | Uint8Array }) => { getText(): Promise<{ text: string; total: number }> } };

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PAGES = 10;
const MAX_CHARS = 1500;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted"));
    }
  },
});

const dealScreenerUploadRouter = Router();

dealScreenerUploadRouter.post(
  "/upload-pdf",
  upload.single("pdf"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No PDF file provided" });
        return;
      }

      // Extract text using pdf-parse v2 class-based API
      const parser = new PDFParse({ data: req.file.buffer });
      const data = await parser.getText();

      const extractedText = data.text
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_CHARS);

      res.json({
        success: true,
        text: extractedText,
        pages: data.total,
        truncated: data.text.length > MAX_CHARS,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "PDF extraction failed";
      res.status(400).json({ error: message });
    }
  }
);

export default dealScreenerUploadRouter;
