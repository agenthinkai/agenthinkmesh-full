/**
 * legalRedlineRoute.ts — LegalRedline Mesh Backend
 *
 * Routes:
 *   POST /api/audit-contract          — Upload PDF (max 50MB), extract text, run LLM audit, return JSON
 *   POST /api/redline/checkout        — Stripe $1,200 checkout for full audit unlock
 *   GET  /api/redline/export-pdf/:id  — Stream PDFKit proof report for a completed audit
 *   GET  /api/redline/export-json/:id — Stream clean JSON audit trail
 *
 * Demo mode:
 *   If no Stripe key is configured, or if the request includes ?demo=true,
 *   the route returns a deterministic demo audit result without hitting Stripe.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { createRequire } from "module";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { legalAudits } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

const _require = createRequire(import.meta.url);
const { PDFParse } = _require("pdf-parse") as {
  PDFParse: new (opts: { data: Buffer | Uint8Array }) => {
    getText(): Promise<{ text: string; total: number }>;
  };
};

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_CONTRACT_CHARS = 80_000;       // ~60 pages of dense legal text
const AUDIT_PRICE_CENTS = 120_000;       // $1,200.00

// ── Multer ────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are accepted"));
  },
});

// ── Stripe helper ─────────────────────────────────────────────────────────────
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try { return new Stripe(key); } catch { return null; }
}

// ── LegalRedline system prompt ────────────────────────────────────────────────
const LEGALREDLINE_SYSTEM_PROMPT = `You are LegalRedline Mesh — an expert M&A and commercial contract auditor with 25 years of experience reviewing Share Purchase Agreements (SPAs), Shareholders' Agreements (SHAs), and Commercial Leases on behalf of institutional buyers, PE funds, and corporate counsel.

Your task is to perform a comprehensive clause-by-clause audit of the uploaded contract and return a structured JSON result.

AUDIT METHODOLOGY:
1. Identify every material clause (representations & warranties, indemnities, conditions precedent, MAC/MAE, non-compete, IP assignment, limitation of liability, termination, governing law, dispute resolution, payment terms, change of control, anti-dilution, drag-along/tag-along, etc.)
2. For each clause, assess it from the perspective of the BUYER/TENANT (the party signing, not drafting).
3. Classify risk level: CRITICAL (deal-breaker or major liability), WARNING (unfavourable but negotiable), CLEAR (market-standard or buyer-favourable).
4. Provide the exact original wording (up to 200 chars), the evaluating persona, a market benchmark citation, and a specific AI redline rewrite.

OUTPUT FORMAT — respond ONLY with valid JSON matching this exact schema:
{
  "contractType": "SPA" | "SHA" | "Commercial Lease" | "Other",
  "contractTitle": "<extracted title or filename>",
  "overallHealthScore": <integer 0-100, higher = healthier for the signing party>,
  "executiveSummary": "<3-4 sentences: what this contract is, key risks, recommendation>",
  "criticalCount": <integer>,
  "warningCount": <integer>,
  "clearCount": <integer>,
  "clauses": [
    {
      "id": <integer, 1-based>,
      "clauseTitle": "<short clause name, e.g. 'Limitation of Liability'>",
      "originalWording": "<exact quote up to 200 chars>",
      "persona": "<evaluating persona, e.g. 'PE Buyer Counsel' | 'Tenant Legal' | 'Institutional Investor'>",
      "riskLevel": "CRITICAL" | "WARNING" | "CLEAR",
      "riskRationale": "<1-2 sentences explaining the risk>",
      "marketBenchmark": "<citation: e.g. 'BVCA Model SPA 2023 §8.3 caps seller liability at 100% of consideration'>",
      "redlineRewrite": "<specific suggested rewrite of the problematic language>"
    }
  ]
}

RULES:
- Identify at minimum 8 clauses and at maximum 25 clauses.
- overallHealthScore: 0-40 = high risk, 41-70 = moderate, 71-100 = buyer-favourable.
- criticalCount + warningCount + clearCount must equal clauses.length.
- All string fields must be non-empty.
- No markdown, no explanation outside the JSON.
- If the document is not a legal contract, set contractType to "Other" and overallHealthScore to 0 with a single CRITICAL clause explaining the issue.`;

// ── LLM output validator ──────────────────────────────────────────────────────
interface AuditClause {
  id: number;
  clauseTitle: string;
  originalWording: string;
  persona: string;
  riskLevel: "CRITICAL" | "WARNING" | "CLEAR";
  riskRationale: string;
  marketBenchmark: string;
  redlineRewrite: string;
}

interface AuditResult {
  contractType: string;
  contractTitle: string;
  overallHealthScore: number;
  executiveSummary: string;
  criticalCount: number;
  warningCount: number;
  clearCount: number;
  clauses: AuditClause[];
}

function validateAuditResult(raw: string): AuditResult | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed.overallHealthScore !== "number" ||
      !Array.isArray(parsed.clauses) ||
      parsed.clauses.length < 1
    ) return null;
    // Validate each clause
    for (const c of parsed.clauses) {
      if (!c.clauseTitle || !c.riskLevel || !["CRITICAL", "WARNING", "CLEAR"].includes(c.riskLevel)) return null;
    }
    return parsed as AuditResult;
  } catch {
    return null;
  }
}

// ── Demo result (returned when demo=true or no Stripe key) ───────────────────
function buildDemoResult(filename: string): AuditResult {
  return {
    contractType: "SPA",
    contractTitle: filename || "Sample Share Purchase Agreement",
    overallHealthScore: 38,
    executiveSummary: "This Share Purchase Agreement contains several buyer-unfavourable provisions that require immediate attention before signing. The liability cap is set at 15% of consideration — well below the BVCA market standard of 100%. The MAC clause is drafted in seller-friendly terms and the non-compete period is unenforceable in most jurisdictions. We recommend not proceeding without material redlines on at least 4 clauses.",
    criticalCount: 3,
    warningCount: 4,
    clearCount: 3,
    clauses: [
      {
        id: 1,
        clauseTitle: "Limitation of Liability",
        originalWording: "The aggregate liability of the Seller shall not exceed fifteen percent (15%) of the Purchase Price in respect of all Warranty Claims.",
        persona: "PE Buyer Counsel",
        riskLevel: "CRITICAL",
        riskRationale: "A 15% liability cap means the buyer has virtually no recourse for material misrepresentations. BVCA standard is 100% of consideration for fundamental warranties.",
        marketBenchmark: "BVCA Model SPA 2023 §8.3: liability cap for fundamental warranties = 100% of consideration; general warranties = 25-50%.",
        redlineRewrite: "The aggregate liability of the Seller shall not exceed one hundred percent (100%) of the Purchase Price for Fundamental Warranty Claims and fifty percent (50%) for General Warranty Claims.",
      },
      {
        id: 2,
        clauseTitle: "Material Adverse Change",
        originalWording: "A Material Adverse Change shall mean any event, circumstance or condition that has or would reasonably be expected to have a material adverse effect on the business, operations, assets or financial condition of the Company.",
        persona: "PE Buyer Counsel",
        riskLevel: "CRITICAL",
        riskRationale: "The MAC definition is seller-drafted and lacks carve-outs for systemic market events, making it difficult for the buyer to invoke without triggering litigation.",
        marketBenchmark: "ABA 2023 SPA Study: 94% of deals include explicit MAC carve-outs for general economic conditions, industry-wide changes, and force majeure events.",
        redlineRewrite: "A Material Adverse Change shall mean any event that has a material adverse effect on the Company, excluding: (i) general economic or financial market conditions; (ii) industry-wide changes; (iii) acts of God or force majeure; (iv) changes in applicable law or GAAP.",
      },
      {
        id: 3,
        clauseTitle: "Non-Compete Period",
        originalWording: "The Seller undertakes not to engage in any competing business anywhere in the world for a period of ten (10) years from Completion.",
        persona: "Institutional Investor",
        riskLevel: "CRITICAL",
        riskRationale: "A 10-year worldwide non-compete is unenforceable in most common law jurisdictions (UK, UAE, Singapore) and will be struck down entirely, leaving the buyer with zero protection.",
        marketBenchmark: "English courts: non-competes exceeding 2 years in the same geographic market are routinely struck down (Tillman v Egon Zehnder [2019] UKSC 32).",
        redlineRewrite: "The Seller undertakes not to engage in any directly competing business in [specific jurisdictions] for a period of two (2) years from Completion, limited to the specific business activities of the Company as at Completion.",
      },
      {
        id: 4,
        clauseTitle: "Warranty Claim Notification Period",
        originalWording: "No Warranty Claim shall be made unless written notice is given to the Seller within twelve (12) months of Completion.",
        persona: "PE Buyer Counsel",
        riskLevel: "WARNING",
        riskRationale: "12 months is below the market standard of 18-24 months for general warranties and may prevent discovery of latent issues in the business.",
        marketBenchmark: "BVCA Model SPA 2023: general warranty claims — 18-24 months; tax warranty claims — 7 years.",
        redlineRewrite: "No Warranty Claim shall be made unless written notice is given to the Seller within twenty-four (24) months of Completion (or seven (7) years for Tax Warranty Claims).",
      },
      {
        id: 5,
        clauseTitle: "Indemnification Basket",
        originalWording: "The Seller shall not be liable for any Warranty Claim unless the aggregate amount of all such claims exceeds USD 500,000 (the 'Basket').",
        persona: "PE Buyer Counsel",
        riskLevel: "WARNING",
        riskRationale: "The basket is a tipping basket (not a deductible), which is buyer-favourable, but the threshold of USD 500,000 may be high relative to deal size.",
        marketBenchmark: "ABA 2023: median basket = 0.5-1.0% of deal value; tipping basket used in 72% of deals.",
        redlineRewrite: "The Seller shall not be liable for any Warranty Claim unless the aggregate amount exceeds 0.5% of the Purchase Price (the 'Basket'), at which point the Seller shall be liable for the full amount from the first dollar.",
      },
      {
        id: 6,
        clauseTitle: "Governing Law",
        originalWording: "This Agreement shall be governed by and construed in accordance with the laws of the Cayman Islands.",
        persona: "Institutional Investor",
        riskLevel: "WARNING",
        riskRationale: "Cayman Islands governing law is unusual for an operating company acquisition and may create enforcement difficulties in the target's home jurisdiction.",
        marketBenchmark: "For GCC/MENA acquisitions, English law or DIFC law is preferred by institutional buyers for enforceability and judicial precedent depth.",
        redlineRewrite: "This Agreement shall be governed by and construed in accordance with English law, and the parties submit to the exclusive jurisdiction of the English courts (or DIFC Courts if preferred).",
      },
      {
        id: 7,
        clauseTitle: "Conditions Precedent",
        originalWording: "Completion is conditional upon: (i) regulatory approval from the relevant competition authority; (ii) no Material Adverse Change having occurred.",
        persona: "PE Buyer Counsel",
        riskLevel: "WARNING",
        riskRationale: "The conditions precedent are standard but lack a long-stop date, creating indefinite completion risk for the buyer.",
        marketBenchmark: "Market standard: long-stop date of 6-12 months from signing with automatic termination rights if conditions not satisfied.",
        redlineRewrite: "Completion is conditional upon: (i) regulatory approval from the relevant competition authority; (ii) no Material Adverse Change having occurred; provided that if the Conditions Precedent are not satisfied by [DATE] (the 'Long-Stop Date'), either party may terminate this Agreement.",
      },
      {
        id: 8,
        clauseTitle: "Purchase Price Adjustment",
        originalWording: "The Purchase Price shall be adjusted on a pound-for-pound basis for any difference between the Estimated Net Working Capital and the Actual Net Working Capital as at Completion.",
        persona: "PE Buyer Counsel",
        riskLevel: "CLEAR",
        riskRationale: "Standard locked-box or completion accounts mechanism. Pound-for-pound NWC adjustment is market-standard and buyer-neutral.",
        marketBenchmark: "BVCA Model SPA 2023: NWC adjustment on completion accounts basis is standard for PE transactions.",
        redlineRewrite: "No redline required — clause is market-standard.",
      },
      {
        id: 9,
        clauseTitle: "Representations and Warranties",
        originalWording: "The Seller represents and warrants that the Disclosure Letter contains all material information relating to the Company known to the Seller as at the date of this Agreement.",
        persona: "PE Buyer Counsel",
        riskLevel: "CLEAR",
        riskRationale: "Standard warranty disclosure mechanism. The Disclosure Letter is the appropriate vehicle for qualifying warranties.",
        marketBenchmark: "BVCA Model SPA 2023: Disclosure Letter as the sole mechanism for qualifying warranties is market-standard.",
        redlineRewrite: "No redline required — clause is market-standard.",
      },
      {
        id: 10,
        clauseTitle: "Confidentiality",
        originalWording: "Each party shall keep confidential all information relating to the other party and the Transaction and shall not disclose such information to any third party without prior written consent.",
        persona: "Institutional Investor",
        riskLevel: "CLEAR",
        riskRationale: "Standard mutual confidentiality obligation with appropriate carve-outs for regulatory disclosure.",
        marketBenchmark: "Market-standard mutual NDA provisions consistent with LSTA/LMA confidentiality frameworks.",
        redlineRewrite: "No redline required — clause is market-standard.",
      },
    ],
  };
}

// ── In-memory audit store (persisted to DB when available) ───────────────────
const auditStore = new Map<string, AuditResult & { filename: string; createdAt: number }>();

function generateAuditId(): string {
  return `rl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Router ────────────────────────────────────────────────────────────────────
const legalRedlineRouter = Router();

// POST /api/audit-contract — main audit endpoint
legalRedlineRouter.post(
  "/audit-contract",
  upload.single("pdf"),
  async (req: Request, res: Response) => {
    try {
      const isDemo = req.query.demo === "true" || !req.file;

      if (isDemo) {
        const demoResult = buildDemoResult("Demo_SPA.pdf");
        const auditId = generateAuditId();
        auditStore.set(auditId, { ...demoResult, filename: "Demo_SPA.pdf", createdAt: Date.now() });
        res.json({ success: true, auditId, demo: true, result: demoResult });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No PDF file provided" });
        return;
      }

      // Extract text from PDF
      let contractText = "";
      let pageCount = 0;
      try {
        const parser = new PDFParse({ data: req.file.buffer });
        const data = await parser.getText();
        pageCount = data.total;
        contractText = data.text
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, MAX_CONTRACT_CHARS);
      } catch (err) {
        res.status(400).json({ error: `PDF extraction failed: ${err instanceof Error ? err.message : "unknown error"}` });
        return;
      }

      if (!contractText || contractText.length < 100) {
        res.status(400).json({ error: "Could not extract readable text from the PDF. Please ensure the file is not scanned/image-only." });
        return;
      }

      // Run LLM audit
      const userMessage = `Please audit the following contract text:\n\nFilename: ${req.file.originalname}\nPages: ${pageCount}\n\n---CONTRACT TEXT---\n${contractText}`;

      let auditResult: AuditResult | null = null;
      let lastError = "";

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: LEGALREDLINE_SYSTEM_PROMPT },
              { role: "user", content: userMessage },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "legal_audit_output",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    contractType: { type: "string" },
                    contractTitle: { type: "string" },
                    overallHealthScore: { type: "number" },
                    executiveSummary: { type: "string" },
                    criticalCount: { type: "number" },
                    warningCount: { type: "number" },
                    clearCount: { type: "number" },
                    clauses: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "number" },
                          clauseTitle: { type: "string" },
                          originalWording: { type: "string" },
                          persona: { type: "string" },
                          riskLevel: { type: "string" },
                          riskRationale: { type: "string" },
                          marketBenchmark: { type: "string" },
                          redlineRewrite: { type: "string" },
                        },
                        required: ["id", "clauseTitle", "originalWording", "persona", "riskLevel", "riskRationale", "marketBenchmark", "redlineRewrite"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["contractType", "contractTitle", "overallHealthScore", "executiveSummary", "criticalCount", "warningCount", "clearCount", "clauses"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response?.choices?.[0]?.message?.content;
          if (typeof content === "string") {
            const validated = validateAuditResult(content);
            if (validated) {
              auditResult = validated;
              break;
            } else {
              lastError = "Structured output validation failed";
            }
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : "LLM call failed";
        }
      }

      if (!auditResult) {
        res.status(500).json({ error: `Audit engine failed after 3 attempts: ${lastError}` });
        return;
      }

      // Persist to store and DB
      const auditId = generateAuditId();
      const filename = req.file.originalname;
      auditStore.set(auditId, { ...auditResult, filename, createdAt: Date.now() });

      // Try to persist to DB
      try {
        const db = await getDb();
        if (db) {
          await db.insert(legalAudits).values({
            auditId,
            filename,
            contractType: auditResult.contractType,
            contractTitle: auditResult.contractTitle,
            overallHealthScore: auditResult.overallHealthScore,
            criticalCount: auditResult.criticalCount,
            warningCount: auditResult.warningCount,
            clearCount: auditResult.clearCount,
            resultJson: JSON.stringify(auditResult),
            createdAt: Date.now(),
          });
        }
      } catch { /* non-fatal — in-memory store is the fallback */ }

      res.json({ success: true, auditId, demo: false, result: auditResult });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  }
);

// POST /api/redline/checkout — Stripe $1,200 checkout
legalRedlineRouter.post("/redline/checkout", async (req: Request, res: Response) => {
  try {
    const { auditId, origin, email } = req.body as { auditId?: string; origin?: string; email?: string };
    const stripe = getStripe();

    if (!stripe) {
      // Dev stub
      res.json({ url: `${origin ?? ""}/redline?paid=1&auditId=${auditId ?? ""}`, stub: true });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: AUDIT_PRICE_CENTS,
            product_data: {
              name: "LegalRedline Mesh — Full Contract Audit",
              description: "Complete clause-by-clause M&A contract audit with redlines, PDF proof report, and JSON audit trail",
            },
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: `${origin ?? ""}?paid=1&auditId=${auditId ?? ""}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin ?? ""}?canceled=1`,
      metadata: {
        type: "legal_redline_audit",
        auditId: auditId ?? "",
      },
    });

    res.json({ url: session.url, stub: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    res.status(500).json({ error: message });
  }
});

// GET /api/redline/export-json/:auditId — download clean JSON audit trail
legalRedlineRouter.get("/redline/export-json/:auditId", async (req: Request, res: Response) => {
  const { auditId } = req.params;
  const stored = auditStore.get(auditId);

  if (!stored) {
    // Try DB
    try {
      const db = await getDb();
      if (db) {
        const rows = await db.select().from(legalAudits).where(eq(legalAudits.auditId, auditId)).limit(1);
        if (rows[0]) {
          const result = JSON.parse(rows[0].resultJson);
          const json = JSON.stringify({ auditId, filename: rows[0].filename, generatedAt: new Date().toISOString(), ...result }, null, 2);
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Content-Disposition", `attachment; filename="LegalRedline-Audit-${auditId}.json"`);
          res.send(json);
          return;
        }
      }
    } catch { /* fall through */ }
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const json = JSON.stringify({
    auditId,
    filename: stored.filename,
    generatedAt: new Date().toISOString(),
    contractType: stored.contractType,
    contractTitle: stored.contractTitle,
    overallHealthScore: stored.overallHealthScore,
    executiveSummary: stored.executiveSummary,
    criticalCount: stored.criticalCount,
    warningCount: stored.warningCount,
    clearCount: stored.clearCount,
    clauses: stored.clauses,
  }, null, 2);

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="LegalRedline-Audit-${auditId}.json"`);
  res.send(json);
});

// GET /api/redline/export-pdf/:auditId — stream PDFKit proof report
legalRedlineRouter.get("/redline/export-pdf/:auditId", async (req: Request, res: Response) => {
  const { auditId } = req.params;
  let stored = auditStore.get(auditId);

  if (!stored) {
    try {
      const db = await getDb();
      if (db) {
        const rows = await db.select().from(legalAudits).where(eq(legalAudits.auditId, auditId)).limit(1);
        if (rows[0]) {
          const result = JSON.parse(rows[0].resultJson) as AuditResult;
          stored = { ...result, filename: rows[0].filename, createdAt: rows[0].createdAt };
          auditStore.set(auditId, stored);
        }
      }
    } catch { /* fall through */ }
  }

  if (!stored) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  try {
    const { generateLegalRedlinePdf } = await import("./legalRedlinePdf.js");
    const pdfBuffer = await generateLegalRedlinePdf(auditId, stored);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="LegalRedline-ProofReport-${auditId}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    res.status(500).json({ error: message });
  }
});

export default legalRedlineRouter;
