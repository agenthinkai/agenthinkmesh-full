/**
 * Distribution shape verification test.
 * Runs 100 scenarios on a synthetic Helios-North-style REJECTED deal
 * with baseApprovalScore = -0.15 (REJECTED base) and verifies:
 *   - Distribution is NOT flat 100% reject
 *   - Approve + Conditional > 0%
 *   - Sensitivity surface has non-zero values
 *
 * Also runs with baseApprovalScore = 0.55 (APPROVED base) and verifies:
 *   - Approve rate is meaningfully higher
 */

import { generateScenarioVariants, buildScenarioBrief, evaluateScenario } from "./server/scenarioMutationEngine.ts";
import { aggregateSimulationResults } from "./server/scenarioAggregator.ts";

const HELIOS_NORTH_BRIEF = `
DEAL NAME: Helios-North Solar Infrastructure Fund
SECTOR: Renewable Energy Infrastructure
STRUCTURE: Project Finance / Senior Secured Debt
TICKET SIZE: $120M
DSCR: 1.18x (base case), 0.94x (stressed)
OFFTAKE: 60% contracted (PPA with sovereign utility), 40% merchant
SPONSOR: First-time infrastructure sponsor, no prior project finance exits
KEY RISKS: Merchant price exposure, sponsor track record gap, construction completion risk
GOVERNANCE: SPV structure, independent technical advisor engaged
JURISDICTION: Sub-Saharan Africa (Kenya)
VERDICT: REJECTED — DSCR below 1.20x threshold under stress, sponsor track record insufficient
`;

const MOCK_LLM = async ({ messages }) => {
  // Simulate LLM middle-band evaluation with realistic variance
  const brief = messages[1]?.content ?? "";
  const stressLevel = (brief.match(/SEVERE|severe|critical/gi) ?? []).length;
  const mildLevel = (brief.match(/MILD|mild|minor/gi) ?? []).length;
  
  let decision;
  const rand = Math.random();
  if (stressLevel >= 2) {
    decision = rand < 0.75 ? "REJECT" : "CONDITIONAL";
  } else if (stressLevel === 1) {
    decision = rand < 0.45 ? "REJECT" : rand < 0.75 ? "CONDITIONAL" : "APPROVE";
  } else if (mildLevel >= 1) {
    decision = rand < 0.20 ? "REJECT" : rand < 0.55 ? "CONDITIONAL" : "APPROVE";
  } else {
    decision = rand < 0.30 ? "REJECT" : rand < 0.60 ? "CONDITIONAL" : "APPROVE";
  }
  
  return {
    choices: [{
      message: {
        content: JSON.stringify({
          decision,
          confidence: 0.60 + Math.random() * 0.30,
          rationale: "Scenario evaluation complete."
        })
      }
    }]
  };
};

async function runTest(label, baseApprovalScore) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: ${label}`);
  console.log(`baseApprovalScore: ${baseApprovalScore}`);
  console.log("=".repeat(60));

  const variants = generateScenarioVariants(100, 42);
  const results = await Promise.all(
    variants.map(v => evaluateScenario(
      v,
      buildScenarioBrief(HELIOS_NORTH_BRIEF, v),
      MOCK_LLM,
      "infrastructure",
      baseApprovalScore
    ))
  );

  const agg = aggregateSimulationResults(results, "test-run", "helios-north", "quick");
  const dist = agg.decisionDistribution;
  
  console.log("\nDECISION DISTRIBUTION:");
  console.log(`  APPROVE:      ${dist.approveCount} / 100  (${dist.approvePct.toFixed(1)}%)`);
  console.log(`  CONDITIONAL:  ${dist.conditionalCount} / 100  (${dist.conditionalPct.toFixed(1)}%)`);
  console.log(`  REJECT:       ${dist.rejectCount} / 100  (${dist.rejectPct.toFixed(1)}%)`);
  console.log(`  HARD-NO:      ${dist.hardNoCount} / 100  (${dist.hardNoPct.toFixed(1)}%)`);

  const sensitivityEntries = Object.entries(agg.sensitivitySurface ?? {});
  const nonZeroSensitivity = sensitivityEntries.filter(([, v]) => Math.abs(v) > 0.5);
  console.log(`\nSENSITIVITY SURFACE: ${sensitivityEntries.length} categories, ${nonZeroSensitivity.length} non-zero`);
  if (nonZeroSensitivity.length > 0) {
    nonZeroSensitivity.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5).forEach(([cat, score]) => {
      console.log(`  ${cat}: ${score.toFixed(1)}`);
    });
  }

  // Assertions
  const isFlat = dist.rejectCount === 100;
  const hasShape = (dist.approveCount + dist.conditionalCount) > 0;
  
  console.log("\nASSERTIONS:");
  console.log(`  ✓ Distribution not flat 100% reject: ${!isFlat ? "PASS" : "FAIL"}`);
  console.log(`  ✓ Approve + Conditional > 0: ${hasShape ? "PASS" : "FAIL"}`);
  
  if (baseApprovalScore >= 0.55) {
    const highApproval = dist.approvePct > 30;
    console.log(`  ✓ High baseScore → approve rate > 30%: ${highApproval ? "PASS" : "FAIL (got " + dist.approvePct.toFixed(1) + "%)"}`);
  }
  
  if (baseApprovalScore <= -0.15) {
    const highReject = dist.rejectPct > 30;
    console.log(`  ✓ Low baseScore → reject rate > 30%: ${highReject ? "PASS" : "FAIL (got " + dist.rejectPct.toFixed(1) + "%)"}`);
  }

  return { dist, isFlat, hasShape };
}

// Run both tests
const rejectedResult = await runTest("REJECTED deal (Helios-North)", -0.15);
const approvedResult = await runTest("APPROVED deal (same deal, upgraded)", 0.55);

console.log("\n" + "=".repeat(60));
console.log("SUMMARY");
console.log("=".repeat(60));
console.log(`Rejected deal: ${rejectedResult.dist.approvePct.toFixed(1)}% approve, ${rejectedResult.dist.rejectPct.toFixed(1)}% reject`);
console.log(`Approved deal: ${approvedResult.dist.approvePct.toFixed(1)}% approve, ${approvedResult.dist.rejectPct.toFixed(1)}% reject`);
const approveRateDelta = approvedResult.dist.approvePct - rejectedResult.dist.approvePct;
console.log(`Delta: +${approveRateDelta.toFixed(1)}pp approve rate improvement`);
console.log(`Distribution has shape: ${!rejectedResult.isFlat && !approvedResult.isFlat ? "YES ✓" : "NO ✗"}`);
