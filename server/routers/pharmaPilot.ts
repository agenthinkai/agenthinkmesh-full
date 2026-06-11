/**
 * pharmaPilot.ts — Pharma Retrospective Pilot tRPC Router
 *
 * Provides two procedures:
 *  1. runTorcetrapibPilot — runs the Pharma Council V1 deliberation and returns
 *     the full council result JSON (no DB persistence required for the pilot).
 *  2. generatePilotReport — takes a council result and generates the
 *     Institutional Proof Report PDF (base64) + raw JSON payload.
 *
 * Evidence boundary: all council input is pre-ILLUMINATE (cutoff Dec 31 2005).
 * Retrospective outcome data appears only in the PDF appendix.
 *
 * No new DB tables. No new UI pages. Pilot only.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { runPharmaCouncilV1, PHARMA_CONSTITUTION_V1, TORCETRAPIB_DECISION_BRIEF } from "../pharmaCouncilV1";
import { generateTorcetrapibProofReportPdf } from "../torcetrapibProofReportPdf";
import type { PharmaCouncilResult } from "../pharmaCouncilV1";

export const pharmaPilotRouter = router({
  /**
   * Run the Torcetrapib Pharma Council V1 deliberation.
   * Returns the full council result as JSON.
   * Evidence boundary: pre-ILLUMINATE only (cutoff Dec 31 2005).
   */
  runTorcetrapibPilot: protectedProcedure.mutation(async () => {
    const result = await runPharmaCouncilV1();
    return result;
  }),

  /**
   * Generate the Institutional Proof Report PDF from a council result.
   * Returns base64-encoded PDF and raw JSON payload.
   */
  generatePilotReport: protectedProcedure
    .input(
      z.object({
        councilResult: z.any(), // PharmaCouncilResult
      })
    )
    .mutation(async ({ input }) => {
      const councilResult = input.councilResult as PharmaCouncilResult;
      const pdfBuffer = await generateTorcetrapibProofReportPdf(councilResult);
      const pdfBase64 = pdfBuffer.toString("base64");

      // Build the raw JSON payload (deliverable C)
      const payload = {
        reportId:       `IPR-PHARMA-RETRO-TORCETRAPIB-${Date.now()}`,
        generatedAt:    new Date().toISOString(),
        pilot:          "Torcetrapib Retrospective Validation Pilot v1.0",
        evidenceCutoff: TORCETRAPIB_DECISION_BRIEF.evidenceCutoff,
        evidenceBoundaryStatement: TORCETRAPIB_DECISION_BRIEF.evidenceBoundaryStatement,
        constitution:   PHARMA_CONSTITUTION_V1,
        decisionBrief:  TORCETRAPIB_DECISION_BRIEF,
        councilResult,
        retrospectiveOutcome: {
          note: "POST-FAILURE DATA — EXCLUDED FROM COUNCIL INPUT. For audit trail only.",
          illuminateTermination: "December 2, 2006 — ILLUMINATE trial terminated by DSMB",
          deaths:                "82 deaths (torcetrapib arm) vs 51 deaths (control arm)",
          rdWriteOff:            "~$800M R&D write-off",
          marketCapLoss:         "~$21B Pfizer market cap loss on termination announcement",
          offTargetMechanism:    "Forrest et al. 2008 (NEJM): aldosterone-mediated hypertension confirmed as off-target effect of torcetrapib molecule, not CETP class effect",
          retrospectiveValidation: "Council WAIT verdict was retrospectively correct. The BP signal was a harbinger of the off-target aldosterone effect.",
        },
      };

      return {
        pdfBase64,
        jsonPayload: JSON.stringify(payload, null, 2),
        sessionId:   councilResult.sessionId,
        verdict:     councilResult.verdict,
        proofScore:  councilResult.proofScore,
      };
    }),

  /**
   * Return the constitution and decision brief for display/export.
   */
  getPilotMetadata: protectedProcedure.query(() => {
    return {
      constitution:  PHARMA_CONSTITUTION_V1,
      decisionBrief: TORCETRAPIB_DECISION_BRIEF,
      personas:      [
        { id: "chief-biostatistician",   name: "Chief Biostatistician",    weight: 15 },
        { id: "clinical-pharmacologist", name: "Clinical Pharmacologist",  weight: 15 },
        { id: "regulatory-strategist",   name: "Regulatory Strategist",    weight: 15 },
        { id: "drug-safety-expert",      name: "Drug Safety Expert",       weight: 15 },
        { id: "portfolio-manager",       name: "Portfolio Manager",        weight: 10 },
        { id: "scientific-skeptic",      name: "Scientific Skeptic",       weight: 10 },
        { id: "commercial-assessor",     name: "Commercial Assessor",      weight:  5 },
        { id: "patient-advocate",        name: "Patient Advocate",         weight:  5 },
        { id: "quality-compliance-expert", name: "Quality / Compliance Expert", weight: 5 },
        { id: "devils-advocate",         name: "Devil's Advocate",         weight:  5 },
      ],
    };
  }),
});
