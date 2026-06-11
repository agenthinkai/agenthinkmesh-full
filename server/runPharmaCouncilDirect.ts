/**
 * runPharmaCouncilDirect.ts — Direct runner for the Torcetrapib pilot
 *
 * Runs the Pharma Council V1 deliberation and saves:
 *   - raw JSON payload to /tmp/torcetrapib-council-result.json
 *   - Institutional Proof Report PDF to /tmp/torcetrapib-proof-report.pdf
 *
 * Usage: npx tsx server/runPharmaCouncilDirect.ts
 */

import { writeFileSync } from "fs";
import { runPharmaCouncilV1, PHARMA_CONSTITUTION_V1, TORCETRAPIB_DECISION_BRIEF } from "./pharmaCouncilV1";
import { generateTorcetrapibProofReportPdf } from "./torcetrapibProofReportPdf";

async function main() {
  console.log("=".repeat(70));
  console.log("PHARMA COUNCIL V1 — TORCETRAPIB RETROSPECTIVE PILOT");
  console.log("AgenThink Mesh Governed Decision Infrastructure");
  console.log("=".repeat(70));
  console.log("");
  console.log(`Drug:             ${TORCETRAPIB_DECISION_BRIEF.drug}`);
  console.log(`Company:          ${TORCETRAPIB_DECISION_BRIEF.company}`);
  console.log(`Decision:         ${TORCETRAPIB_DECISION_BRIEF.decisionType}`);
  console.log(`Evidence cutoff:  ${TORCETRAPIB_DECISION_BRIEF.evidenceCutoff}`);
  console.log(`Constitution:     ${PHARMA_CONSTITUTION_V1.version}`);
  console.log(`Personas:         10`);
  console.log("");
  console.log("EVIDENCE BOUNDARY: All council input is pre-ILLUMINATE (cutoff Dec 31 2005).");
  console.log("Post-failure data excluded from council input.");
  console.log("");
  console.log("Running 10 personas in parallel...");
  console.log("");

  const startMs = Date.now();
  const result = await runPharmaCouncilV1();
  const durationSec = ((Date.now() - startMs) / 1000).toFixed(1);

  console.log("=".repeat(70));
  console.log("COUNCIL DELIBERATION COMPLETE");
  console.log("=".repeat(70));
  console.log("");
  console.log(`Verdict:          ${result.verdict}`);
  console.log(`Vote:             ${result.goCount} GO / ${result.waitCount} WAIT / ${result.noGoCount} NO-GO`);
  console.log(`Proof Score:      ${result.proofScore}/100`);
  console.log(`Duration:         ${durationSec}s`);
  console.log(`Session ID:       ${result.sessionId}`);
  console.log("");
  console.log("VOTE DISTRIBUTION:");
  console.log("-".repeat(70));
  result.votes.forEach(v => {
    const flag = v.timedOut ? " [TIMED OUT]" : "";
    console.log(`  ${v.personaName.padEnd(30)} ${v.vote.padEnd(8)} ${v.confidence}%${flag}`);
    if (v.rationale && !v.timedOut) {
      console.log(`    Rationale: ${v.rationale.slice(0, 100)}...`);
    }
    if (v.safetyObjection) {
      console.log(`    Safety:    ${v.safetyObjection.slice(0, 100)}`);
    }
    console.log("");
  });

  console.log("KEY BLOCKERS:");
  result.keyBlockers.forEach(b => console.log(`  - ${b}`));
  console.log("");

  console.log("SAFETY OBJECTIONS:");
  result.safetyObjections.forEach(s => console.log(`  - ${s}`));
  console.log("");

  console.log("REGULATORY CONCERNS:");
  result.regulatoryConcerns.forEach(r => console.log(`  - ${r}`));
  console.log("");

  console.log("VERDICT RATIONALE:");
  console.log(`  ${result.verdictRationale}`);
  console.log("");

  // Build full JSON payload
  const payload = {
    reportId:       `IPR-PHARMA-RETRO-TORCETRAPIB-${new Date().toISOString().slice(0, 10)}`,
    generatedAt:    new Date().toISOString(),
    pilot:          "Torcetrapib Retrospective Validation Pilot v1.0",
    evidenceCutoff: TORCETRAPIB_DECISION_BRIEF.evidenceCutoff,
    evidenceBoundaryStatement: TORCETRAPIB_DECISION_BRIEF.evidenceBoundaryStatement,
    constitution:   PHARMA_CONSTITUTION_V1,
    decisionBrief:  TORCETRAPIB_DECISION_BRIEF,
    councilResult:  result,
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

  // Save JSON
  const jsonPath = "/tmp/torcetrapib-council-result.json";
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  console.log(`JSON payload saved: ${jsonPath}`);

  // Generate PDF
  console.log("Generating Institutional Proof Report PDF...");
  const pdfBuffer = await generateTorcetrapibProofReportPdf(result);
  const pdfPath = "/tmp/torcetrapib-proof-report.pdf";
  writeFileSync(pdfPath, pdfBuffer);
  console.log(`PDF saved: ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);

  console.log("");
  console.log("=".repeat(70));
  console.log("PILOT COMPLETE");
  console.log("=".repeat(70));
}

main().catch(err => {
  console.error("PILOT FAILED:", err);
  process.exit(1);
});
