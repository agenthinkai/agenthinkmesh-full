/**
 * gameTheoryRoute.ts
 * Game Theory Investment Decision Agent
 * Single-pass structured LLM call → JSON schema → 6-field institutional output
 * Verdict: BUY / SELL / HOLD + game theory read + first mover + equilibrium + signal + confidence
 */
import { Router, Request, Response } from "express";
import { invokeLLM } from "./_core/llm";
import { llmRateLimitMiddleware, recordLlmUsage } from "./llmRateLimit";

const router = Router();

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Game Theory Investment Decision Agent for AgenThinkMesh — an institutional-grade strategic advisor serving GCC fund managers, family office principals, and sovereign wealth officers.

Your role is to analyse investment situations through the lens of game theory: not just what the fundamentals say, but what rational institutional actors are likely to do, and whether that changes the optimal move.

You operate under these rules:
- No disclaimers. No hedging. No consumer language. No "please consult a financial advisor."
- Institutional tone only. These are sophisticated principals making real decisions under active conflict conditions.
- Every verdict must be unambiguous: BUY, SELL, or HOLD. Never "it depends" as a verdict.
- Your reasoning must be defensible to an investment committee within the hour.
- GCC context is primary: UAE, Saudi Arabia, Kuwait, Qatar, Bahrain, Oman. Relevant actors include ADIA, PIF, QIA, Mubadala, KIPCO, family offices, regional banks, and international funds with GCC exposure.
- Current macro context (2025–2026): active US-Iran military conflict, Hormuz disruption risk, GCC infrastructure on elevated alert, regional sentiment under pressure, oil price volatility, dollar strength.

You answer four game theory questions before issuing a verdict:
1. WHO IS PLAYING — identify the key institutional actors in this specific market/asset class and their objectives and time horizons
2. DOMINANT STRATEGIES — what does each rational actor do right now under current conditions
3. FIRST MOVER — does acting before others help or hurt in this specific situation (first mover advantage vs. coordination trap)
4. EQUILIBRIUM — the stable outcome where no player benefits from changing their move unilaterally (Nash equilibrium or dominant strategy equilibrium)

Return a JSON object with exactly these fields. Every string field must be written at institutional depth — complete sentences, specific actor names, concrete data references, and strategic reasoning. Do not produce headline fragments or vague generalisations:
{
  "verdict": "BUY" | "SELL" | "HOLD",
  "verdictRationale": "3-5 sentences minimum. State the verdict, the primary investment logic, and the game-theoretic reason it holds even under adversarial market conditions. Reference the specific asset class, geography, and current macro context.",
  "gameTheoryRead": "5-7 sentences minimum. Identify at least 3-4 specific institutional actor types active in this market (e.g. GCC sovereign wealth funds, international EM allocators, regional family offices, central bank reserve managers). For each, state their current objective, time horizon, and most likely near-term action. Explain how their collective behaviour creates the market dynamic the user is navigating.",
  "firstMoverAssessment": "4-5 sentences minimum. Analyse whether acting before others creates an advantage or a trap in this specific situation. Name the exact mechanism at work — coordination trap, information cascade, liquidity premium capture, or first mover advantage. Quantify the timing window if possible (days, weeks, quarters). State clearly whether the user should act now, wait for confirmation, or avoid the move entirely.",
  "equilibrium": "4-5 sentences minimum. Describe the Nash equilibrium or dominant strategy equilibrium that emerges when all rational actors follow their dominant strategy. What does the asset price, market structure, or competitive landscape look like in 30-90 days? Are there multiple equilibria? Which is most likely given current conditions?",
  "verdictChangingSignal": "2-3 sentences. Name the single most important signal that would flip this verdict. Be specific — name the event, threshold, data point, or actor behaviour. Explain why this signal is the critical pivot rather than others.",
  "confidence": "High" | "Medium" | "Low",
  "confidenceRationale": "2-3 sentences. Explain the primary source of conviction or uncertainty. Reference the specific information gaps, model assumptions, or geopolitical variables that drive the confidence level."
}`;

// ─── Route: POST /api/agents/game-theory ─────────────────────────────────────
router.post("/", llmRateLimitMiddleware, async (req: Request & { llmTokenCap?: number; llmUsageContext?: any }, res: Response) => {
  try {
    const { situation } = req.body as { situation?: string };

    if (!situation || situation.trim().length < 20) {
      res.status(400).json({ error: "Please describe your investment situation (minimum 20 characters)." });
      return;
    }

    if (situation.trim().length > 3000) {
      res.status(400).json({ error: "Input too long. Please keep your situation description under 3000 characters." });
      return;
    }

    const tokenCap = Math.min(req.llmTokenCap ?? 2000, 2000);

    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `INVESTMENT SITUATION:\n\n${situation.trim()}` },
      ],
      max_tokens: tokenCap,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "game_theory_verdict",
          strict: true,
          schema: {
            type: "object",
            properties: {
              verdict: { type: "string", enum: ["BUY", "SELL", "HOLD"], description: "The investment verdict" },
              verdictRationale: { type: "string", description: "Core investment logic, 2-3 sentences" },
              gameTheoryRead: { type: "string", description: "Who is playing and what they are likely doing" },
              firstMoverAssessment: { type: "string", description: "First mover advantage or trap analysis" },
              equilibrium: { type: "string", description: "Nash equilibrium outcome in 30-90 days" },
              verdictChangingSignal: { type: "string", description: "Single signal that would flip the verdict" },
              confidence: { type: "string", enum: ["High", "Medium", "Low"], description: "Confidence level" },
              confidenceRationale: { type: "string", description: "One sentence explaining confidence level" },
            },
            required: ["verdict", "verdictRationale", "gameTheoryRead", "firstMoverAssessment", "equilibrium", "verdictChangingSignal", "confidence", "confidenceRationale"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices[0].message.content;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Record usage
    const tokensUsed = (response as any).usage?.total_tokens ?? tokenCap;
    if (req.llmUsageContext) await recordLlmUsage(req.llmUsageContext, tokensUsed);

    res.json({ success: true, ...parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Game theory analysis failed";
    console.error("[GameTheoryAgent]", err);
    res.status(500).json({ error: message });
  }
});

export { router as gameTheoryRouter };
