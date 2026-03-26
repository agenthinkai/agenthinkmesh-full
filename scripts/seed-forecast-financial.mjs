/**
 * seed-forecast-financial.mjs
 * Seeds 8 GCC enterprise ForecastMesh scenarios with full financial history.
 * Uses INSERT ... ON DUPLICATE KEY UPDATE to be idempotent.
 */

import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");

const GCC_FORECAST_SCENARIOS = [
  {
    id: "demo-001",
    title: "Al Saqr Trading and Contracting Group",
    forecastType: "budget_risk",
    question: "Will Al Saqr Trading achieve its KWD 48.5M revenue target for FY2024?",
    businessArea: "Logistics",
    geography: "Kuwait",
    currency: "KWD",
    baseRevenue: "48500000.00",
    ebitdaMargin: "0.1400",
    growthRate: "0.1200",
    confidenceScore: "0.78",
    currentProbability: "0.8200",
    status: "on_track",
    description: "Kuwait-based contracting group with MOW framework contracts. Revenue growth driven by KDP 2035 infrastructure spend. Primary risk: government payment cycle extension to 220 days.",
    assumptions: JSON.stringify({ oilPrice: 82, fx: "KWD/USD peg at 0.307", headcountGrowth: 8, capex: 3200000 }),
    historyEntries: [
      { month: "2023-01", revenue: "3200000.00", ebitda: "416000.00", probability: "0.8200", sortOrder: 0 },
      { month: "2023-02", revenue: "3450000.00", ebitda: "448500.00", probability: "0.8000", sortOrder: 1 },
      { month: "2023-03", revenue: "3800000.00", ebitda: "494000.00", probability: "0.8400", sortOrder: 2 },
      { month: "2023-04", revenue: "3600000.00", ebitda: "468000.00", probability: "0.7900", sortOrder: 3 },
      { month: "2023-05", revenue: "4100000.00", ebitda: "533000.00", probability: "0.8500", sortOrder: 4 },
      { month: "2023-06", revenue: "3900000.00", ebitda: "507000.00", probability: "0.8100", sortOrder: 5 },
      { month: "2023-07", revenue: "4200000.00", ebitda: "546000.00", probability: "0.8600", sortOrder: 6 },
      { month: "2023-08", revenue: "3750000.00", ebitda: "487500.00", probability: "0.7800", sortOrder: 7 },
      { month: "2023-09", revenue: "4400000.00", ebitda: "572000.00", probability: "0.8700", sortOrder: 8 },
      { month: "2023-10", revenue: "4600000.00", ebitda: "598000.00", probability: "0.8800", sortOrder: 9 },
      { month: "2023-11", revenue: "4800000.00", ebitda: "624000.00", probability: "0.8900", sortOrder: 10 },
      { month: "2023-12", revenue: "5200000.00", ebitda: "676000.00", probability: "0.9100", sortOrder: 11 },
    ],
  },
  {
    id: "demo-002",
    title: "Rawabi Medical Centers Group",
    forecastType: "target_probability",
    question: "Will Rawabi Medical Centers achieve SAR 892M revenue and 19% EBITDA margin by end of FY2024?",
    businessArea: "Healthcare",
    geography: "KSA",
    currency: "SAR",
    baseRevenue: "892000000.00",
    ebitdaMargin: "0.1900",
    growthRate: "0.1800",
    confidenceScore: "0.82",
    currentProbability: "0.8400",
    status: "on_track",
    description: "Riyadh-based outpatient clinic network. NHIF panel expansion from 8 to 14 providers is the primary growth driver. Risk: NHIF reimbursement rate review in Q3 2024.",
    assumptions: JSON.stringify({ oilPrice: 82, fx: "SAR/USD peg at 3.75", headcountGrowth: 12, capex: 68000000 }),
    historyEntries: [
      { month: "2023-01", revenue: "52000000.00", ebitda: "9360000.00", probability: "0.8400", sortOrder: 0 },
      { month: "2023-02", revenue: "54000000.00", ebitda: "9720000.00", probability: "0.8300", sortOrder: 1 },
      { month: "2023-03", revenue: "58000000.00", ebitda: "10440000.00", probability: "0.8600", sortOrder: 2 },
      { month: "2023-04", revenue: "61000000.00", ebitda: "10980000.00", probability: "0.8500", sortOrder: 3 },
      { month: "2023-05", revenue: "64000000.00", ebitda: "11520000.00", probability: "0.8700", sortOrder: 4 },
      { month: "2023-06", revenue: "68000000.00", ebitda: "12240000.00", probability: "0.8800", sortOrder: 5 },
      { month: "2023-07", revenue: "66000000.00", ebitda: "11880000.00", probability: "0.8400", sortOrder: 6 },
      { month: "2023-08", revenue: "72000000.00", ebitda: "12960000.00", probability: "0.8900", sortOrder: 7 },
      { month: "2023-09", revenue: "75000000.00", ebitda: "13500000.00", probability: "0.9000", sortOrder: 8 },
      { month: "2023-10", revenue: "78000000.00", ebitda: "14040000.00", probability: "0.9100", sortOrder: 9 },
      { month: "2023-11", revenue: "80000000.00", ebitda: "14400000.00", probability: "0.9000", sortOrder: 10 },
      { month: "2023-12", revenue: "84000000.00", ebitda: "15120000.00", probability: "0.9200", sortOrder: 11 },
    ],
  },
  {
    id: "demo-003",
    title: "Khaleeji Cold Chain Logistics",
    forecastType: "deadline_risk",
    question: "Will Khaleeji Cold Chain reach 85% utilization at Abu Dhabi facility by Q2 2024 deadline?",
    businessArea: "Logistics",
    geography: "UAE",
    currency: "AED",
    baseRevenue: "146000000.00",
    ebitdaMargin: "0.2000",
    growthRate: "0.2200",
    confidenceScore: "0.74",
    currentProbability: "0.7500",
    status: "watchlist",
    description: "Jebel Ali-based GDP-compliant pharmaceutical cold chain. Abu Dhabi expansion at 68% utilization below 85% breakeven target. Muscat hub delayed to 2025.",
    assumptions: JSON.stringify({ oilPrice: 82, fx: "AED/USD peg at 3.67", headcountGrowth: 15, capex: 8400000 }),
    historyEntries: [
      { month: "2023-01", revenue: "7200000.00", ebitda: "1296000.00", probability: "0.7600", sortOrder: 0 },
      { month: "2023-02", revenue: "7800000.00", ebitda: "1404000.00", probability: "0.7700", sortOrder: 1 },
      { month: "2023-03", revenue: "8400000.00", ebitda: "1512000.00", probability: "0.7900", sortOrder: 2 },
      { month: "2023-04", revenue: "8800000.00", ebitda: "1584000.00", probability: "0.7800", sortOrder: 3 },
      { month: "2023-05", revenue: "9200000.00", ebitda: "1656000.00", probability: "0.8000", sortOrder: 4 },
      { month: "2023-06", revenue: "9600000.00", ebitda: "1728000.00", probability: "0.8100", sortOrder: 5 },
      { month: "2023-07", revenue: "10200000.00", ebitda: "1836000.00", probability: "0.8200", sortOrder: 6 },
      { month: "2023-08", revenue: "10800000.00", ebitda: "1944000.00", probability: "0.8300", sortOrder: 7 },
      { month: "2023-09", revenue: "11400000.00", ebitda: "2052000.00", probability: "0.8400", sortOrder: 8 },
      { month: "2023-10", revenue: "12000000.00", ebitda: "2160000.00", probability: "0.8500", sortOrder: 9 },
      { month: "2023-11", revenue: "12600000.00", ebitda: "2268000.00", probability: "0.7400", sortOrder: 10 },
      { month: "2023-12", revenue: "13200000.00", ebitda: "2376000.00", probability: "0.7500", sortOrder: 11 },
    ],
  },
  {
    id: "demo-004",
    title: "Tamkin Digital Government Solutions",
    forecastType: "budget_risk",
    question: "Will Tamkin Digital close SAR 68M annual contract target before Q4 2024 budget freeze?",
    businessArea: "GovTech",
    geography: "KSA",
    currency: "SAR",
    baseRevenue: "68000000.00",
    ebitdaMargin: "0.2100",
    growthRate: "0.1700",
    confidenceScore: "0.71",
    currentProbability: "0.7300",
    status: "watchlist",
    description: "Riyadh govtech platform processing 2.4M citizen transactions across 14 ministries. Government payment cycles at 180 days creating SAR 22M working capital gap.",
    assumptions: JSON.stringify({ oilPrice: 82, fx: "SAR/USD peg at 3.75", headcountGrowth: 22, capex: 12000000 }),
    historyEntries: [
      { month: "2023-01", revenue: "3800000.00", ebitda: "722000.00", probability: "0.7200", sortOrder: 0 },
      { month: "2023-02", revenue: "4100000.00", ebitda: "779000.00", probability: "0.7100", sortOrder: 1 },
      { month: "2023-03", revenue: "4400000.00", ebitda: "836000.00", probability: "0.7300", sortOrder: 2 },
      { month: "2023-04", revenue: "4700000.00", ebitda: "893000.00", probability: "0.7400", sortOrder: 3 },
      { month: "2023-05", revenue: "5000000.00", ebitda: "950000.00", probability: "0.7500", sortOrder: 4 },
      { month: "2023-06", revenue: "5400000.00", ebitda: "1026000.00", probability: "0.7600", sortOrder: 5 },
      { month: "2023-07", revenue: "5200000.00", ebitda: "988000.00", probability: "0.7000", sortOrder: 6 },
      { month: "2023-08", revenue: "5600000.00", ebitda: "1064000.00", probability: "0.7200", sortOrder: 7 },
      { month: "2023-09", revenue: "6000000.00", ebitda: "1140000.00", probability: "0.7400", sortOrder: 8 },
      { month: "2023-10", revenue: "6400000.00", ebitda: "1216000.00", probability: "0.7500", sortOrder: 9 },
      { month: "2023-11", revenue: "6800000.00", ebitda: "1292000.00", probability: "0.7100", sortOrder: 10 },
      { month: "2023-12", revenue: "7200000.00", ebitda: "1368000.00", probability: "0.7300", sortOrder: 11 },
    ],
  },
  {
    id: "demo-005",
    title: "Gulf Bridge Telecom Infrastructure",
    forecastType: "target_probability",
    question: "Will Gulf Bridge Telecom achieve 1.6x tenancy ratio and KWD 6.2M revenue target in FY2024?",
    businessArea: "Infrastructure",
    geography: "Kuwait",
    currency: "KWD",
    baseRevenue: "6200000.00",
    ebitdaMargin: "0.6600",
    growthRate: "0.1100",
    confidenceScore: "0.88",
    currentProbability: "0.9400",
    status: "on_track",
    description: "Kuwait passive tower infrastructure with 140 towers leased to Zain, Ooredoo, and STC under 10-year master agreements. Tenancy ratio improving from 1.4x to 1.6x. 5G co-location demand emerging in 2025.",
    assumptions: JSON.stringify({ oilPrice: 82, fx: "KWD stable", headcountGrowth: 5, capex: 4200000 }),
    historyEntries: [
      { month: "2023-01", revenue: "420000.00", ebitda: "277200.00", probability: "0.8900", sortOrder: 0 },
      { month: "2023-02", revenue: "420000.00", ebitda: "277200.00", probability: "0.8900", sortOrder: 1 },
      { month: "2023-03", revenue: "435000.00", ebitda: "287100.00", probability: "0.9000", sortOrder: 2 },
      { month: "2023-04", revenue: "435000.00", ebitda: "287100.00", probability: "0.9000", sortOrder: 3 },
      { month: "2023-05", revenue: "450000.00", ebitda: "297000.00", probability: "0.9100", sortOrder: 4 },
      { month: "2023-06", revenue: "450000.00", ebitda: "297000.00", probability: "0.9100", sortOrder: 5 },
      { month: "2023-07", revenue: "465000.00", ebitda: "306900.00", probability: "0.9200", sortOrder: 6 },
      { month: "2023-08", revenue: "465000.00", ebitda: "306900.00", probability: "0.9200", sortOrder: 7 },
      { month: "2023-09", revenue: "480000.00", ebitda: "316800.00", probability: "0.9300", sortOrder: 8 },
      { month: "2023-10", revenue: "480000.00", ebitda: "316800.00", probability: "0.9300", sortOrder: 9 },
      { month: "2023-11", revenue: "495000.00", ebitda: "326700.00", probability: "0.9400", sortOrder: 10 },
      { month: "2023-12", revenue: "510000.00", ebitda: "336600.00", probability: "0.9400", sortOrder: 11 },
    ],
  },
  {
    id: "demo-006",
    title: "Majd Pharmaceutical Manufacturing",
    forecastType: "deadline_risk",
    question: "Will Majd Pharma pass SFDA GMP re-inspection and restore full production by Q3 2024?",
    businessArea: "Healthcare",
    geography: "KSA",
    currency: "SAR",
    baseRevenue: "184000000.00",
    ebitdaMargin: "0.1800",
    growthRate: "0.1000",
    confidenceScore: "0.76",
    currentProbability: "0.7700",
    status: "watchlist",
    description: "Dammam-based generic pharmaceutical manufacturer. SFDA GMP re-inspection required after facility upgrade. Production at 60% capacity pending clearance. MOH tender pipeline at risk if deadline missed.",
    assumptions: JSON.stringify({ oilPrice: 82, fx: "SAR/USD peg at 3.75", headcountGrowth: 6, capex: 24000000 }),
    historyEntries: [
      { month: "2023-01", revenue: "11200000.00", ebitda: "1904000.00", probability: "0.7800", sortOrder: 0 },
      { month: "2023-02", revenue: "11800000.00", ebitda: "2006000.00", probability: "0.7700", sortOrder: 1 },
      { month: "2023-03", revenue: "12400000.00", ebitda: "2108000.00", probability: "0.7900", sortOrder: 2 },
      { month: "2023-04", revenue: "13000000.00", ebitda: "2210000.00", probability: "0.7800", sortOrder: 3 },
      { month: "2023-05", revenue: "13600000.00", ebitda: "2312000.00", probability: "0.8000", sortOrder: 4 },
      { month: "2023-06", revenue: "14200000.00", ebitda: "2414000.00", probability: "0.7900", sortOrder: 5 },
      { month: "2023-07", revenue: "14800000.00", ebitda: "2516000.00", probability: "0.7600", sortOrder: 6 },
      { month: "2023-08", revenue: "15400000.00", ebitda: "2618000.00", probability: "0.7500", sortOrder: 7 },
      { month: "2023-09", revenue: "16000000.00", ebitda: "2720000.00", probability: "0.7400", sortOrder: 8 },
      { month: "2023-10", revenue: "16600000.00", ebitda: "2822000.00", probability: "0.7700", sortOrder: 9 },
      { month: "2023-11", revenue: "17200000.00", ebitda: "2924000.00", probability: "0.7800", sortOrder: 10 },
      { month: "2023-12", revenue: "17800000.00", ebitda: "3026000.00", probability: "0.7900", sortOrder: 11 },
    ],
  },
  {
    id: "demo-007",
    title: "Wajd Digital Media Group",
    forecastType: "budget_risk",
    question: "Will Wajd Digital Media achieve SAR 92M revenue target with SVOD launch contributing 15% of mix?",
    businessArea: "Media & Tech",
    geography: "KSA",
    currency: "SAR",
    baseRevenue: "92000000.00",
    ebitdaMargin: "0.1600",
    growthRate: "0.1200",
    confidenceScore: "0.68",
    currentProbability: "0.6900",
    status: "watchlist",
    description: "Riyadh Arabic content platform with 48M YouTube subscribers. SVOD launch contributing SAR 8M in subscription revenue. Subscriber acquisition cost 42% above business case. GCAM compliance review ongoing.",
    assumptions: JSON.stringify({ oilPrice: 82, fx: "SAR/USD peg at 3.75", headcountGrowth: 28, capex: 22000000 }),
    historyEntries: [
      { month: "2023-01", revenue: "5800000.00", ebitda: "870000.00", probability: "0.6900", sortOrder: 0 },
      { month: "2023-02", revenue: "6200000.00", ebitda: "930000.00", probability: "0.6800", sortOrder: 1 },
      { month: "2023-03", revenue: "7400000.00", ebitda: "1110000.00", probability: "0.7200", sortOrder: 2 },
      { month: "2023-04", revenue: "6800000.00", ebitda: "1020000.00", probability: "0.6700", sortOrder: 3 },
      { month: "2023-05", revenue: "7200000.00", ebitda: "1080000.00", probability: "0.6900", sortOrder: 4 },
      { month: "2023-06", revenue: "7800000.00", ebitda: "1170000.00", probability: "0.7000", sortOrder: 5 },
      { month: "2023-07", revenue: "7000000.00", ebitda: "1050000.00", probability: "0.6600", sortOrder: 6 },
      { month: "2023-08", revenue: "7600000.00", ebitda: "1140000.00", probability: "0.6800", sortOrder: 7 },
      { month: "2023-09", revenue: "8200000.00", ebitda: "1230000.00", probability: "0.7100", sortOrder: 8 },
      { month: "2023-10", revenue: "8800000.00", ebitda: "1320000.00", probability: "0.7200", sortOrder: 9 },
      { month: "2023-11", revenue: "9400000.00", ebitda: "1410000.00", probability: "0.6900", sortOrder: 10 },
      { month: "2023-12", revenue: "10200000.00", ebitda: "1530000.00", probability: "0.7100", sortOrder: 11 },
    ],
  },
  {
    id: "demo-008",
    title: "Baraka Renewable Power Holdings",
    forecastType: "target_probability",
    question: "Will Baraka Renewable Power close the 4th plant acquisition at AED 85M EV and maintain 88% EBITDA margin?",
    businessArea: "Infrastructure",
    geography: "UAE",
    currency: "AED",
    baseRevenue: "28000000.00",
    ebitdaMargin: "0.8800",
    growthRate: "0.1700",
    confidenceScore: "0.94",
    currentProbability: "0.9500",
    status: "on_track",
    description: "Abu Dhabi solar IPP with 3 plants totalling 68MWp under ADDC 25-year PPAs. 4th plant acquisition at AED 85M EV in progress. Near risk-free annuity cash flow profile with sovereign counterparty.",
    assumptions: JSON.stringify({ oilPrice: 82, fx: "AED/USD peg at 3.67", headcountGrowth: 8, capex: 85000000 }),
    historyEntries: [
      { month: "2023-01", revenue: "1680000.00", ebitda: "1478400.00", probability: "0.9500", sortOrder: 0 },
      { month: "2023-02", revenue: "1680000.00", ebitda: "1478400.00", probability: "0.9500", sortOrder: 1 },
      { month: "2023-03", revenue: "1960000.00", ebitda: "1724800.00", probability: "0.9600", sortOrder: 2 },
      { month: "2023-04", revenue: "2100000.00", ebitda: "1848000.00", probability: "0.9600", sortOrder: 3 },
      { month: "2023-05", revenue: "2240000.00", ebitda: "1971200.00", probability: "0.9500", sortOrder: 4 },
      { month: "2023-06", revenue: "2380000.00", ebitda: "2094400.00", probability: "0.9400", sortOrder: 5 },
      { month: "2023-07", revenue: "2380000.00", ebitda: "2094400.00", probability: "0.9400", sortOrder: 6 },
      { month: "2023-08", revenue: "2240000.00", ebitda: "1971200.00", probability: "0.9500", sortOrder: 7 },
      { month: "2023-09", revenue: "2100000.00", ebitda: "1848000.00", probability: "0.9600", sortOrder: 8 },
      { month: "2023-10", revenue: "1960000.00", ebitda: "1724800.00", probability: "0.9600", sortOrder: 9 },
      { month: "2023-11", revenue: "1820000.00", ebitda: "1601600.00", probability: "0.9500", sortOrder: 10 },
      { month: "2023-12", revenue: "1680000.00", ebitda: "1478400.00", probability: "0.9500", sortOrder: 11 },
    ],
  },
];

async function seed() {
  const conn = await mysql.createConnection(DB_URL);
  console.log("Connected to database.");

  let totalScenarios = 0;
  let totalHistory = 0;

  for (const scenario of GCC_FORECAST_SCENARIOS) {
    const { historyEntries, ...s } = scenario;

    // Upsert forecast scenario
    await conn.execute(
      `INSERT INTO forecasts
        (id, userId, title, forecastType, question, description, businessArea,
         geography, currency, baseRevenue, ebitdaMargin, growthRate, assumptions,
         currentProbability, confidenceScore, status, isSeeded, agentsJson)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '[]')
       ON DUPLICATE KEY UPDATE
         geography = VALUES(geography),
         currency = VALUES(currency),
         baseRevenue = VALUES(baseRevenue),
         ebitdaMargin = VALUES(ebitdaMargin),
         growthRate = VALUES(growthRate),
         assumptions = VALUES(assumptions),
         currentProbability = VALUES(currentProbability),
         confidenceScore = VALUES(confidenceScore),
         status = VALUES(status),
         isSeeded = 1`,
      [
        s.id, s.title, s.forecastType, s.question, s.description,
        s.businessArea, s.geography, s.currency, s.baseRevenue,
        s.ebitdaMargin, s.growthRate, s.assumptions,
        s.currentProbability, s.confidenceScore, s.status,
      ]
    );
    console.log(`✓ Scenario: ${s.title}`);
    totalScenarios++;

    // Delete existing history for this forecast then re-insert
    await conn.execute(`DELETE FROM forecast_history WHERE forecastId = ?`, [s.id]);

    for (const entry of historyEntries) {
      const id = randomUUID();
      await conn.execute(
        `INSERT INTO forecast_history
          (id, forecastId, probability, confidence, delta, cause, eventType,
           month, revenue, ebitda, sortOrder, recordedAt)
         VALUES (?, ?, ?, 0.75, 0.0000, 'Monthly financial update', 'agent_update',
                 ?, ?, ?, ?, NOW())`,
        [id, s.id, entry.probability, entry.month, entry.revenue, entry.ebitda, entry.sortOrder]
      );
    }
    console.log(`  → ${historyEntries.length} history entries seeded`);
    totalHistory += historyEntries.length;
  }

  await conn.end();
  console.log(`\nDone. ${totalScenarios} scenarios, ${totalHistory} history entries seeded.`);
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seeder failed:", e.message);
  process.exit(1);
});
