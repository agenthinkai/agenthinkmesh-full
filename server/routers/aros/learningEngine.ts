/**
 * aros/learningEngine.ts — Phase 9: Post-Interaction LLM Analysis
 *
 * After every executive response, Atlas answers six learning questions:
 *  1. What made the subject line effective or ineffective?
 *  2. Was the Hidden Variable accurate?
 *  3. Was the decision framing correct?
 *  4. What executive response pattern emerged?
 *  5. What industry response pattern emerged?
 *  6. What should change in the next Constitution version?
 */

import { invokeLLM } from "../../_core/llm";
import { getDb } from "../../db";
import {
  atlasLearningEvents,
  atlasOrgIntelligence,
  arosCompanies,
} from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface LearningInput {
  companyId?: number | null;
  companyName: string;
  executiveName: string;
  sector?: string | null;
  triggerType: "REPLY" | "MEETING" | "PROPOSAL" | "CUSTOMER" | "NO_RESPONSE_30D";
  subjectLine?: string | null;
  noteBody?: string | null;
  hiddenVariable?: string | null;
  decisionDetected?: string | null;
  executiveResponse?: string | null;
  constitutionVersion?: string | null;
  outreachQueueId?: number | null;
}

export interface LearningAnalysis {
  subjectLineEffectiveness: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  hiddenVariableEffectiveness: "CONFIRMED" | "PARTIAL" | "INCORRECT" | "UNKNOWN";
  decisionFramingEffectiveness: "ACCURATE" | "PARTIAL" | "MISSED" | "UNKNOWN";
  executiveResponsePattern: string;
  industryResponsePattern: string;
  constitutionEffectiveness: "STRONG" | "ADEQUATE" | "WEAK" | "UNKNOWN";
  whatWorked: string;
  whatFailed: string;
  recommendedImprovements: string;
}

export async function runLearningAnalysis(input: LearningInput): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = Date.now();

  const context = [
    `Company: ${input.companyName}`,
    `Executive: ${input.executiveName}`,
    `Sector: ${input.sector ?? "Unknown"}`,
    `Trigger: ${input.triggerType}`,
    input.subjectLine ? `Subject Line Used: ${input.subjectLine}` : null,
    input.hiddenVariable ? `Hidden Variable Claimed: ${input.hiddenVariable}` : null,
    input.decisionDetected ? `Decision Detected: ${input.decisionDetected}` : null,
    input.noteBody ? `Brief Body (first 500 chars): ${input.noteBody.slice(0, 500)}` : null,
    input.executiveResponse ? `Executive Response: ${input.executiveResponse}` : null,
    input.constitutionVersion ? `Constitution Version: ${input.constitutionVersion}` : null,
  ].filter(Boolean).join("\n");

  let analysis: LearningAnalysis = {
    subjectLineEffectiveness: "UNKNOWN",
    hiddenVariableEffectiveness: "UNKNOWN",
    decisionFramingEffectiveness: "UNKNOWN",
    executiveResponsePattern: "No pattern identified",
    industryResponsePattern: "No pattern identified",
    constitutionEffectiveness: "UNKNOWN",
    whatWorked: "Analysis not available",
    whatFailed: "Analysis not available",
    recommendedImprovements: "Analysis not available",
  };

  let rawLlmAnalysis = "";

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are the Atlas Learning Engine. You analyse executive interactions to improve future intelligence briefs.

After every executive interaction, answer six questions honestly:
1. What made the subject line effective or ineffective?
2. Was the Hidden Variable accurate?
3. Was the decision framing correct?
4. What executive response pattern emerged?
5. What industry response pattern emerged?
6. What should change in the next Constitution version?

Respond ONLY with valid JSON. Be specific and evidence-based. Never invent patterns not supported by evidence.`,
        },
        {
          role: "user",
          content: String(`Analyse this interaction:\n\n${context}`),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "learning_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              subjectLineEffectiveness: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
              hiddenVariableEffectiveness: { type: "string", enum: ["CONFIRMED", "PARTIAL", "INCORRECT", "UNKNOWN"] },
              decisionFramingEffectiveness: { type: "string", enum: ["ACCURATE", "PARTIAL", "MISSED", "UNKNOWN"] },
              executiveResponsePattern: { type: "string" },
              industryResponsePattern: { type: "string" },
              constitutionEffectiveness: { type: "string", enum: ["STRONG", "ADEQUATE", "WEAK", "UNKNOWN"] },
              whatWorked: { type: "string" },
              whatFailed: { type: "string" },
              recommendedImprovements: { type: "string" },
            },
            required: [
              "subjectLineEffectiveness", "hiddenVariableEffectiveness",
              "decisionFramingEffectiveness", "executiveResponsePattern",
              "industryResponsePattern", "constitutionEffectiveness",
              "whatWorked", "whatFailed", "recommendedImprovements",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const msgContent = response.choices?.[0]?.message?.content;
    rawLlmAnalysis = typeof msgContent === "string" ? msgContent : JSON.stringify(msgContent ?? "");
    analysis = JSON.parse(rawLlmAnalysis) as LearningAnalysis;
  } catch (err) {
    rawLlmAnalysis = `LLM analysis failed: ${String(err)}`;
  }

  await db.insert(atlasLearningEvents).values({
    eventDate: now,
    triggerType: input.triggerType,
    companyId: input.companyId ?? null,
    companyName: input.companyName,
    executiveName: input.executiveName,
    sector: input.sector ?? null,
    subjectLineEffectiveness: analysis.subjectLineEffectiveness,
    hiddenVariableEffectiveness: analysis.hiddenVariableEffectiveness,
    decisionFramingEffectiveness: analysis.decisionFramingEffectiveness,
    executiveResponsePattern: analysis.executiveResponsePattern,
    industryResponsePattern: analysis.industryResponsePattern,
    constitutionEffectiveness: analysis.constitutionEffectiveness,
    whatWorked: analysis.whatWorked,
    whatFailed: analysis.whatFailed,
    recommendedImprovements: analysis.recommendedImprovements,
    rawLlmAnalysis,
    constitutionVersion: input.constitutionVersion ?? null,
    createdAt: now,
  });

  if (input.companyId) {
    const [existing] = await db
      .select()
      .from(atlasOrgIntelligence)
      .where(eq(atlasOrgIntelligence.companyId, input.companyId))
      .limit(1);

    const newObservation = `[${new Date(now).toISOString()}] ${input.triggerType}: ${analysis.whatWorked}`;

    if (existing) {
      const prevObs = existing.previousAtlasObservations ?? "";
      await db
        .update(atlasOrgIntelligence)
        .set({
          previousAtlasObservations: `${prevObs}\n${newObservation}`.slice(-5000),
          lastUpdated: now,
        })
        .where(eq(atlasOrgIntelligence.companyId, input.companyId));
    } else {
      const [company] = await db
        .select({ companyName: arosCompanies.companyName })
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);

      await db.insert(atlasOrgIntelligence).values({
        companyId: input.companyId,
        companyName: company?.companyName ?? input.companyName,
        previousAtlasObservations: newObservation,
        lastUpdated: now,
        createdAt: now,
      });
    }
  }
}
