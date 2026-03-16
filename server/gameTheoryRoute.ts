/**
 * gameTheoryRoute.ts
 * Game Theory Investment Decision Agent
 * Single-pass structured LLM call → JSON schema → 6-field institutional output
 * Verdict: BUY / SELL / HOLD + game theory read + first mover + equilibrium + signal + confidence
 */
import { Router, Request, Response } from "express";
import { invokeLLM } from "./_core/llm";

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

Return a JSON object with exactly these fields:
{
  "verdict": "BUY" | "SELL" | "HOLD",
  "verdictRationale": "2-3 sentences. The core investment logic in one paragraph. No bullet points.",
  "gameTheoryRead": "3-4 sentences. Who the key players are, what they are likely doing right now, and why. Name specific actor types (sovereign funds, family offices, international allocators, etc.).",
  "firstMoverAssessment": "2-3 sentences. Does acting before others help or hurt in this specific case? Name the mechanism — coordination trap, information cascade, liquidity premium, or first mover advantage.",
  "equilibrium": "2-3 sentences. The stable outcome if all rational actors follow their dominant strategy. What does the market look like in 30-90 days if everyone acts rationally?",
  "verdictChangingSignal": "1 sentence only. The single most important signal that would flip this verdict. Be specific — name the event, threshold, or data point.",
  "confidence": "High" | "Medium" | "Low",
  "confidenceRationale": "1 sentence. Why this confidence level — what is the key source of uncertainty or conviction?"
}`;

// ─── Route: POST /api/agents/game-theory ─────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
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

    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `INVESTMENT SITUATION:\n\n${situation.trim()}` },
      ],
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

    res.json({ success: true, ...parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Game theory analysis failed";
    console.error("[GameTheoryAgent]", err);
    res.status(500).json({ error: message });
  }
});

export { router as gameTheoryRouter };
