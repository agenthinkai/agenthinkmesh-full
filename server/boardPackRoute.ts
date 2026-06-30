/**
 * boardPackRoute.ts — Board Intelligence Pack Download Endpoints
 *
 * REST endpoints for downloading Board Intelligence Packs in three formats:
 *   POST /api/board-pack/download/pdf
 *   POST /api/board-pack/download/pptx
 *   POST /api/board-pack/download/docx
 *
 * Each endpoint accepts a pre-generated BoardPackData JSON body and returns
 * the formatted document as a binary download.
 *
 * Auth: Valid Manus session cookie required.
 */
import { Router, type Request, type Response } from "express";
import { sdk } from "./_core/sdk";
import { generateBoardPackPdf, generateBoardPackPptx, generateBoardPackDocx } from "./boardPackExport";
import type { BoardPackData } from "./routers/aros/boardPack";

const router = Router();

// ── Auth helper ───────────────────────────────────────────────────────────────
async function resolveUserId(req: Request): Promise<number | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function requireAuth(userId: number | null, res: Response): boolean {
  if (userId === null) {
    res.status(401).json({ success: false, error: "Authentication required." });
    return false;
  }
  return true;
}

function safeName(companyName: string): string {
  return companyName.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);
}

// ── POST /api/board-pack/download/pdf ─────────────────────────────────────────
router.post("/download/pdf", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!requireAuth(userId, res)) return;

  try {
    const pack = req.body as BoardPackData;
    if (!pack?.packId || !pack?.companyName) {
      res.status(400).json({ success: false, error: "Invalid Board Pack data." });
      return;
    }

    const pdfBuffer = await generateBoardPackPdf(pack);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `BoardPack_${safeName(pack.companyName)}_${dateStr}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[BoardPackRoute] PDF error:", err);
    res.status(500).json({ success: false, error: msg });
  }
});

// ── POST /api/board-pack/download/pptx ───────────────────────────────────────
router.post("/download/pptx", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!requireAuth(userId, res)) return;

  try {
    const pack = req.body as BoardPackData;
    if (!pack?.packId || !pack?.companyName) {
      res.status(400).json({ success: false, error: "Invalid Board Pack data." });
      return;
    }

    const pptxBuffer = await generateBoardPackPptx(pack);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `BoardPack_${safeName(pack.companyName)}_${dateStr}.pptx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pptxBuffer.length);
    res.send(pptxBuffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[BoardPackRoute] PPTX error:", err);
    res.status(500).json({ success: false, error: msg });
  }
});

// ── POST /api/board-pack/download/docx ───────────────────────────────────────
router.post("/download/docx", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!requireAuth(userId, res)) return;

  try {
    const pack = req.body as BoardPackData;
    if (!pack?.packId || !pack?.companyName) {
      res.status(400).json({ success: false, error: "Invalid Board Pack data." });
      return;
    }

    const docxBuffer = await generateBoardPackDocx(pack);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `BoardPack_${safeName(pack.companyName)}_${dateStr}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", docxBuffer.length);
    res.send(docxBuffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[BoardPackRoute] DOCX error:", err);
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
