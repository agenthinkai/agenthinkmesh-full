/**
 * Reproduction script for IC Memo PDF export failure in Infrastructure mode.
 * Run with: npx tsx server/reproduceIcMemoFailure.ts
 */
import { generateICMemoPdf } from "./icMemoPdf.js";
import type { ICMemoInput } from "./icMemoPdf.js";
import * as fs from "fs";
import * as path from "path";

const HELIOS_NORTH_VOTES = [
  {
    personaRole: "Infrastructure Debt Analyst",
    vote: "HARD_NO",
    confidence: 0.95,
    rationale: "DSCR under base case falls to 0.9x at CfD £73/MWh — below the 1.2x covenant threshold required for project finance. Refinancing resilience is critically low given FOAK floating foundation risk.",
    keyFlags: ["DSCR < 1.2x", "CfD below threshold", "Refinancing risk"],
    conditions: ["CfD ≥ £85/MWh", "DSCR ≥ 1.25x at base case"],
    blockers: ["DSCR 0.9x at CfD £73/MWh", "No fixed-price EPC", "FOAK floating foundation"],
    topMitigants: ["CfD floor at £85/MWh", "Fixed-price EPC with LD backstop", "Foundation validation programme"],
  },
  {
    personaRole: "EPC & Construction Risk Analyst",
    vote: "HARD_NO",
    confidence: 0.97,
    rationale: "Open-book EPC with FOAK floating foundations is unacceptable. No commercial-scale track record for floating monopiles at 70–95m depth in Celtic Sea conditions. 1.7% contingency is critically inadequate.",
    keyFlags: ["FOAK technology", "Open-book EPC", "Inadequate contingency"],
    conditions: ["Fixed-price EPC with LD backstop", "Contingency ≥ 5%", "Foundation validation"],
    blockers: ["FOAK floating foundation", "Open-book EPC", "1.7% contingency"],
    topMitigants: ["Fixed-price EPC", "Contingency raised to 5%", "Independent engineering validation"],
  },
  {
    personaRole: "Offtake & Revenue Risk Analyst",
    vote: "HARD_NO",
    confidence: 0.92,
    rationale: "CfD strike price of £73/MWh is below the fund's minimum IRR threshold. 20% merchant exposure creates material downside risk in a price-volatile market.",
    keyFlags: ["CfD below minimum", "20% merchant exposure"],
    conditions: ["CfD ≥ £85/MWh", "Merchant exposure ≤ 10%"],
    blockers: ["CfD £73/MWh below fund minimum", "20% merchant exposure"],
    topMitigants: ["CfD floor at £85/MWh", "Reduce merchant exposure to ≤ 10%"],
  },
  {
    personaRole: "LCOE & Cost Competitiveness Analyst",
    vote: "HARD_NO",
    confidence: 0.88,
    rationale: "LCOE of £142/MWh for floating offshore wind at this scale is not competitive versus fixed-bottom alternatives at £95–110/MWh. Cost reduction pathway is speculative.",
    keyFlags: ["LCOE uncompetitive", "Cost reduction speculative"],
    conditions: ["LCOE pathway to £110/MWh demonstrated"],
    blockers: ["LCOE £142/MWh vs £95-110/MWh fixed-bottom"],
    topMitigants: ["Technology cost reduction roadmap", "Scale economics demonstration"],
  },
  {
    personaRole: "Regulatory & Policy Risk Analyst",
    vote: "SOFT_NO",
    confidence: 0.75,
    rationale: "Celtic Sea leasing round is proceeding but CfD allocation timing is uncertain. Policy risk is manageable if CfD is secured pre-FID.",
    keyFlags: ["CfD timing uncertainty", "Celtic Sea leasing"],
    conditions: ["CfD secured pre-FID"],
    blockers: ["CfD not yet secured"],
    topMitigants: ["CfD secured pre-FID", "Policy engagement programme"],
  },
  {
    personaRole: "Environmental & Permitting Analyst",
    vote: "SOFT_NO",
    confidence: 0.72,
    rationale: "Celtic Sea environmental impact assessment is at early stage. Marine mammal and seabird surveys incomplete. Permitting timeline adds 18–24 months of uncertainty.",
    keyFlags: ["EIA incomplete", "Permitting timeline"],
    conditions: ["EIA completed", "Permitting timeline confirmed"],
    blockers: ["EIA at early stage"],
    topMitigants: ["Complete EIA", "Engage Marine Management Organisation"],
  },
  {
    personaRole: "Grid & Transmission Risk Analyst",
    vote: "HARD_NO",
    confidence: 0.91,
    rationale: "No grid connection agreement secured. National Grid queue position is unconfirmed. Transmission costs for Celtic Sea are materially higher than assumed.",
    keyFlags: ["No grid connection", "Transmission cost uncertainty"],
    conditions: ["Grid connection agreement secured", "Transmission cost confirmed"],
    blockers: ["No grid connection agreement", "Queue position unconfirmed"],
    topMitigants: ["Secure grid connection agreement", "Confirm transmission costs"],
  },
  {
    personaRole: "Sponsor & Developer Track Record Analyst",
    vote: "SOFT_NO",
    confidence: 0.68,
    rationale: "Developer has fixed-bottom experience but no floating offshore wind project delivered at commercial scale. Management team credibility is adequate but technology gap is material.",
    keyFlags: ["No floating wind track record", "Management gap"],
    conditions: ["Partnership with floating wind specialist"],
    blockers: ["No commercial-scale floating wind delivery"],
    topMitigants: ["Partner with Equinor or BW Offshore for floating expertise"],
  },
  {
    personaRole: "Insurance & Force Majeure Analyst",
    vote: "HARD_NO",
    confidence: 0.85,
    rationale: "Insurance market for FOAK floating foundations is thin. Construction all-risk and operational coverage is unavailable at commercial terms for this technology at this scale.",
    keyFlags: ["Insurance market thin", "FOAK coverage gap"],
    conditions: ["Insurance coverage confirmed at commercial terms"],
    blockers: ["Insurance unavailable for FOAK floating at this scale"],
    topMitigants: ["Engage Lloyd's market early", "Reduce scale to proven technology envelope"],
  },
  {
    personaRole: "Refinancing & Capital Markets Analyst",
    vote: "HARD_NO",
    confidence: 0.89,
    rationale: "Refinancing resilience is critically low. No comparable floating offshore wind project has been refinanced in the capital markets. Construction lenders will require significant equity cushion.",
    keyFlags: ["No refinancing precedent", "High equity requirement"],
    conditions: ["Refinancing pathway demonstrated", "Equity cushion ≥ 35%"],
    blockers: ["No refinancing precedent for floating offshore wind"],
    topMitigants: ["Demonstrate refinancing pathway", "Increase equity cushion"],
  },
];

const payload: ICMemoInput = {
  dealName: "Helios-North Floating Offshore Wind",
  dealText: `Helios-North is a proposed 500MW floating offshore wind project located in the Celtic Sea, approximately 60km off the coast of Cornwall, UK. Water depth ranges from 70–95m, requiring floating foundation technology. The project is at pre-FID stage with a target CfD strike price of £73/MWh under the AR7 allocation round. EPC structure is open-book with a FOAK floating monopile foundation design. Contingency is 1.7% of total CAPEX of £2.1bn. Merchant exposure is 20% of revenue. No grid connection agreement has been secured. The developer has extensive fixed-bottom offshore wind experience but no commercial-scale floating wind delivery.`,
  verdict: "VETOED",
  yesCount: 0,
  noCount: 10,
  confidenceScore: 0.92,
  councilMode: "infrastructure",
  votes: HELIOS_NORTH_VOTES,
  keyStrengths: [
    "Celtic Sea location with strong wind resource (P50 capacity factor 42%)",
    "Developer has 15 years fixed-bottom offshore wind experience",
    "Aligned with UK Government floating wind targets (5GW by 2030)",
  ],
  keyRisks: [
    "FOAK floating foundation technology — no commercial-scale validation",
    "CfD £73/MWh below fund minimum IRR threshold",
    "Open-book EPC with inadequate contingency (1.7%)",
    "20% merchant exposure in price-volatile market",
    "No grid connection agreement secured",
  ],
  conditionsToProceed: [
    "CfD strike price ≥ £85/MWh secured pre-FID",
    "Fixed-price EPC contract with LD backstop",
    "Construction contingency raised to ≥ 5% of CAPEX",
    "Floating foundation validated at commercial scale",
    "Merchant exposure reduced to ≤ 10%",
  ],
  blockingIssues: [
    "FOAK floating foundation — no commercial-scale track record",
    "CfD £73/MWh below fund minimum IRR threshold",
    "Open-book EPC with FOAK technology",
    "Insurance market unavailable at commercial terms for floating offshore wind at this scale",
    "No refinancing precedent for floating offshore wind in capital markets",
    "No grid connection agreement secured",
  ],
  decisionTriggers: {
    hardNoTriggers: [
      "FOAK floating foundation — no commercial-scale track record",
      "CfD £73/MWh below fund minimum IRR threshold",
      "Open-book EPC with FOAK technology",
      "Insurance market unavailable at commercial terms",
    ],
    upgradeTriggers: [
      "CfD ≥ £85/MWh",
      "Fixed-price EPC with LD backstop",
      "Contingency ≥ 5%",
      "Floating foundation validated",
      "Merchant exposure ≤ 10%",
    ],
    watchItems: [
      "Celtic Sea leasing round timeline",
      "Grid connection queue position",
      "EIA completion timeline",
    ],
  },
};

async function main() {
  console.log("[REPRODUCE] Starting IC Memo PDF generation for Helios-North (Infrastructure mode)...");
  try {
    const pdfBuffer = await generateICMemoPdf(payload);
    const outPath = path.join(process.cwd(), "helios_north_ic_memo_test.pdf");
    fs.writeFileSync(outPath, pdfBuffer);
    console.log(`[REPRODUCE] SUCCESS — PDF written to ${outPath} (${pdfBuffer.length} bytes)`);
  } catch (err: any) {
    console.error("[REPRODUCE] FAILURE —", err?.message ?? err);
    console.error("[REPRODUCE] Stack:", err?.stack ?? "(no stack)");
    process.exit(1);
  }
}

main();
