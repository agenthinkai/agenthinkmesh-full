import { Router, Request, Response } from "express";
import crypto from "crypto";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── PII patterns (mirrors the CPU Node package) ────────────────────────────
const PII_PATTERNS: Record<string, RegExp> = {
  "Aadhaar (India)": /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  "PAN Card (India)": /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
  "NRIC (Singapore)": /\b[STFG]\d{7}[A-Z]\b/g,
  "NIK (Indonesia)": /\b\d{16}\b/g,
  "Email Address": /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  "Phone Number": /\b(\+?[1-9]\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  "Credit Card": /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
  "Passport Number": /\b[A-Z]{1,2}[0-9]{6,9}\b/g,
};

type PiiResult = { type: string; count: number; redacted: string };

function detectPII(text: string): PiiResult[] {
  const results: PiiResult[] = [];
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = text.match(new RegExp(pattern.source, "g"));
    if (matches && matches.length > 0) {
      results.push({ type, count: matches.length, redacted: `[${type.toUpperCase().replace(/ /g, "_")}_REDACTED]` });
    }
  }
  return results;
}

function redactPII(text: string): string {
  let redacted = text;
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    redacted = redacted.replace(new RegExp(pattern.source, "g"), `[${type.toUpperCase().replace(/ /g, "_")}_REDACTED]`);
  }
  return redacted;
}

function classifyData(text: string, piiFound: PiiResult[]): string {
  if (piiFound.length > 2) return "RESTRICTED";
  if (piiFound.length > 0) return "CONFIDENTIAL";
  const lower = text.toLowerCase();
  if (lower.includes("salary") || lower.includes("revenue") || lower.includes("profit") || lower.includes("acquisition")) return "CONFIDENTIAL";
  if (lower.includes("internal") || lower.includes("employee") || lower.includes("client")) return "INTERNAL";
  return "PUBLIC";
}

function categoriseTask(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("kyc") || lower.includes("know your customer") || lower.includes("identity")) return "KYC/AML";
  if (lower.includes("loan") || lower.includes("credit") || lower.includes("mortgage")) return "Loan Analysis";
  if (lower.includes("contract") || lower.includes("clause") || lower.includes("agreement") || lower.includes("spa") || lower.includes("sha")) return "Contract Review";
  if (lower.includes("fraud") || lower.includes("suspicious") || lower.includes("transaction")) return "Fraud Analysis";
  if (lower.includes("regulation") || lower.includes("compliance") || lower.includes("ojk") || lower.includes("rbi") || lower.includes("mas")) return "Regulatory Q&A";
  if (lower.includes("summarise") || lower.includes("summarize") || lower.includes("summary")) return "Document Summary";
  return "General Query";
}

type AuditRow = {
  id: number;
  session_id: string;
  request_hash: string;
  response_hash: string;
  chain_hash: string;
  model_used: string;
  backend_type: string;
  task_category: string;
  data_classification: string;
  pii_detected: string | null;
  pii_redacted: number;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  department: string | null;
  user_label: string | null;
  created_at: number;
};

type StatsRow = {
  total_requests: number;
  total_tokens: number;
  avg_latency_ms: number;
  pii_blocked: number;
  restricted_count: number;
  confidential_count: number;
  internal_count: number;
  public_count: number;
};

type CategoryRow = { task_category: string; count: number; avg_latency: number };
type ActivityRow = { created_at: number; task_category: string; data_classification: string; latency_ms: number; tokens: number };

// ─── POST /api/meshpilot/chat ────────────────────────────────────────────────
router.post("/chat", async (req: Request, res: Response) => {
  const { message, sessionId, department, userLabel } = req.body as {
    message: string;
    sessionId?: string;
    department?: string;
    userLabel?: string;
  };

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "message is required" });
  }

  const sid = sessionId || crypto.randomBytes(16).toString("hex");
  const startTime = Date.now();

  const piiFound = detectPII(message);
  const hasPII = piiFound.length > 0;
  const safeMessage = hasPII ? redactPII(message) : message;
  const dataClass = classifyData(message, piiFound);
  const taskCategory = categoriseTask(message);

  const systemPrompt = `You are MeshPilot, an enterprise AI inference engine deployed on-premise at a regulated financial institution. All data stays within the institution's infrastructure — zero cloud exposure.

Your role: provide accurate, professional responses for banking and financial use cases including KYC analysis, loan assessment, contract review, regulatory compliance, and document summarisation.

Guidelines:
- Be precise and professional
- Flag any regulatory considerations relevant to the query (OJK, RBI, MAS, DPDP Act, PDP Law)
- Note if the query involves sensitive data that should be handled under specific compliance frameworks
- Keep responses concise and actionable
- If analysing documents, structure your response with: **Summary** | **Key Findings** | **Risk Flags** | **Recommended Action**

You are running on-premise on AMD EPYC CPU infrastructure. Data sovereignty is guaranteed.`;

  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    const llmResponse = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: safeMessage },
      ],
    });

    const latencyMs = Date.now() - startTime;
    const responseText = (llmResponse.choices?.[0]?.message?.content as string) || "";
    const promptTokens = llmResponse.usage?.prompt_tokens || Math.ceil(safeMessage.length / 4);
    const completionTokens = llmResponse.usage?.completion_tokens || Math.ceil(responseText.length / 4);

    const requestHash = crypto.createHash("sha256").update(safeMessage + sid + startTime).digest("hex").slice(0, 16);
    const responseHash = crypto.createHash("sha256").update(responseText + requestHash).digest("hex").slice(0, 16);

    // Get previous chain hash for this session
    let prevChainHash = "0000000000000000";
    try {
      const [prevRow] = await db.execute(sql`
        SELECT chain_hash FROM meshpilot_demo_sessions
        WHERE session_id = ${sid}
        ORDER BY created_at DESC LIMIT 1
      `) as unknown as [AuditRow | undefined];
      if (prevRow?.chain_hash) prevChainHash = prevRow.chain_hash;
    } catch (_) { /* first entry */ }

    const chainHash = crypto.createHash("sha256").update(requestHash + responseHash + prevChainHash).digest("hex").slice(0, 16);
    const now = Date.now();

    await db.execute(sql`
      INSERT INTO meshpilot_demo_sessions
        (session_id, request_hash, response_hash, chain_hash, model_used, backend_type,
         task_category, data_classification, pii_detected, pii_redacted,
         prompt_tokens, completion_tokens, latency_ms, department, user_label, created_at)
      VALUES
        (${sid}, ${requestHash}, ${responseHash}, ${chainHash},
         ${"claude-sonnet-4-5 (cloud-demo)"}, ${"cloud-demo"},
         ${taskCategory}, ${dataClass}, ${JSON.stringify(piiFound)}, ${hasPII ? 1 : 0},
         ${promptTokens}, ${completionTokens}, ${latencyMs},
         ${department ?? null}, ${userLabel ?? null}, ${now})
    `);

    return res.json({
      sessionId: sid,
      response: responseText,
      auditEntry: {
        requestHash,
        responseHash,
        chainHash,
        taskCategory,
        dataClassification: dataClass,
        piiDetected: piiFound,
        piiRedacted: hasPII,
        promptTokens,
        completionTokens,
        latencyMs,
        modelUsed: "claude-sonnet-4-5 (cloud-demo)",
        backendType: "cloud-demo",
        timestamp: new Date(now).toISOString(),
      },
    });
  } catch (err) {
    console.error("[MeshPilot Demo] chat error:", err);
    return res.status(500).json({ error: "Inference failed" });
  }
});

// ─── GET /api/meshpilot/audit-log ────────────────────────────────────────────
router.get("/audit-log", async (req: Request, res: Response) => {
  const { sessionId, limit = "20" } = req.query as { sessionId?: string; limit?: string };
  const lim = Math.min(parseInt(limit, 10) || 20, 100);

  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    let rows: AuditRow[];
    if (sessionId) {
      [rows] = await db.execute(sql`
        SELECT * FROM meshpilot_demo_sessions
        WHERE session_id = ${sessionId}
        ORDER BY created_at DESC LIMIT ${lim}
      `) as unknown as [AuditRow[]];
    } else {
      [rows] = await db.execute(sql`
        SELECT * FROM meshpilot_demo_sessions
        ORDER BY created_at DESC LIMIT ${lim}
      `) as unknown as [AuditRow[]];
    }

    return res.json({ entries: rows || [] });
  } catch (err) {
    console.error("[MeshPilot Demo] audit-log error:", err);
    return res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// ─── GET /api/meshpilot/stats ─────────────────────────────────────────────────
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    const [statsRow] = await db.execute(sql`
      SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(prompt_tokens + completion_tokens), 0) as total_tokens,
        COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
        SUM(CASE WHEN pii_redacted = 1 THEN 1 ELSE 0 END) as pii_blocked,
        SUM(CASE WHEN data_classification = 'RESTRICTED' THEN 1 ELSE 0 END) as restricted_count,
        SUM(CASE WHEN data_classification = 'CONFIDENTIAL' THEN 1 ELSE 0 END) as confidential_count,
        SUM(CASE WHEN data_classification = 'INTERNAL' THEN 1 ELSE 0 END) as internal_count,
        SUM(CASE WHEN data_classification = 'PUBLIC' THEN 1 ELSE 0 END) as public_count
      FROM meshpilot_demo_sessions
    `) as unknown as [StatsRow];

    const [byCategory] = await db.execute(sql`
      SELECT task_category, COUNT(*) as count, AVG(latency_ms) as avg_latency
      FROM meshpilot_demo_sessions
      GROUP BY task_category
      ORDER BY count DESC
    `) as unknown as [CategoryRow[]];

    const [recentActivity] = await db.execute(sql`
      SELECT created_at, task_category, data_classification, latency_ms,
             prompt_tokens + completion_tokens as tokens
      FROM meshpilot_demo_sessions
      ORDER BY created_at DESC LIMIT 10
    `) as unknown as [ActivityRow[]];

    const s = statsRow ?? ({} as StatsRow);
    return res.json({
      totalRequests: Number(s.total_requests) || 0,
      totalTokens: Number(s.total_tokens) || 0,
      avgLatencyMs: Math.round(Number(s.avg_latency_ms) || 0),
      piiBlocked: Number(s.pii_blocked) || 0,
      dataClassification: {
        RESTRICTED: Number(s.restricted_count) || 0,
        CONFIDENTIAL: Number(s.confidential_count) || 0,
        INTERNAL: Number(s.internal_count) || 0,
        PUBLIC: Number(s.public_count) || 0,
      },
      byCategory: Array.isArray(byCategory) ? byCategory : [],
      recentActivity: Array.isArray(recentActivity) ? recentActivity : [],
    });
  } catch (err) {
    console.error("[MeshPilot Demo] stats error:", err);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ─── POST /api/meshpilot/pii-scan ─────────────────────────────────────────────
router.post("/pii-scan", (req: Request, res: Response) => {
  const { text } = req.body as { text: string };
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }
  const piiFound = detectPII(text);
  const redacted = redactPII(text);
  const dataClass = classifyData(text, piiFound);
  return res.json({
    piiDetected: piiFound,
    hasPII: piiFound.length > 0,
    redactedText: redacted,
    dataClassification: dataClass,
    scannedAt: new Date().toISOString(),
  });
});

// ─── GET /api/meshpilot/audit-log/export ─────────────────────────────────────
router.get("/audit-log/export", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    const [rows] = await db.execute(sql`
      SELECT * FROM meshpilot_demo_sessions ORDER BY created_at ASC LIMIT 500
    `) as unknown as [AuditRow[]];

    const entries = Array.isArray(rows) ? rows : [];
    const headers: (keyof AuditRow)[] = ["id","session_id","request_hash","response_hash","chain_hash","model_used","backend_type","task_category","data_classification","pii_redacted","prompt_tokens","completion_tokens","latency_ms","department","created_at"];
    const csvRows = [headers.join(",")];
    for (const row of entries) {
      csvRows.push(headers.map(h => JSON.stringify(row[h] ?? "")).join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=meshpilot_audit_log.csv");
    return res.send(csvRows.join("\n"));
  } catch (err) {
    console.error("[MeshPilot Demo] export error:", err);
    return res.status(500).json({ error: "Export failed" });
  }
});

export default router;
