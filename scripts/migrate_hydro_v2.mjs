/**
 * Hydro Decision Twin v2 Migration Script
 * - Adds new columns to hydro_scenarios
 * - Clears and reseeds all hydro tables with revised KWD 3M strategy
 * - Removes all obsolete 10-company / KWD 60K references
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ── 1. Add missing columns to hydro_scenarios ──────────────────────────────
const alterCols = [
  "ADD COLUMN IF NOT EXISTS scenarioName VARCHAR(200)",
  "ADD COLUMN IF NOT EXISTS acquisitionPriceKwd DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS warbaFinancingKwd DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS npvKwd DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS facilityApprovedKwd DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS facilityDrawnKwd DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS facilityUndrawnKwd DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS acquisitionAllocationKwd DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS workingCapitalKwd DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS cashY1 DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS cashY2 DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS cashY3 DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS cashY4 DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS cashY5 DECIMAL(12,3)",
  "ADD COLUMN IF NOT EXISTS caymanTreatment VARCHAR(100)",
];

for (const col of alterCols) {
  try {
    await conn.execute(`ALTER TABLE hydro_scenarios ${col}`);
    console.log(`✓ ${col}`);
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME") {
      console.log(`  (already exists) ${col}`);
    } else {
      throw e;
    }
  }
}

// ── 2. Clear existing data ──────────────────────────────────────────────────
await conn.execute("DELETE FROM hydro_scenarios");
await conn.execute("DELETE FROM hydro_evidence");
await conn.execute("DELETE FROM hydro_company_slots");
console.log("✓ Cleared existing hydro data");

// ── 3. Seed revised scenarios ───────────────────────────────────────────────
// Financial model: KWD 3M staged facility, 4-6 companies, 3 phases
// All figures are management assumptions pending due diligence
// Reconciliation: opening cash + inflows - outflows = closing cash

const now = Date.now();

// Scenario 1: Management Case (KWD 2.3M Cayman, 18 months)
// Phase 1: KWD 1M drawdown, 1 company at ~KWD 700K, months 0-12
// Phase 2: KWD 1M drawdown, 2 companies, months 12-24
// Phase 3: KWD 1M drawdown, 2 companies, months 24-36
// Revenue: consolidated from acquired companies (management assumption)
// EBITDA margin: ~25% (management assumption, pending target due diligence)
// Finance cost: 5.5% p.a. on drawn balance (subject to Warba terms)
// Principal: 5-year amortisation from Y2

const scenarios = [
  {
    scenarioKey: "management",
    label: "Management Case — KWD 2.3M Cayman (18 months)",
    scenarioName: "Management Case",
    caymanAmountKwd: "2300.000",
    caymanTimingMonths: 18,
    caymanTreatment: "shareholder_equity",
    // Facility
    facilityApprovedKwd: "3000.000",
    facilityDrawnKwd: "1000.000",   // Phase 1 only at start
    facilityUndrawnKwd: "2000.000",
    acquisitionAllocationKwd: "2400.000",
    workingCapitalKwd: "400.000",
    warbaFinancingKwd: "3000.000",
    acquisitionPriceKwd: "700.000", // indicative first acquisition
    // Revenue (KWD '000): consolidated from acquired companies
    // Y1: 1 company acquired mid-year, ~6 months revenue
    // Y2: 2 more companies added, full year of Y1 company
    // Y3: 2 more companies, full portfolio
    revenueY1: "350.000",   // 6 months of ~KWD 700K company
    revenueY2: "1800.000",  // 3 companies full year
    revenueY3: "3600.000",  // 5 companies full year
    revenueY4: "4000.000",  // optimisation + automation
    revenueY5: "4500.000",  // steady state
    // EBITDA (management assumption, ~25% margin)
    ebitdaY1: "-180.000",   // Y1: integration costs exceed revenue
    ebitdaY2: "270.000",    // Y2: 15% margin (integration drag)
    ebitdaY3: "720.000",    // Y3: 20% margin
    ebitdaY4: "900.000",    // Y4: 22.5% margin
    ebitdaY5: "1080.000",   // Y5: 24% margin
    // Senior debt (KWD '000): drawn balance after principal
    seniorDebtY1: "1000.000",
    seniorDebtY2: "1900.000",  // +KWD 1M Phase 2 drawdown
    seniorDebtY3: "2700.000",  // +KWD 1M Phase 3 drawdown, -KWD 200K principal
    seniorDebtY4: "2300.000",  // -KWD 400K principal
    seniorDebtY5: "1800.000",  // -KWD 500K principal
    // DSCR: EBITDA / (interest + principal)
    // Y1: negative EBITDA, grace period applies per facility terms
    dscrY1: "0.00",
    dscrY2: "0.82",  // below 1.25 covenant — Phase 2 drawdown conditional
    dscrY3: "1.28",  // above 1.25 covenant floor
    dscrY4: "1.65",
    dscrY5: "2.10",
    // Cash (KWD '000): opening KWD 166K + Cayman + drawdowns - acquisitions - opex - finance
    cashY1: "166.000",   // pre-Cayman: existing cash only
    cashY2: "416.000",   // Cayman arrives month 18 (Y2)
    cashY3: "580.000",
    cashY4: "720.000",
    cashY5: "890.000",
    npvKwd: "1850.000",  // management estimate, not audited
    twinVerdict: "PROCEED_TO_DUE_DILIGENCE",
    isActive: 1,
  },
  {
    scenarioKey: "conservative",
    label: "Conservative Case — KWD 1M Cayman (18 months)",
    scenarioName: "Conservative Case",
    caymanAmountKwd: "1000.000",
    caymanTimingMonths: 18,
    caymanTreatment: "shareholder_equity",
    facilityApprovedKwd: "3000.000",
    facilityDrawnKwd: "1000.000",
    facilityUndrawnKwd: "2000.000",
    acquisitionAllocationKwd: "2400.000",
    workingCapitalKwd: "400.000",
    warbaFinancingKwd: "3000.000",
    acquisitionPriceKwd: "700.000",
    revenueY1: "350.000",
    revenueY2: "1600.000",
    revenueY3: "3000.000",
    revenueY4: "3400.000",
    revenueY5: "3800.000",
    ebitdaY1: "-200.000",
    ebitdaY2: "160.000",
    ebitdaY3: "540.000",
    ebitdaY4: "680.000",
    ebitdaY5: "836.000",
    seniorDebtY1: "1000.000",
    seniorDebtY2: "1900.000",
    seniorDebtY3: "2600.000",
    seniorDebtY4: "2200.000",
    seniorDebtY5: "1750.000",
    dscrY1: "0.00",
    dscrY2: "0.60",  // below covenant — Phase 2 drawdown at risk
    dscrY3: "1.05",  // below 1.25 — Phase 3 drawdown blocked
    dscrY4: "1.35",
    dscrY5: "1.70",
    cashY1: "166.000",
    cashY2: "266.000",
    cashY3: "350.000",
    cashY4: "480.000",
    cashY5: "620.000",
    npvKwd: "820.000",
    twinVerdict: "APPROVE_PHASE_1_ONLY",
    isActive: 0,
  },
  {
    scenarioKey: "delayed_zero",
    label: "Delayed / Zero Cayman Proceeds",
    scenarioName: "Delayed / Zero Cayman",
    caymanAmountKwd: "0.000",
    caymanTimingMonths: 24,
    caymanTreatment: "not_applicable",
    facilityApprovedKwd: "3000.000",
    facilityDrawnKwd: "1000.000",
    facilityUndrawnKwd: "2000.000",
    acquisitionAllocationKwd: "2400.000",
    workingCapitalKwd: "400.000",
    warbaFinancingKwd: "3000.000",
    acquisitionPriceKwd: "700.000",
    revenueY1: "350.000",
    revenueY2: "1400.000",
    revenueY3: "2400.000",
    revenueY4: "2800.000",
    revenueY5: "3200.000",
    ebitdaY1: "-220.000",
    ebitdaY2: "70.000",
    ebitdaY3: "360.000",
    ebitdaY4: "560.000",
    ebitdaY5: "704.000",
    seniorDebtY1: "1000.000",
    seniorDebtY2: "1800.000",
    seniorDebtY3: "2400.000",
    seniorDebtY4: "2000.000",
    seniorDebtY5: "1600.000",
    dscrY1: "0.00",
    dscrY2: "0.30",  // critically below covenant
    dscrY3: "0.80",  // below covenant — Phase 3 blocked
    dscrY4: "1.15",  // below 1.25 covenant
    dscrY5: "1.45",
    cashY1: "166.000",
    cashY2: "86.000",   // below KWD 150K minimum liquidity reserve
    cashY3: "120.000",  // below minimum
    cashY4: "250.000",
    cashY5: "380.000",
    npvKwd: "210.000",
    twinVerdict: "REQUIRE_ADDITIONAL_EQUITY",
    isActive: 0,
  },
];

for (const s of scenarios) {
  await conn.execute(
    `INSERT INTO hydro_scenarios (
      scenarioKey, label, scenarioName, caymanAmountKwd, caymanTimingMonths, caymanTreatment,
      facilityApprovedKwd, facilityDrawnKwd, facilityUndrawnKwd,
      acquisitionAllocationKwd, workingCapitalKwd, warbaFinancingKwd, acquisitionPriceKwd,
      revenueY1, revenueY2, revenueY3, revenueY4, revenueY5,
      ebitdaY1, ebitdaY2, ebitdaY3, ebitdaY4, ebitdaY5,
      seniorDebtY1, seniorDebtY2, seniorDebtY3, seniorDebtY4, seniorDebtY5,
      dscrY1, dscrY2, dscrY3, dscrY4, dscrY5,
      cashY1, cashY2, cashY3, cashY4, cashY5,
      npvKwd, twinVerdict, isActive, createdAt, updatedAt
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      s.scenarioKey, s.label, s.scenarioName, s.caymanAmountKwd, s.caymanTimingMonths, s.caymanTreatment,
      s.facilityApprovedKwd, s.facilityDrawnKwd, s.facilityUndrawnKwd,
      s.acquisitionAllocationKwd, s.workingCapitalKwd, s.warbaFinancingKwd, s.acquisitionPriceKwd,
      s.revenueY1, s.revenueY2, s.revenueY3, s.revenueY4, s.revenueY5,
      s.ebitdaY1, s.ebitdaY2, s.ebitdaY3, s.ebitdaY4, s.ebitdaY5,
      s.seniorDebtY1, s.seniorDebtY2, s.seniorDebtY3, s.seniorDebtY4, s.seniorDebtY5,
      s.dscrY1, s.dscrY2, s.dscrY3, s.dscrY4, s.dscrY5,
      s.cashY1, s.cashY2, s.cashY3, s.cashY4, s.cashY5,
      s.npvKwd, s.twinVerdict, s.isActive, now, now,
    ]
  );
  console.log(`✓ Seeded scenario: ${s.label}`);
}

// ── 4. Seed evidence register (revised 18 items) ────────────────────────────
const evidenceItems = [
  // Hydro company documents
  { itemKey: "hydro_bank_statement", label: "Hydro bank statement — verifying KWD 166,000 cash balance", category: "financial", status: "pending", statusNote: "Required to confirm available liquidity before any drawdown" },
  { itemKey: "hydro_commercial_register", label: "Hydro Commercial Register", category: "legal", status: "pending", statusNote: "Confirms legal existence and registered activities" },
  { itemKey: "hydro_memorandum", label: "Memorandum of Association", category: "legal", status: "pending", statusNote: "Confirms ownership structure and authorised activities" },
  { itemKey: "hydro_registered_capital", label: "Registered capital documentation", category: "financial", status: "pending", statusNote: "Confirms paid-up and available capital" },
  { itemKey: "hydro_paid_up_capital", label: "Evidence of paid-up and available capital", category: "financial", status: "pending", statusNote: "Confirms capital is not encumbered or pledged" },
  // Cayman proceeds
  { itemKey: "cayman_liquidator_estimate", label: "Cayman liquidator's formal estimate of distributions", category: "cayman", status: "pending", statusNote: "Management expects KWD 1M–2.3M over ~18 months. Not guaranteed." },
  { itemKey: "cayman_beneficiary_confirmation", label: "Confirmation of legal beneficiary of Cayman proceeds", category: "cayman", status: "pending", statusNote: "Must confirm whether proceeds belong to Hydro or to the shareholder personally" },
  { itemKey: "cayman_timing_estimate", label: "Expected Cayman liquidation timing", category: "cayman", status: "assumption", statusNote: "Management assumption: 18 months. Subject to liquidator's schedule." },
  // Target company documents (per acquisition)
  { itemKey: "target_financial_statements", label: "Target-company financial statements (3 years minimum)", category: "target_due_diligence", status: "pending", statusNote: "Required for each acquisition. None received." },
  { itemKey: "target_bank_statements", label: "Target-company bank statements", category: "target_due_diligence", status: "pending", statusNote: "Required for each acquisition. None received." },
  { itemKey: "target_receivables_payables", label: "Receivables and payables aging schedules", category: "target_due_diligence", status: "pending", statusNote: "Required for each acquisition. None received." },
  { itemKey: "target_existing_liabilities", label: "Existing liabilities schedule", category: "target_due_diligence", status: "pending", statusNote: "Required for each acquisition. None received." },
  { itemKey: "target_tax_legal_employee", label: "Tax, legal and employee obligations", category: "target_due_diligence", status: "pending", statusNote: "Required for each acquisition. None received." },
  { itemKey: "target_purchase_price", label: "Purchase price evidence and valuation", category: "target_due_diligence", status: "pending", statusNote: "Indicative range KWD 300K–750K per company. No targets identified yet." },
  // Facility documents
  { itemKey: "warba_facility_terms", label: "Warba Bank facility terms and conditions", category: "facility", status: "pending", statusNote: "Subject to Warba's independent credit and Sharia approvals" },
  { itemKey: "sharia_approval", label: "Sharia approval for facility structure", category: "facility", status: "pending", statusNote: "Required before drawdown. Not yet obtained." },
  { itemKey: "security_documentation", label: "Security documentation (charges, pledges, guarantees)", category: "facility", status: "pending", statusNote: "Structure subject to Warba's requirements" },
  { itemKey: "minimum_liquidity_reserve", label: "Minimum liquidity reserve — KWD 150,000", category: "financial", status: "assumption", statusNote: "Management assumption. Hydro must maintain KWD 150K minimum at all times." },
];

let sortOrder = 0;
for (const ev of evidenceItems) {
  await conn.execute(
    `INSERT INTO hydro_evidence (itemKey, label, currentInput, status, statusNote, category, isEditable, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, NULL, ?, ?, ?, 1, ?, ?, ?)`,
    [ev.itemKey, ev.label, ev.status, ev.statusNote, ev.category, sortOrder++, now, now]
  );
  console.log(`✓ Evidence: ${ev.label.substring(0, 60)}`);
}

// ── 5. Seed 6 empty company slots ──────────────────────────────────────────
for (let i = 1; i <= 6; i++) {
  await conn.execute(
    `INSERT INTO hydro_company_slots (slotNumber, status, companyName, phase, createdAt, updatedAt)
     VALUES (?, 'empty', NULL, ?, ?, ?)`,
    [i, i <= 1 ? 1 : i <= 3 ? 2 : 3, now, now]
  );
  console.log(`✓ Company slot ${i} (Phase ${i <= 1 ? 1 : i <= 3 ? 2 : 3})`);
}

await conn.end();
console.log("\n✅ Hydro v2 migration complete. All obsolete data removed.");
