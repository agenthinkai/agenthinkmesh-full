/**
 * agentRoutes.ts
 * Embedded specialist agent endpoints — mounted directly on the main Express server.
 * All 10 agents (5 business intelligence + 5 Arabic NLP) live at /api/agents/*
 * This makes them permanently available at the same URL as the platform itself.
 */

import { Router, Request, Response } from "express";
import { invokeLLM } from "./_core/llm";

const router = Router();

// ─── Shared helper ────────────────────────────────────────────────────────────

interface AgentRequest {
  task?: string;
  context?: string;
}

async function runAgent(
  systemPrompt: string,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { task, context } = req.body as AgentRequest;

    if (!task) {
      res.status(400).json({ error: "task field is required" });
      return;
    }

    const userMessage = context
      ? `Context: ${context}\n\nTask: ${task}`
      : `Task: ${task}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const result =
      typeof response.choices[0].message.content === "string"
        ? response.choices[0].message.content
        : JSON.stringify(response.choices[0].message.content);

    res.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent execution failed";
    res.status(500).json({ error: message });
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    agents: [
      "market-research",
      "financial-analysis",
      "strategy",
      "legal-review",
      "report-writer",
      "arabic/sentiment",
      "arabic/ner",
      "arabic/intent",
      "arabic/legal",
      "arabic/codeswitch",
    ],
    timestamp: new Date().toISOString(),
  });
});

// ─── Business Intelligence Agents ─────────────────────────────────────────────

router.post("/market-research/run", (req, res) =>
  runAgent(
    `You are a senior market research analyst specialising in GCC and emerging markets.
Given a task and context, produce a structured market research report covering:
1. Market Overview — size, growth rate, key segments
2. Competitive Landscape — top 3-5 players, market share, positioning
3. Key Trends — technology, regulatory, consumer behaviour
4. Risks & Opportunities — prioritised by impact
5. Strategic Recommendations — 3 actionable insights

Be specific, data-driven, and concise. Use numbers where possible. Format with clear headings.`,
    req,
    res
  )
);

router.post("/financial-analysis/run", (req, res) =>
  runAgent(
    `You are a senior financial analyst at a top-tier investment bank.
Given a task and context, produce a structured financial analysis covering:
1. Financial Summary — key metrics, revenue, EBITDA, margins
2. Valuation — DCF, comparable multiples, implied range
3. Key Ratios — P/E, EV/EBITDA, debt/equity, ROE, ROA
4. Cash Flow Analysis — operating, investing, financing
5. Risk Factors — financial, operational, market
6. Investment Thesis — buy/hold/sell with rationale

Be rigorous, precise, and institutional in tone. Use tables for numerical data.`,
    req,
    res
  )
);

router.post("/strategy/run", (req, res) =>
  runAgent(
    `You are a senior strategy consultant with expertise in GCC markets and corporate strategy.
Given a task and context, produce a structured strategic analysis covering:
1. Situation Assessment — current position, capabilities, market context
2. Strategic Options — 3 distinct strategic paths with trade-offs
3. Recommended Strategy — clear recommendation with rationale
4. Implementation Roadmap — 90-day, 6-month, 12-month milestones
5. Success Metrics — KPIs to track progress
6. Risks & Mitigations — top 3 risks with mitigation plans

Be decisive, practical, and executive-ready. Avoid generic frameworks without specific application.`,
    req,
    res
  )
);

router.post("/legal-review/run", (req, res) =>
  runAgent(
    `You are a senior legal counsel specialising in GCC commercial law, contracts, and regulatory compliance.
Given a task and context, produce a structured legal analysis covering:
1. Document/Issue Summary — what is being reviewed and why
2. Key Legal Issues — ranked by materiality
3. Non-Standard or High-Risk Clauses — flagged with explanation
4. Regulatory Compliance — applicable laws, regulations, licensing requirements
5. Recommended Actions — specific changes or steps required
6. Risk Rating — overall legal risk level (Low / Medium / High) with justification

Be precise, risk-aware, and practical. Note jurisdiction-specific considerations for GCC markets.`,
    req,
    res
  )
);

router.post("/report-writer/run", (req, res) =>
  runAgent(
    `You are a senior analyst and professional writer specialising in institutional research reports.
Given a task and context, produce a polished, publication-ready report with:
1. Executive Summary — 3-5 sentences capturing the key message
2. Background & Context — setting the scene
3. Analysis — structured findings with evidence
4. Key Conclusions — numbered, specific takeaways
5. Recommendations — actionable next steps for the reader
6. Appendix Notes — data sources, methodology, caveats

Write in clear, professional English suitable for C-suite and institutional audiences. Use headings and numbered lists for scannability.`,
    req,
    res
  )
);

// ─── Arabic NLP Annotation Agents ─────────────────────────────────────────────

router.post("/arabic/sentiment", async (req, res) => {
  try {
    const { task, context } = req.body as AgentRequest;
    if (!task) { res.status(400).json({ error: "task field is required" }); return; }

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert Arabic NLP annotator specialising in Gulf dialect sentiment analysis.
Analyse the provided Arabic text and return a JSON object with exactly these fields:
{
  "label": "positive" | "negative" | "neutral" | "mixed",
  "confidence": number between 0 and 1,
  "dialect": "Gulf" | "MSA" | "Levantine" | "Egyptian" | "Mixed",
  "rationale": "brief explanation in English of why this label was assigned",
  "dialectFeatures": ["list of dialect-specific features detected"]
}
Return ONLY valid JSON. No markdown, no explanation outside the JSON.`,
        },
        {
          role: "user",
          content: `Context: ${context || "General annotation"}\n\nArabic text to annotate:\n${task}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = typeof response.choices[0].message.content === "string"
      ? response.choices[0].message.content
      : JSON.stringify(response.choices[0].message.content);

    const parsed = JSON.parse(raw);
    res.json({
      result: `Sentiment: ${parsed.label} (${Math.round((parsed.confidence || 0) * 100)}% confidence) — ${parsed.rationale}`,
      label: parsed.label,
      confidence: parsed.confidence,
      dialect: parsed.dialect,
      rationale: parsed.rationale,
      additionalFields: { dialectFeatures: parsed.dialectFeatures },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sentiment analysis failed";
    res.status(500).json({ error: message });
  }
});

router.post("/arabic/ner", async (req, res) => {
  try {
    const { task, context } = req.body as AgentRequest;
    if (!task) { res.status(400).json({ error: "task field is required" }); return; }

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert Arabic NLP annotator specialising in Named Entity Recognition (NER).
Analyse the provided Arabic text and return a JSON object with exactly these fields:
{
  "label": "entities_found" | "no_entities",
  "confidence": number between 0 and 1,
  "dialect": "Gulf" | "MSA" | "Levantine" | "Egyptian" | "Mixed",
  "rationale": "brief summary of entities found",
  "entities": [
    { "text": "entity text in Arabic", "type": "PERSON" | "ORG" | "LOCATION" | "DATE" | "MONEY" | "PRODUCT" | "EVENT", "transliteration": "optional English transliteration" }
  ]
}
Return ONLY valid JSON. No markdown, no explanation outside the JSON.`,
        },
        {
          role: "user",
          content: `Context: ${context || "General NER annotation"}\n\nArabic text to annotate:\n${task}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = typeof response.choices[0].message.content === "string"
      ? response.choices[0].message.content
      : JSON.stringify(response.choices[0].message.content);

    const parsed = JSON.parse(raw);
    const entityCount = (parsed.entities || []).length;
    res.json({
      result: `Found ${entityCount} entities: ${(parsed.entities || []).map((e: { type: string; text: string }) => `${e.type}(${e.text})`).join(", ")}`,
      label: parsed.label,
      confidence: parsed.confidence,
      dialect: parsed.dialect,
      rationale: parsed.rationale,
      additionalFields: { entities: parsed.entities },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "NER analysis failed";
    res.status(500).json({ error: message });
  }
});

router.post("/arabic/intent", async (req, res) => {
  try {
    const { task, context } = req.body as AgentRequest;
    if (!task) { res.status(400).json({ error: "task field is required" }); return; }

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert Arabic NLP annotator specialising in Islamic finance intent classification.
Analyse the provided Arabic text and return a JSON object with exactly these fields:
{
  "label": "inquiry" | "complaint" | "request" | "approval" | "rejection" | "information" | "transaction",
  "confidence": number between 0 and 1,
  "dialect": "Gulf" | "MSA" | "Levantine" | "Egyptian" | "Mixed",
  "rationale": "brief explanation of the detected intent",
  "intent": "specific intent label e.g. sukuk_inquiry, zakat_calculation, murabaha_request",
  "islamicFinanceTerms": ["list of Islamic finance terms detected in the text"]
}
Return ONLY valid JSON. No markdown, no explanation outside the JSON.`,
        },
        {
          role: "user",
          content: `Context: ${context || "Islamic finance customer interaction"}\n\nArabic text to annotate:\n${task}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = typeof response.choices[0].message.content === "string"
      ? response.choices[0].message.content
      : JSON.stringify(response.choices[0].message.content);

    const parsed = JSON.parse(raw);
    res.json({
      result: `Intent: ${parsed.intent || parsed.label} (${Math.round((parsed.confidence || 0) * 100)}% confidence) — ${parsed.rationale}`,
      label: parsed.label,
      confidence: parsed.confidence,
      dialect: parsed.dialect,
      rationale: parsed.rationale,
      additionalFields: { intent: parsed.intent, islamicFinanceTerms: parsed.islamicFinanceTerms },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Intent classification failed";
    res.status(500).json({ error: message });
  }
});

router.post("/arabic/legal", async (req, res) => {
  try {
    const { task, context } = req.body as AgentRequest;
    if (!task) { res.status(400).json({ error: "task field is required" }); return; }

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert Arabic legal document annotator specialising in GCC contract law.
Analyse the provided Arabic legal text and return a JSON object with exactly these fields:
{
  "label": "standard_clause" | "non_standard_clause" | "high_risk_clause" | "missing_clause",
  "confidence": number between 0 and 1,
  "dialect": "Gulf" | "MSA" | "Levantine" | "Egyptian" | "Mixed",
  "rationale": "brief explanation of the clause classification",
  "clauses": [
    { "text": "clause text", "type": "liability" | "termination" | "payment" | "dispute" | "confidentiality" | "force_majeure" | "other", "riskLevel": "low" | "medium" | "high", "note": "annotation note" }
  ]
}
Return ONLY valid JSON. No markdown, no explanation outside the JSON.`,
        },
        {
          role: "user",
          content: `Context: ${context || "GCC legal document review"}\n\nArabic legal text to annotate:\n${task}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = typeof response.choices[0].message.content === "string"
      ? response.choices[0].message.content
      : JSON.stringify(response.choices[0].message.content);

    const parsed = JSON.parse(raw);
    const clauseCount = (parsed.clauses || []).length;
    res.json({
      result: `Classification: ${parsed.label} — ${clauseCount} clause(s) identified. ${parsed.rationale}`,
      label: parsed.label,
      confidence: parsed.confidence,
      dialect: parsed.dialect,
      rationale: parsed.rationale,
      additionalFields: { clauses: parsed.clauses },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Legal clause extraction failed";
    res.status(500).json({ error: message });
  }
});

router.post("/arabic/codeswitch", async (req, res) => {
  try {
    const { task, context } = req.body as AgentRequest;
    if (!task) { res.status(400).json({ error: "task field is required" }); return; }

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert Arabic NLP annotator specialising in code-switching detection between Arabic and English.
Analyse the provided text and return a JSON object with exactly these fields:
{
  "label": "arabic_only" | "english_only" | "code_switched" | "arabizi",
  "confidence": number between 0 and 1,
  "dialect": "Gulf" | "MSA" | "Levantine" | "Egyptian" | "Mixed",
  "rationale": "brief explanation of the code-switching pattern detected",
  "switchPoints": [
    { "position": "approximate position description", "fromLang": "Arabic" | "English", "toLang": "Arabic" | "English", "trigger": "word or phrase that triggered the switch" }
  ],
  "arabicRatio": number between 0 and 1,
  "englishRatio": number between 0 and 1
}
Return ONLY valid JSON. No markdown, no explanation outside the JSON.`,
        },
        {
          role: "user",
          content: `Context: ${context || "Bilingual Arabic-English text analysis"}\n\nText to annotate:\n${task}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = typeof response.choices[0].message.content === "string"
      ? response.choices[0].message.content
      : JSON.stringify(response.choices[0].message.content);

    const parsed = JSON.parse(raw);
    res.json({
      result: `Pattern: ${parsed.label} — Arabic ${Math.round((parsed.arabicRatio || 0) * 100)}% / English ${Math.round((parsed.englishRatio || 0) * 100)}%. ${parsed.rationale}`,
      label: parsed.label,
      confidence: parsed.confidence,
      dialect: parsed.dialect,
      rationale: parsed.rationale,
      additionalFields: {
        switchPoints: parsed.switchPoints,
        arabicRatio: parsed.arabicRatio,
        englishRatio: parsed.englishRatio,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Code-switch detection failed";
    res.status(500).json({ error: message });
  }
});

export { router as agentRouter };
