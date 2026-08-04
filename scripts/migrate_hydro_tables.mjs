import mysql from "mysql2/promise";
import { config } from "dotenv";
config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

const tables = [
  `CREATE TABLE IF NOT EXISTS hydro_scenarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scenarioKey VARCHAR(50) NOT NULL,
    label VARCHAR(200) NOT NULL,
    caymanAmountKwd DECIMAL(12,3) NOT NULL,
    caymanTimingMonths INT NOT NULL DEFAULT 18,
    revenueY1 DECIMAL(12,3), revenueY2 DECIMAL(12,3), revenueY3 DECIMAL(12,3), revenueY4 DECIMAL(12,3), revenueY5 DECIMAL(12,3),
    ebitdaY1 DECIMAL(12,3), ebitdaY2 DECIMAL(12,3), ebitdaY3 DECIMAL(12,3), ebitdaY4 DECIMAL(12,3), ebitdaY5 DECIMAL(12,3),
    seniorDebtY1 DECIMAL(12,3), seniorDebtY2 DECIMAL(12,3), seniorDebtY3 DECIMAL(12,3), seniorDebtY4 DECIMAL(12,3), seniorDebtY5 DECIMAL(12,3),
    dscrY1 DECIMAL(6,2), dscrY2 DECIMAL(6,2), dscrY3 DECIMAL(6,2), dscrY4 DECIMAL(6,2), dscrY5 DECIMAL(6,2),
    twinVerdict VARCHAR(100) NOT NULL,
    isActive TINYINT DEFAULT 0,
    createdAt BIGINT NOT NULL,
    updatedAt BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS hydro_evidence (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itemKey VARCHAR(100) NOT NULL UNIQUE,
    label VARCHAR(300) NOT NULL,
    currentInput VARCHAR(500),
    status ENUM('verified','pending','assumption','outstanding') NOT NULL DEFAULT 'pending',
    statusNote VARCHAR(500),
    category VARCHAR(100) NOT NULL DEFAULT 'financial',
    isEditable TINYINT DEFAULT 1,
    sortOrder INT DEFAULT 0,
    createdAt BIGINT NOT NULL,
    updatedAt BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS hydro_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT,
    userName VARCHAR(200),
    actionType VARCHAR(100) NOT NULL,
    entityType VARCHAR(100),
    entityId VARCHAR(100),
    oldValue TEXT,
    newValue TEXT,
    reason TEXT,
    ipAddress VARCHAR(50),
    createdAt BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS hydro_stress_params (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sessionId VARCHAR(100) NOT NULL,
    userId INT,
    caymanAmountKwd DECIMAL(12,3) DEFAULT 1000,
    caymanDelayMonths INT DEFAULT 0,
    revenueGrowthDelta DECIMAL(6,3) DEFAULT 0,
    grossMarginDelta DECIMAL(6,3) DEFAULT 0,
    automationSavingsPct DECIMAL(6,3) DEFAULT 100,
    financeRatePct DECIMAL(6,3) DEFAULT 5.5,
    gracePeriodMonths INT DEFAULT 12,
    acqTimingDeltaMonths INT DEFAULT 0,
    acqPriceDeltaPct DECIMAL(6,3) DEFAULT 0,
    customerConcentrationShock TINYINT DEFAULT 0,
    receivablesDelayDays INT DEFAULT 0,
    gccDisruption TINYINT DEFAULT 0,
    stressCase VARCHAR(50) DEFAULT 'custom',
    createdAt BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS hydro_company_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slotNumber INT NOT NULL UNIQUE,
    status ENUM('empty','target_identified','under_diligence','approved','acquired','active','exited') DEFAULT 'empty',
    companyName VARCHAR(300),
    sector VARCHAR(200),
    acquisitionPriceKwd DECIMAL(12,3),
    revenueKwd DECIMAL(12,3),
    ebitdaKwd DECIMAL(12,3),
    cashConversionPct DECIMAL(6,2),
    receivablesDays INT,
    customerConcentrationPct DECIMAL(6,2),
    totalDebtKwd DECIMAL(12,3),
    automationPlan TEXT,
    automationSavingsActualKwd DECIMAL(12,3),
    automationSavingsForecastKwd DECIMAL(12,3),
    riskAlerts TEXT,
    phase INT,
    acquisitionDate BIGINT,
    notes TEXT,
    createdAt BIGINT NOT NULL,
    updatedAt BIGINT NOT NULL
  )`
];

const now = Date.now();

for (const sql of tables) {
  try {
    await db.execute(sql);
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    console.log(`✅ ${tableName} — created or already exists`);
  } catch (e) {
    console.error(`❌ Error:`, e.message);
  }
}

// Seed the 3 Hydro scenarios
const [existing] = await db.execute("SELECT COUNT(*) as cnt FROM hydro_scenarios");
if (existing[0].cnt === 0) {
  const scenarios = [
    {
      scenarioKey: "delayed_zero",
      label: "Delayed or Zero Cayman Proceeds",
      caymanAmountKwd: 0,
      caymanTimingMonths: 999,
      revenueY1: 300, revenueY2: 610, revenueY3: 1030, revenueY4: 1680, revenueY5: 2380,
      ebitdaY1: -30, ebitdaY2: 34, ebitdaY3: 170, ebitdaY4: 420, ebitdaY5: 710,
      seniorDebtY1: 500, seniorDebtY2: 750, seniorDebtY3: 850, seniorDebtY4: 650, seniorDebtY5: 350,
      dscrY1: 0.00, dscrY2: 0.40, dscrY3: 1.06, dscrY4: 1.42, dscrY5: 1.78,
      twinVerdict: "PAUSE AFTER PHASE 1",
      isActive: 0,
    },
    {
      scenarioKey: "conservative_1m",
      label: "Conservative Cayman Case — KWD 1 Million",
      caymanAmountKwd: 1000,
      caymanTimingMonths: 18,
      revenueY1: 300, revenueY2: 720, revenueY3: 1450, revenueY4: 2300, revenueY5: 3500,
      ebitdaY1: -30, ebitdaY2: 96, ebitdaY3: 368, ebitdaY4: 815, ebitdaY5: 1475,
      seniorDebtY1: 500, seniorDebtY2: 900, seniorDebtY3: 1050, seniorDebtY4: 700, seniorDebtY5: 250,
      dscrY1: 0.00, dscrY2: 0.72, dscrY3: 1.36, dscrY4: 1.82, dscrY5: 2.48,
      twinVerdict: "PROCEED IN STAGES",
      isActive: 1,
    },
    {
      scenarioKey: "management_23m",
      label: "Management Cayman Case — KWD 2.3 Million",
      caymanAmountKwd: 2300,
      caymanTimingMonths: 18,
      revenueY1: 300, revenueY2: 760, revenueY3: 1580, revenueY4: 2600, revenueY5: 4050,
      ebitdaY1: -30, ebitdaY2: 118, ebitdaY3: 445, ebitdaY4: 1010, ebitdaY5: 1810,
      seniorDebtY1: 500, seniorDebtY2: 750, seniorDebtY3: 700, seniorDebtY4: 300, seniorDebtY5: 0,
      dscrY1: 0.00, dscrY2: 0.90, dscrY3: 1.64, dscrY4: 2.34, dscrY5: 3.20,
      twinVerdict: "ACCELERATE WITH GATES",
      isActive: 0,
    },
  ];
  for (const s of scenarios) {
    await db.execute(
      `INSERT INTO hydro_scenarios (scenarioKey, label, caymanAmountKwd, caymanTimingMonths,
        revenueY1, revenueY2, revenueY3, revenueY4, revenueY5,
        ebitdaY1, ebitdaY2, ebitdaY3, ebitdaY4, ebitdaY5,
        seniorDebtY1, seniorDebtY2, seniorDebtY3, seniorDebtY4, seniorDebtY5,
        dscrY1, dscrY2, dscrY3, dscrY4, dscrY5,
        twinVerdict, isActive, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [s.scenarioKey, s.label, s.caymanAmountKwd, s.caymanTimingMonths,
       s.revenueY1, s.revenueY2, s.revenueY3, s.revenueY4, s.revenueY5,
       s.ebitdaY1, s.ebitdaY2, s.ebitdaY3, s.ebitdaY4, s.ebitdaY5,
       s.seniorDebtY1, s.seniorDebtY2, s.seniorDebtY3, s.seniorDebtY4, s.seniorDebtY5,
       s.dscrY1, s.dscrY2, s.dscrY3, s.dscrY4, s.dscrY5,
       s.twinVerdict, s.isActive, now, now]
    );
    console.log(`✅ Seeded scenario: ${s.label}`);
  }
}

// Seed evidence register
const [existingEvidence] = await db.execute("SELECT COUNT(*) as cnt FROM hydro_evidence");
if (existingEvidence[0].cnt === 0) {
  const evidenceItems = [
    { itemKey: "hydro_cash_balance", label: "Hydro cash balance", currentInput: "KWD 166,000", status: "pending", statusNote: "Bank statement required", category: "financial", sortOrder: 1 },
    { itemKey: "cayman_distributions", label: "Cayman distributions", currentInput: "KWD 1.0m–2.3m (scenario-dependent)", status: "pending", statusNote: "Liquidator letter required. Not guaranteed, committed or currently receivable.", category: "financial", sortOrder: 2 },
    { itemKey: "registered_capital", label: "Registered capital", currentInput: "KWD 4,000,000", status: "pending", statusNote: "Paid-up amount to be confirmed separately. Do not conflate with available cash.", category: "financial", sortOrder: 3 },
    { itemKey: "acquisition_program", label: "Acquisition program", currentInput: "10 SMEs over 3 years", status: "assumption", statusNote: "No target approved yet. Preliminary schedule only.", category: "strategy", sortOrder: 4 },
    { itemKey: "bank_facility", label: "Proposed bank facility", currentInput: "KWD 2,000,000 maximum staged framework", status: "assumption", statusNote: "Initial tranche KWD 500,000–750,000. Subject to Warba structuring and credit approval.", category: "financial", sortOrder: 5 },
    { itemKey: "acquisition_pool_max", label: "Maximum acquisition pool", currentInput: "KWD 600,000", status: "assumption", statusNote: "Illustrative management assumption pending validation.", category: "financial", sortOrder: 6 },
    { itemKey: "min_liquidity_covenant", label: "Minimum liquidity covenant", currentInput: "KWD 150,000 proposed", status: "assumption", statusNote: "Subject to Warba credit conditions.", category: "covenant", sortOrder: 7 },
    { itemKey: "dscr_covenant", label: "DSCR covenant (post grace period)", currentInput: "1.25× minimum proposed", status: "assumption", statusNote: "Subject to Warba credit conditions. Grace period TBC.", category: "covenant", sortOrder: 8 },
    { itemKey: "finance_rate", label: "Finance / profit rate assumption", currentInput: "5.5% p.a. (illustrative)", status: "assumption", statusNote: "Requires professional confirmation. Islamic finance profit rate to be agreed with Warba.", category: "financial", sortOrder: 9 },
    { itemKey: "depreciation_tax", label: "Depreciation and tax assumptions", currentInput: "Not provided", status: "outstanding", statusNote: "Required for accurate EBITDA-to-cash bridge. Pending accountant confirmation.", category: "financial", sortOrder: 10 },
    { itemKey: "target_company_performance", label: "Acquisition target financial performance", currentInput: "Not provided", status: "outstanding", statusNote: "3 years of financial statements, bank statements and liability schedules required per drawdown gate.", category: "diligence", sortOrder: 11 },
    { itemKey: "20x_objective", label: "20× operational capacity objective", currentInput: "Long-term indicative ambition", status: "assumption", statusNote: "Not a guaranteed financial forecast, repayment outcome or investor return.", category: "strategy", sortOrder: 12 },
  ];
  for (const e of evidenceItems) {
    await db.execute(
      `INSERT INTO hydro_evidence (itemKey, label, currentInput, status, statusNote, category, isEditable, sortOrder, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,1,?,?,?)`,
      [e.itemKey, e.label, e.currentInput, e.status, e.statusNote, e.category, e.sortOrder, now, now]
    );
  }
  console.log(`✅ Seeded ${evidenceItems.length} evidence items`);
}

// Seed 10 empty company slots
const [existingSlots] = await db.execute("SELECT COUNT(*) as cnt FROM hydro_company_slots");
if (existingSlots[0].cnt === 0) {
  for (let i = 1; i <= 10; i++) {
    await db.execute(
      `INSERT INTO hydro_company_slots (slotNumber, status, createdAt, updatedAt) VALUES (?,?,?,?)`,
      [i, "empty", now, now]
    );
  }
  console.log(`✅ Seeded 10 empty company slots`);
}

await db.end();
console.log("✅ Hydro migration complete");
