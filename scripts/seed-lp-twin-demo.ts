/**
 * LP Twin v1 — Demo Fund Seed Script
 *
 * Creates the Atlas Growth Fund I demo fund for the founding customer rehearsal.
 * This is a SYNTHETIC DEMONSTRATION FUND — not a real fund.
 *
 * Usage: npx tsx scripts/seed-lp-twin-demo.ts
 */
import { getDb } from "../server/db";
import { lpTwinFunds } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const DEMO_FUND = {
  fundName: "Atlas Growth Fund I",
  gpName: "Synthetic Demonstration Fund — Not a Real GP",
  strategy: "growth_equity",
  assetClass: "Private Equity",
  geography: "North America",
  domicile: "Cayman Islands",
  currency: "USD",
  targetFundSizeM: "150.00",
  economicsJson: JSON.stringify({
    managementFeePct: 2.0,
    carryPct: 20.0,
    hurdleRatePct: 8.0,
    preferredReturn: 8.0,
    catchUp: 100,
    clawback: true,
    managementFeeBase: "committed_capital",
    managementFeeStep: "invested_capital_at_investment_period_end",
  }),
  investmentPropositionJson: JSON.stringify({
    strategy: "Growth equity investments in B2B SaaS companies in North America",
    targetCompanyRevenue: "$5M–$30M ARR",
    targetOwnership: "20–35%",
    checkSize: "$10M–$25M",
    portfolioSize: "12–15 companies",
    investmentPeriod: "5 years",
    fundLife: "10 years + 2 extensions",
    edge: [
      "Proprietary deal flow from 200+ operator network",
      "Value-add platform with dedicated portfolio support team",
      "Deep sector expertise in vertical SaaS and infrastructure software",
    ],
  }),
  riskLiquidityJson: JSON.stringify({
    liquidityTerms: "10-year closed-end fund with 2-year extension options",
    keyPersonProvision: true,
    noFaultDivest: true,
    lpAdvisoryCommittee: true,
    coInvestmentRights: true,
    transferRestrictions: "GP consent required",
    riskFactors: [
      "Concentration risk in B2B SaaS sector",
      "Illiquid investment horizon",
      "Dependence on key investment professionals",
    ],
  }),
  trackRecordJson: JSON.stringify({
    trackRecordYrs: 8,
    priorFundIRR: 22.0,
    priorFundMOIC: 2.4,
    vintageYear: 2018,
    priorFundSize: 85,
    priorFundStatus: "fully_invested",
    priorFundRealisations: "3 full exits, 2 partial exits",
    dpiToDate: 0.8,
    tvpiToDate: 2.1,
    benchmarkComparison: "Top quartile vs Cambridge Associates US PE benchmark",
  }),
  institutionalRequirementsJson: JSON.stringify({
    minimumTicket: 5000000,
    maximumTicket: 25000000,
    ilpaCompliant: true,
    auditedFinancials: true,
    quarterlyReporting: true,
    annualMeeting: true,
    lpPortal: true,
    esgPolicy: true,
    diversityPolicy: true,
    amlKycProcess: true,
    fatcaCompliant: true,
    acceptedInvestorTypes: [
      "Sovereign Wealth Fund",
      "Public Pension Fund",
      "Corporate Pension Fund",
      "Insurance Company",
      "University Endowment",
      "Single Family Office",
      "Multi-Family Office",
    ],
    excludedJurisdictions: [],
    shariaCompliant: false,
    esgScreening: "Negative screening only",
  }),
  evidenceStatus: "complete" as const,
  version: 1,
};

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database connection failed");
    process.exit(1);
  }

  // Check if demo fund already exists for org 1
  const existing = await db
    .select()
    .from(lpTwinFunds)
    .where(eq(lpTwinFunds.fundName, DEMO_FUND.fundName))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Demo fund already exists: ID ${existing[0].id}`);
    console.log("To recreate, delete the existing fund first.");
    process.exit(0);
  }

  // Seed for org 1 (AgenThinkMesh founding org)
  const ORG_ID = 1;
  const USER_ID = 1; // Owner

  const [result] = await db.insert(lpTwinFunds).values({
    orgId: ORG_ID,
    createdByUserId: USER_ID,
    updatedByUserId: USER_ID,
    ...DEMO_FUND,
  }).$returningId();

  console.log(`✓ Demo fund created: ID ${result.id}`);
  console.log(`  Fund: ${DEMO_FUND.fundName}`);
  console.log(`  GP: ${DEMO_FUND.gpName}`);
  console.log(`  Strategy: ${DEMO_FUND.strategy}`);
  console.log(`  Target: $${DEMO_FUND.targetFundSizeM}M`);
  console.log(`  Evidence: ${DEMO_FUND.evidenceStatus}`);
  console.log("");
  console.log("⚠️  SYNTHETIC DEMONSTRATION FUND — Not a real fund.");
  console.log("   All data is fabricated for demonstration purposes only.");
  console.log("");
  console.log("Next step: Navigate to /captwin/lp-twin to see the demo fund.");

  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});

