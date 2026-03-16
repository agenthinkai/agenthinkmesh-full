/**
 * forceMajeureRoute.ts
 * Force Majeure Contract Agent — 4-layer LLM pipeline
 * Accepts PDF or DOCX upload, extracts FM clause, assesses GCC conflict triggers,
 * drafts notification letter, and produces a risk summary.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { invokeLLM } from "./_core/llm";
import { llmRateLimitMiddleware, recordLlmUsage } from "./llmRateLimit";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

// ─── Text extraction helpers ──────────────────────────────────────────────────
async function extractTextFromBuffer(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === "application/pdf" || mimetype === "application/x-pdf") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text || "";
  } else if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }
  throw new Error("Unsupported file format. Please upload a PDF or DOCX file.");
}

// ─── LLM helper ──────────────────────────────────────────────────────────────
async function llm(system: string, user: string, json = false, maxTokens = 4000): Promise<string> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: maxTokens,
    ...(json ? { response_format: { type: "json_object" } } : {}),
  });
  const content = response.choices[0].message.content;
  return typeof content === "string" ? content : JSON.stringify(content);
}

// ─── Route: POST /api/agents/force-majeure ────────────────────────────────────
router.post("/", llmRateLimitMiddleware, upload.single("contract"), async (req: Request & { llmTokenCap?: number; llmUsageContext?: any }, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No contract file uploaded." });
      return;
    }

    const userContext: string = req.body.userContext || "";
    const contractText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);

    if (!contractText || contractText.trim().length < 100) {
      res.status(422).json({ error: "Could not extract readable text from the uploaded file. Ensure the PDF is text-based, not scanned." });
      return;
    }

    // Detect language
    const isArabic = /[\u0600-\u06FF]/.test(contractText.slice(0, 500));
    const contractLang = isArabic ? "Arabic" : "English";

    // ── Layer 1: Extract Force Majeure Clause ─────────────────────────────────
    const extractionResult = await llm(
      `You are the Arabic Contract Intelligence Agent specialising in GCC commercial contracts.
Your task: Extract the force majeure clause verbatim from the contract text provided.
Rules:
- Return ONLY the exact verbatim text of the force majeure clause, including its heading.
- If the contract is in Arabic, return the Arabic text verbatim.
- If no force majeure clause exists, return exactly: "NO_FORCE_MAJEURE_CLAUSE_FOUND"
- Do not summarise, translate, or paraphrase. Verbatim only.`,
      `CONTRACT TEXT:\n\n${contractText.slice(0, 12000)}`
    );

    const clauseNotFound = extractionResult.trim() === "NO_FORCE_MAJEURE_CLAUSE_FOUND";
    const extractedClause = clauseNotFound
      ? "No force majeure clause was found in this contract."
      : extractionResult.trim();

    // ── Layer 2: Trigger Assessment ───────────────────────────────────────────
    const triggerRaw = await llm(
      `You are the Legal Reasoning Agent specialising in GCC contract law and force majeure doctrine.
Current GCC conflict conditions (as of 2025-2026):
- Active US-Iran military conflict with strikes on Iranian nuclear and military infrastructure
- Strait of Hormuz disruption: Iranian threats to close the strait, affecting 20% of global oil supply
- Attacks on GCC infrastructure: ports (Jebel Ali, Dammam), airports (Dubai, Riyadh), and energy facilities (Saudi Aramco, ADNOC)
- UAE and Saudi Arabia on elevated security alert; some commercial operations suspended or delayed

Your task: Assess whether these conditions constitute a legal trigger under the exact language of the force majeure clause provided. Write at institutional legal depth — this assessment will be reviewed by GCC-qualified legal counsel and presented to an investment committee.
Return a JSON object with these exact fields:
{
  "verdict": "YES" | "PARTIAL" | "NO",
  "confidence": 0-100,
  "reasoning": "6-8 sentences of precise legal reasoning. Reference specific clause language verbatim. Cite the exact conflict events that map to clause triggers. Identify any definitional gaps between the clause language and the events. State the legal standard being applied (UNIDROIT, CISG, or applicable GCC civil code).",
  "triggeringEvents": ["comprehensive list of specific conflict events that qualify under the clause, with brief explanation for each"],
  "gaps": ["detailed list of reasons the clause may not fully cover these events — include specific legal arguments the counterparty could raise"],
  "clauseStrength": "STRONG" | "MODERATE" | "WEAK"
}`,
      `FORCE MAJEURE CLAUSE:
${extractedClause}

USER CONTEXT:
${userContext}

CONTRACT LANGUAGE: ${contractLang}`,
      true,
      2000
    );

    let triggerData: {
      verdict: string;
      confidence: number;
      reasoning: string;
      triggeringEvents: string[];
      gaps: string[];
      clauseStrength: string;
    };
    try {
      triggerData = JSON.parse(triggerRaw);
    } catch {
      triggerData = {
        verdict: "PARTIAL",
        confidence: 60,
        reasoning: triggerRaw.slice(0, 500),
        triggeringEvents: ["Hormuz disruption", "GCC infrastructure attacks"],
        gaps: ["Clause language requires further legal review"],
        clauseStrength: "MODERATE",
      };
    }

    // ── Layer 3: Draft Notification Letter ────────────────────────────────────
    const notificationLetter = await llm(
      `You are the Document Drafting Agent specialising in GCC institutional legal correspondence.
Draft a formal force majeure notification letter based on the contract clause and trigger assessment provided.
Requirements:
- Write in ${contractLang} (match the contract language exactly)
- Formal, institutional tone — board-ready, no consumer language
- Include: date placeholder [DATE], sender details from user context, counterparty reference, specific force majeure events being invoked, reference to the exact clause, obligations suspended, and next steps
- Structure: Header → Opening → Force Majeure Declaration → Specific Events → Obligations Affected → Next Steps → Closing
- Do NOT add any commentary outside the letter itself`,
      `FORCE MAJEURE CLAUSE:\n${extractedClause}\n\nTRIGGER VERDICT: ${triggerData.verdict}\nTRIGGERING EVENTS: ${(triggerData.triggeringEvents || []).join(", ")}\n\nUSER CONTEXT:\n${userContext}`
    );

    // ── Layer 4: Risk Summary ─────────────────────────────────────────────────
    const riskSummaryRaw = await llm(
      `You are the Risk Summary Agent for GCC institutional clients.
Produce a concise one-page risk summary in English (regardless of contract language) covering exactly these four sections:
1. CLAUSE STRENGTH — assessment of how robust the force majeure clause is
2. TRIGGER CONFIDENCE — likelihood the current GCC conflict conditions qualify as a trigger
3. COUNTERPARTY EXPOSURE — what the counterparty can reasonably dispute or claim
4. RECOMMENDED NEXT ACTION — single most important action the client should take immediately

Return a JSON object with these exact fields:
{
  "clauseStrength": { "rating": "STRONG|MODERATE|WEAK", "summary": "2-3 sentences" },
  "triggerConfidence": { "percentage": 0-100, "summary": "2-3 sentences" },
  "counterpartyExposure": { "level": "HIGH|MEDIUM|LOW", "summary": "2-3 sentences" },
  "recommendedNextAction": { "action": "single action title", "detail": "2-3 sentences explaining the action" }
}`,
      `CLAUSE: ${extractedClause.slice(0, 2000)}\nVERDICT: ${triggerData.verdict}\nCONFIDENCE: ${triggerData.confidence}%\nREASONING: ${triggerData.reasoning}\nGAPS: ${(triggerData.gaps || []).join("; ")}\nUSER CONTEXT: ${userContext}`,
      true
    );

    let riskSummary: {
      clauseStrength: { rating: string; summary: string };
      triggerConfidence: { percentage: number; summary: string };
      counterpartyExposure: { level: string; summary: string };
      recommendedNextAction: { action: string; detail: string };
    };
    try {
      riskSummary = JSON.parse(riskSummaryRaw);
    } catch {
      riskSummary = {
        clauseStrength: { rating: triggerData.clauseStrength || "MODERATE", summary: "Clause requires detailed legal review." },
        triggerConfidence: { percentage: triggerData.confidence, summary: triggerData.reasoning.slice(0, 200) },
        counterpartyExposure: { level: "MEDIUM", summary: "Counterparty may dispute the scope of triggering events." },
        recommendedNextAction: { action: "Engage Legal Counsel", detail: "Retain a GCC-qualified legal team to review the clause and validate the trigger assessment before sending the notification letter." },
      };
    }

    // Record usage (4 LLM calls, estimate ~500 tokens each = 2000 total)
    if (req.llmUsageContext) await recordLlmUsage(req.llmUsageContext, 2000);

    res.json({
      success: true,
      contractLanguage: contractLang,
      extractedClause,
      clauseNotFound,
      triggerAssessment: triggerData,
      notificationLetter,
      riskSummary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Force majeure analysis failed";
    console.error("[ForceMajeureAgent]", err);
    res.status(500).json({ error: message });
  }
});

export { router as forceMajeureRouter };
