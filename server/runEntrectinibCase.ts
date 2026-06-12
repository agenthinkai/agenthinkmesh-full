import { invokeLLM } from "./_core/llm";
import * as fs from "fs";

const PROMPT = `You are the Validation Director for AgenThink Mesh, executing a retrospective pharmaceutical decision-governance case. Audience: FDA, EMA, MHRA, Big Four diligence teams, pharma R&D leadership. Be skeptical. Do not inflate results. Record failures honestly.

CASE 10: Entrectinib (RXDX-101) | Ignyta (acquired by Roche 2018) | ROS1/TRK/ALK tyrosine kinase inhibitor | NTRK fusion-positive solid tumors and ROS1-positive NSCLC | Phase II STARTRK-2 basket trial ~2016-2017 | Advancement decision ~2017 | FDA approval August 2019 as Rozlytrek | First CNS-penetrant TRK inhibitor approved

PHARMA COUNCIL V1 — 10 PERSONAS: 1. Chief Biostatistician, 2. Clinical Pharmacologist, 3. Regulatory Strategist, 4. Drug Safety Expert, 5. Portfolio Manager, 6. Scientific Skeptic, 7. Commercial Assessor, 8. Patient Advocate, 9. Quality/Compliance Expert, 10. Devil's Advocate

PHARMA CONSTITUTION V1: PC-001 Evidence Primacy, PC-002 Safety Signal Priority, PC-003 Financial Independence, PC-004 Surrogate Endpoint Scrutiny, PC-005 Competitive Class Analysis, PC-006 Quantitative Risk-Benefit, PC-007 Mechanistic Investigation, PC-008 DSMB Charter Alignment, PC-009 Regulatory Risk Documentation, PC-010 Dissent Documentation

Produce a complete 8-section case report:

SECTION A — EVIDENCE BOUNDARY
Decision date, evidence cutoff, allowed information, excluded information, regulatory context at time, trial data available at time.

SECTION B — DECISION BRIEF (pre-decision only)
Drug name, sponsor, therapeutic area, mechanism of action (detailed), Phase II primary results with effect sizes, Phase II safety profile, safety signals, competitive landscape, regulatory context, financial context.

SECTION C — COUNCIL EXECUTION
For each of 10 personas: VOTE (GO/WAIT/NO-GO), CONFIDENCE %, RATIONALE (2-4 sentences), KEY CONCERNS (1-3 items), CONSTITUTIONAL REFERENCES.
VOTE SUMMARY: GO count, WAIT count, NO-GO count, FINAL VERDICT.

SECTION D — BLOCKER ANALYSIS
Top blockers ranked by severity (CRITICAL/HIGH/MEDIUM/LOW), top opportunities, evidence gaps, governance concerns.

SECTION E — RETROSPECTIVE OUTCOME
Phase III outcome, regulatory outcome, commercial outcome, financial impact, scientific findings discovered later, verdict alignment (YES/PARTIAL/NO) with explanation.

SECTION F — VALIDATION SCORECARD
Score 0-10 with justification for: CVA, SDA, CBI, FPB, MR, GQ, EC, AUD.
OVS = (CVA*0.20)+(SDA*0.20)+(CBI*0.20)+(FPB*0.15)+(MR*0.10)+(GQ*0.05)+(EC*0.05)+(AUD*0.10)

SECTION G — LESSONS LEARNED
What council identified correctly, what it missed, improvements, most valuable personas, constitutional rules that worked/failed.

SECTION H — LIBRARY UPDATE
Running totals for all 10 cases. Torcetrapib (Case 1): WAIT/correct/OVS=9.8. Calculate verdict alignment rate, signal detection rate, false positive rate, false negative rate.`;

async function main() {
  console.log("Running Entrectinib Case 10...");
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a pharmaceutical governance expert producing a rigorous retrospective validation case report. Be precise, factual, and skeptical. Do not inflate scores." },
      { role: "user", content: PROMPT }
    ]
  });
  
  const content = typeof response.choices[0].message.content === "string"
    ? response.choices[0].message.content
    : JSON.stringify(response.choices[0].message.content);
  
  fs.writeFileSync("/tmp/entrectinib-case10.txt", content);
  console.log("Done. Output saved to /tmp/entrectinib-case10.txt");
  console.log("Length:", content.length);
  console.log("First 500 chars:", content.substring(0, 500));
}

main().catch(console.error);
