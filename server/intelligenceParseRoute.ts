/**
 * Intelligence Agent — Document Parse Route
 * POST /api/intelligence/parse-document
 * Accepts PDF, DOCX, or TXT uploads and returns extracted text for analysis
 */
import { Router } from "express";
import multer from "multer";
import { createRequire } from "module";
import mammoth from "mammoth";

const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PDFParse } = _require("pdf-parse") as { PDFParse: new (opts: { data: Buffer | Uint8Array }) => { getText(): Promise<{ text: string; total: number }> } };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx|txt)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, and TXT files are supported"));
    }
  },
});

const router = Router();

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { buffer, originalname, mimetype } = req.file;
    let text = "";

    if (mimetype === "application/pdf" || originalname.toLowerCase().endsWith(".pdf")) {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text;
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      originalname.toLowerCase().endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      // Plain text
      text = buffer.toString("utf-8");
    }

    // Clean up whitespace
    text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    if (!text) {
      res.status(422).json({ error: "Could not extract text from this document. The file may be scanned or image-based." });
      return;
    }

    res.json({
      text,
      filename: originalname,
      charCount: text.length,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse document";
    res.status(500).json({ error: message });
  }
});

export default router;
