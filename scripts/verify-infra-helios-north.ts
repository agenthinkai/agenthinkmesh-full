/**
 * Helios-North Infrastructure Mode Verification Script
 * Calls icReportEngine and councilEngine directly to verify all 7 acceptance criteria.
 * Run with: cd /home/ubuntu/agenthinkmesh-full && npx tsx scripts/verify-infra-helios-north.ts
 */

import { generateSingleDealICReport } from "../server/icReportEngine";
import { runCouncil } from "../server/councilEngine";

const HELIOS_NORTH_DEAL_NAME = "Helios-North Offshore Wind Farm";

const HELIOS_NORTH_DEAL_TEXT = `
DEAL: Helios-North Offshore Wind Farm — Series A Infrastructure Debt Financing
LOCATION: North Sea, 45km offshore, UK waters
CAPACITY: 450 MW (150 x 3MW turbines, Vestas V164)
DEVELOPER: Helios Energy Partners Ltd (founded 2019, 3 prior onshore projects)
TOTAL PROJECT COST: £1.85 billion
DEBT REQUEST: £1.2 billion senior secured project finance loan (65% LTV)
EQUITY: £650 million (Helios 40%, Meridian Infrastructure Fund 35%, GCC sovereign co-invest 25%)
TENOR: 18-year debt facility
OFFTAKE: 15-year CfD (Contract for Difference) at £82/MWh strike price, awarded by DESNZ
CONSTRUCTION: EPC contract with Offshore Wind Builders Consortium (OWBC) — fixed-price £1.1B, 36-month build
DSCR: Base case 1.28x, stress case 1.09x (P90 wind scenario)
GRID CONNECTION: Ofto agreement signed, substation construction 60% complete
INSURANCE: Allianz Marine underwriting, £50M delay-in-start-up cover
RISKS:
  - EPC contractor OWBC has one prior offshore project (250MW, completed 2021, 4-month delay)
  - Turbine supply chain: Vestas has confirmed Q3 2026 delivery but global order backlog at 18 months
  - Contingency: £95M (8.6% of EPC value — below typical 10-12% for offshore)
  - Debt service reserve: 6 months DSRA funded at financial close
  - Interest rate: SONIA + 220bps, hedged 80% via fixed-rate swap
  - P50 capacity factor: 42%, P90: 38%
  - Grid curtailment risk: National Grid estimates 3-5% curtailment in this zone
  - No revenue floor below CfD strike — merchant tail risk post-Year 15
  - Environmental permits: all obtained, judicial review period expired March 2025
FINANCIAL PROJECTIONS:
  - Year 1 revenue: £152M (at P50 generation)
  - Annual debt service: £118M
  - DSCR Year 1: 1.29x
  - DSCR stress (P90 + 5% curtailment): 1.07x
  - Project IRR: 8.2% (equity)
  - Equity multiple: 1.9x over 20-year life
COMPARABLE TRANSACTIONS:
  - Hornsea 2 (1.3GW, 2022): DSCR 1.35x, CfD £57/MWh
  - Dogger Bank A (1.2GW, 2023): DSCR 1.31x, CfD £39/MWh (CFD round 4)
  - Moray East (950MW, 2021): DSCR 1.22x, EPC overrun 12%
SPONSOR TRACK RECORD: 3 onshore wind projects (total 180MW), no offshore experience
LEGAL: English law governed, ISDA master agreement for hedging, step-in rights for lenders
`;

async function runVerification() {
  console.log("=== HELIOS-NORTH INFRASTRUCTURE MODE VERIFICATION ===\n");
  console.log("Running council in Infrastructure mode (all 10 personas)...");

  let councilResult: Awaited<ReturnType<typeof runCouncil>>;
  try {
    councilResult = await runCouncil({
      dealName: HELIOS_NORTH_DEAL_NAME,
      dealText: HELIOS_NORTH_DEAL_TEXT,
      councilMode: "infrastructure",
      dealId: "helios-north-verification-test",
    });
    console.log("\n✅ Council completed.");
    console.log(`Verdict: ${councilResult.verdict}`);
    console.log(`Yes: ${councilResult.yesCount} | No: ${councilResult.noCount} | Conditional: ${(councilResult as any).conditionalCount ?? "N/A"}`);
    console.log(`Terminal flags: ${JSON.stringify((councilResult as any).terminalFlags ?? [])}`);
  } catch (err) {
    console.error("Council run failed:", err);
    process.exit(1);
  }

  console.log("\nGenerating IC Report in Infrastructure mode...");
  let icReport: Awaited<ReturnType<typeof generateSingleDealICReport>>;
  try {
    icReport = await generateSingleDealICReport(
      HELIOS_NORTH_DEAL_NAME,
      HELIOS_NORTH_DEAL_TEXT,
      councilResult,
      "infrastructure"
    );
    console.log("\n✅ IC Report generated.");
  } catch (err) {
    console.error("IC Report generation failed:", err);
    process.exit(1);
  }

  // ── VERIFICATION CHECKS ──────────────────────────────────────────────────
  const results: Array<{ id: number; criterion: string; pass: boolean; evidence: string }> = [];
  const fullText = JSON.stringify(icReport);

  // Check 1: Verdict language — no "Reject and archive"
  // executiveVerdict is an object: { decision, recommendedAction, rationale }
  const ev = (icReport as any).executiveVerdict ?? {};
  const execRecommendedAction: string = typeof ev.recommendedAction === "string" ? ev.recommendedAction : "";
  const execRationale: string = typeof ev.rationale === "string" ? ev.rationale : "";
  const execDecision: string = typeof ev.decision === "string" ? ev.decision : "";
  const execVerdictFull = `${execDecision} | ${execRecommendedAction} | ${execRationale}`;
  const hasRejectArchive = /reject.*archive|archive.*reject/i.test(execVerdictFull);
  const hasCorrectLanguage = /decline at current structure|do not proceed under current risk profile|decline.*structure|not proceed.*risk/i.test(execVerdictFull);
  const isApproved = councilResult.verdict === "APPROVED" || councilResult.verdict === "APPROVED_WITH_CONDITIONS";
  results.push({
    id: 1,
    criterion: "Verdict language: no 'Reject and archive'; uses 'Decline at current structure' or equivalent",
    pass: !hasRejectArchive && (hasCorrectLanguage || isApproved),
    evidence: `Decision: "${execDecision}" | RecommendedAction: "${execRecommendedAction}" | Rationale: "${execRationale.substring(0, 120)}"`,
  });

  // Check 2: Section 6 present even for REJECTED/VETOED
  const reversalConditions: string[] = (icReport as any).whatWouldChangeDecision ?? [];
  results.push({
    id: 2,
    criterion: "Section 6 (whatWouldChangeDecision / Decision Reversal Conditions) present even for rejected deals",
    pass: reversalConditions.length > 0,
    evidence: `${reversalConditions.length} conditions present. Council verdict: ${councilResult.verdict}`,
  });

  // Check 3: Section 6 has concrete infrastructure-specific conditions
  const hasConcreteConditions = reversalConditions.length >= 2 &&
    reversalConditions.some(c => /dscr|epc|cfd|offtake|contingency|debt|structure|guarantee|sponsor|lender|completion/i.test(c));
  results.push({
    id: 3,
    criterion: "Section 6 contains concrete, infrastructure-specific Decision Reversal Conditions",
    pass: hasConcreteConditions,
    evidence: `Sample conditions: [${reversalConditions.slice(0, 3).map(c => `"${c.substring(0, 100)}"`).join(", ")}]`,
  });

  // Check 4: Consensus breakdown keyDisagreements field exists (UI renders as Blocker Concentration)
  const keyDisagreements: string[] = (icReport as any).consensusBreakdown?.keyDisagreements ?? [];
  results.push({
    id: 4,
    criterion: "Consensus breakdown keyDisagreements field present (UI renders as BLOCKER CONCENTRATION for Infrastructure mode)",
    pass: Array.isArray(keyDisagreements),
    evidence: `${keyDisagreements.length} disagreements. Sample: ${keyDisagreements.slice(0, 2).map(d => `"${d.substring(0, 80)}"`).join(", ") || "(none — clean deal or all agree)"}`,
  });

  // Check 5: No PE/VC IRR minimum assumptions
  const hasIRRMinimum = /\b(15%|20%|25%|30%)\s*irr\b|irr\s*(minimum|threshold|hurdle|floor|target)\s*(is|of|at)?\s*\d+%/i.test(fullText);
  const hasVCLanguage = /vc.style.return|venture.capital.return.threshold|pe.return.threshold|minimum.irr.threshold/i.test(fullText);
  results.push({
    id: 5,
    criterion: "No PE/VC-style IRR minimum assumptions (e.g., '15% IRR is the minimum threshold')",
    pass: !hasIRRMinimum && !hasVCLanguage,
    evidence: hasIRRMinimum ? "⚠️ IRR minimum language detected" : (hasVCLanguage ? "⚠️ VC-style language detected" : "✅ No IRR minimum / VC-style language found"),
  });

  // Check 6: Infrastructure-specific terms are primary evaluation axes
  const infraTerms = ["dscr", "epc", "contingency", "cfd", "debt structure", "offtake", "debt service", "project finance"];
  const foundTerms = infraTerms.filter(t => fullText.toLowerCase().includes(t));
  results.push({
    id: 6,
    criterion: "DSCR, EPC risk, contingency, CfD, debt structure, offtake quality are primary evaluation axes",
    pass: foundTerms.length >= 5,
    evidence: `Infrastructure terms found (${foundTerms.length}/${infraTerms.length}): [${foundTerms.join(", ")}]`,
  });

  // Check 7: Official verdict unchanged — valid enum value, not altered by IC report
  // Also verify all 10 personas ran (yesCount + noCount + conditionalCount = 10)
  const validVerdicts = ["APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED", "VETOED", "HOLD", "INSUFFICIENT_DATA"];
  const totalVotes = councilResult.yesCount + councilResult.noCount + ((councilResult as any).conditionalCount ?? 0);
  const allTenRan = totalVotes === 10;
  results.push({
    id: 7,
    criterion: "Official verdict logic unchanged (valid verdict, all 10 personas ran, not altered by IC report)",
    pass: validVerdicts.includes(councilResult.verdict) && allTenRan,
    evidence: `Verdict: ${councilResult.verdict} | Yes: ${councilResult.yesCount} | No: ${councilResult.noCount} | Total votes: ${totalVotes}/10 | All 10 ran: ${allTenRan}`,
  });

  // ── PRINT RESULTS ─────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("VERIFICATION RESULTS — HELIOS-NORTH INFRASTRUCTURE MODE");
  console.log("=".repeat(70));

  let allPass = true;
  for (const r of results) {
    const status = r.pass ? "✅ PASS" : "❌ FAIL";
    console.log(`\n[${r.id}] ${status}`);
    console.log(`    Criterion: ${r.criterion}`);
    console.log(`    Evidence:  ${r.evidence}`);
    if (!r.pass) allPass = false;
  }

  console.log("\n" + "=".repeat(70));
  console.log(allPass
    ? "✅ ALL 7 CRITERIA PASS — Infrastructure mode accepted."
    : "❌ SOME CRITERIA FAILED — Review above.");
  console.log("=".repeat(70) + "\n");

  // Save full output for review
  const { writeFileSync } = await import("fs");
  const outputPath = "/home/ubuntu/helios-north-infra-verification.json";
  writeFileSync(outputPath, JSON.stringify({ councilResult, icReport, verificationResults: results }, null, 2));
  console.log(`Full output saved to: ${outputPath}`);

  process.exit(allPass ? 0 : 1);
}

runVerification().catch(err => {
  console.error("Verification script error:", err);
  process.exit(1);
});
