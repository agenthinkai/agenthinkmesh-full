/**
 * heliosNorthDryRun.ts
 *
 * Programmatic dry run of the Helios-North IC memo through the
 * Infrastructure / Project Finance council mode.
 *
 * Usage: npx tsx server/heliosNorthDryRun.ts
 *
 * Reports:
 *   - Verdict + confidence
 *   - Vote breakdown (HARD_YES / SOFT_YES / SOFT_NO / HARD_NO)
 *   - Top 3 blockers per persona
 *   - VC language leakage check (flags any VC-specific terms in rationales)
 *   - DSCR/CfD/EPC language presence check
 *   - Mode label confirmation
 */

import { runAdversarialCouncil } from "./dealScreenerAdversarial";
import { invokeLLM } from "./_core/llm";

const HELIOS_NORTH_MEMO = `PROJECT: Helios-North Offshore Wind
LOCATION: Celtic Sea (South-West UK, floating-wind zone, water depth 70–95m)
CAPACITY: 850 MW
TOTAL CAPEX: £4.2B
BASE CASE IRR: 9.5%
FUND MINIMUM IRR: 15%

IC DECISION: REJECT (3 HARD NO / 4 SOFT NO / 3 SOFT YES)

PRIMARY BLOCKERS:
1. Foundation Technology: Unvalidated floating foundation at commercial scale — no independent engineering validation
2. CfD Strike Price: £73/MWh is below fund IRR threshold; AR7 outcome uncertain
3. Merchant Exposure: 20% unhedged merchant exposure creates material downside risk
4. Contingency: 1.7% contingency is dangerously low for first-of-kind technology
5. EPC: No committed EPC contractor with fixed-price contract
6. Timeline: 11-year project timeline exceeds fund horizon (7 years)

CONDITIONS FOR RE-ENGAGEMENT:
- Foundation technology independently validated at commercial scale
- CfD strike price ≥ £85/MWh (AR7 mid-range)
- Merchant exposure reduced to ≤ 10%
- Committed EPC with fixed-price contract
- Contingency increased to ≥ 5%`;

const VC_LEAK_PATTERNS = [
  /\barr\b/i,
  /\bmrr\b/i,
  /\brunway\b/i,
  /\bseries [a-c]\b/i,
  /\bsaas\b/i,
  /\bchurn\b/i,
  /\bcap table\b/i,
  /\bfounder[s]?\b/i,
  /\btam\b/i,
  /\bhypergrowth\b/i,
  /\btoo capital intensive for venture\b/i,
  /\bproduct.?market fit\b/i,
  /\bburn rate\b/i,
  /\bunit economics\b/i,
];

const INFRA_REQUIRED_PATTERNS = [
  { label: "DSCR",         pattern: /dscr|debt.?service.?cover/i },
  { label: "CfD",          pattern: /cfd|contract.?for.?difference|strike.?price/i },
  { label: "EPC",          pattern: /epc|engineering.?procurement/i },
  { label: "LCOE",         pattern: /lcoe|levelised.?cost/i },
  { label: "Merchant",     pattern: /merchant.?exposure|uncontracted|offtake/i },
  { label: "Foundation",   pattern: /floating|foundation|foak|first.?of.?a.?kind/i },
];

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  HELIOS-NORTH DRY RUN — INFRASTRUCTURE / PROJECT FINANCE MODE");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const startMs = Date.now();

  try {
    const result = await runAdversarialCouncil(
      HELIOS_NORTH_MEMO,
      {
        dealName: "Helios-North Offshore Wind",
        invokeLLM: invokeLLM as any,
        councilMode: "infrastructure",
      }
    );

    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

    console.log(`VERDICT:    ${result.verdict}`);
    console.log(`CONFIDENCE: ${(result.confidenceScore * 100).toFixed(0)}%`);
    console.log(`ELAPSED:    ${elapsed}s`);
    console.log(`HARD NOs:   ${result.hardNoCount}`);
    console.log(`VETO:       ${result.gccVetoTriggered ? "YES" : "NO"}`);
    console.log(`COUNCIL:    Infrastructure / Project Finance\n`);

    // Vote breakdown
    console.log("── VOTE BREAKDOWN ──────────────────────────────────────────────");
    for (const vote of result.votes) {
      console.log(`  [${vote.vote.padEnd(8)}] ${vote.personaName ?? vote.personaId}`);
      if (vote.blockers?.length) {
        for (const b of vote.blockers.slice(0, 2)) {
          console.log(`             ↳ ${b}`);
        }
      }
    }

    // Collect all rationale text
    const allRationale = result.votes.map(v => v.rationale ?? "").join(" ");

    // VC language leakage check
    console.log("\n── VC LANGUAGE LEAKAGE CHECK ───────────────────────────────────");
    let leakCount = 0;
    for (const pattern of VC_LEAK_PATTERNS) {
      const match = allRationale.match(pattern);
      if (match) {
        console.log(`  ⚠️  LEAK: "${match[0]}" detected in rationale`);
        leakCount++;
      }
    }
    if (leakCount === 0) {
      console.log("  ✅ No VC language leakage detected");
    } else {
      console.log(`  ❌ ${leakCount} VC language leaks found`);
    }

    // Infrastructure language presence check
    console.log("\n── INFRASTRUCTURE LANGUAGE PRESENCE CHECK ──────────────────────");
    let infraFound = 0;
    for (const { label, pattern } of INFRA_REQUIRED_PATTERNS) {
      if (pattern.test(allRationale)) {
        console.log(`  ✅ ${label} language present`);
        infraFound++;
      } else {
        console.log(`  ⚠️  ${label} language NOT found in rationales`);
      }
    }
    console.log(`\n  ${infraFound}/${INFRA_REQUIRED_PATTERNS.length} infrastructure concepts present in rationales`);

    // Decision integrity
    if (result.decisionIntegrity) {
      const di = result.decisionIntegrity;
      console.log("\n── DECISION INTEGRITY ──────────────────────────────────────────");
      console.log(`  Risk Level:    ${di.riskLevel}`);
      console.log(`  Agents Run:    ${di.agentsRun}`);
      console.log(`  Disagreements: ${di.disagreementCount}`);
      console.log(`  Veto:          ${di.vetoTriggered ? di.vetoReason : "None"}`);
      if (di.challengesRaised?.length) {
        console.log("  Challenges:");
        for (const c of di.challengesRaised) {
          console.log(`    ↳ [${c.agentId}] ${c.objection}`);
        }
      }
    }

    // Summary
    console.log("\n═══════════════════════════════════════════════════════════════");
    const pass = leakCount === 0 && infraFound >= 4;
    console.log(`  DRY RUN ${pass ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`  Verdict: ${result.verdict} | VC Leaks: ${leakCount} | Infra Concepts: ${infraFound}/6`);
    console.log("═══════════════════════════════════════════════════════════════\n");

    process.exit(pass ? 0 : 1);

  } catch (err) {
    console.error("DRY RUN FAILED WITH ERROR:", err);
    process.exit(1);
  }
}

main();
