/**
 * seedArosUniverse.mjs
 *
 * Seeds the AROS database with:
 *  1. 100 companies (aros_companies)
 *  2. 100 pipeline entries at RESEARCHED stage (aros_pipeline)
 *  3. 100 outreach queue entries (aros_outreach_queue) — pending approval
 *  4. 8 T=0 calibration baselines (aros_calibration)
 *  5. 1 discovery run record (aros_discovery_runs)
 *  6. Token ledger entries (aros_token_ledger)
 *
 * Actual DB column names (from DESCRIBE):
 *   aros_companies: id, company_name, sector, country, hq_city, revenue_usd_bn,
 *     employees, ceo_name, ceo_email, ceo_linkedin, opportunity_score,
 *     agenthink_fit_score, decision_complexity_score, key_decision_domain,
 *     active_strategic_initiative, ai_transformation_signal, opportunity_type,
 *     decision_twin, executive_dossier, universe_rank, run_id, created_at, updated_at
 *
 *   aros_discovery_runs: id, run_id, triggered_by, status, sectors, geographies,
 *     target_count, completed_count, total_tokens_used, total_cost_usd,
 *     started_at, completed_at, duration_ms, error_message, created_at
 *
 *   aros_pipeline: id, company_id, outreach_id, stage, researched_at,
 *     outreach_sent_at, response_received_at, meeting_booked_at, meeting_held_at,
 *     proposal_sent_at, customer_at, deal_value_usd, deal_type,
 *     meeting_calendar_link, meeting_notes, proposal_url, proposal_text,
 *     assigned_to, notes, created_at, updated_at
 *
 *   aros_calibration: id, run_id, metric, predicted_rate, actual_rate,
 *     sample_size, observed_at, notes, created_at
 *
 *   aros_token_ledger: id, run_id, company_id, workflow, model, input_tokens,
 *     output_tokens, total_tokens, cost_usd, triggered_by, created_at
 *
 *   aros_outreach_queue: id, company_id, run_id, email_subject, email_body,
 *     executive_brief, sdr_teaser, target_name, target_email, target_title,
 *     estimated_deal_size_usd, priority, approval_status, approved_by,
 *     approved_at, rejection_reason, sent_at, opened_at, replied_at,
 *     tracking_token, tokens_used, cost_usd, created_at, updated_at
 *
 * Usage: node server/scripts/seedArosUniverse.mjs
 */

import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

// ── Load research data ────────────────────────────────────────────────────────
const researchPath = "/home/ubuntu/aros_company_seed_research.json";
const research = JSON.parse(readFileSync(researchPath, "utf8"));
const companies = research.results.map(r => r.output).filter(Boolean);

// ── DB connection ─────────────────────────────────────────────────────────────
const db = await createConnection(process.env.DATABASE_URL);
console.log("✓ Connected to database");

// ── Utilities ─────────────────────────────────────────────────────────────────
function now() { return Date.now(); }
function randomToken() { return Math.random().toString(36).slice(2, 14); }

function normalizeUrgency(u) {
  const map = { IMMEDIATE: "IMMEDIATE", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW" };
  return map[u?.toUpperCase()] ?? "MEDIUM";
}

function normalizeSector(s) {
  const valid = ["bank", "telecom", "energy", "asset_manager", "infrastructure_investor"];
  const lower = s?.toLowerCase().replace(/\s+/g, "_") ?? "";
  return valid.includes(lower) ? lower : "bank";
}

function funnelTier(score) {
  if (score >= 90) return "TIER_1";
  if (score >= 75) return "TIER_2";
  if (score >= 60) return "TIER_3";
  return "TIER_4";
}

function urgencyToPriority(u) {
  const map = { IMMEDIATE: "IMMEDIATE", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW" };
  return map[u] ?? "MEDIUM";
}

// ── Step 1: Create discovery run ──────────────────────────────────────────────
console.log("\n[1/6] Creating discovery run...");
const runId = `seed-${Date.now()}`;
const seedTokensPerCompany = 1200;
const totalSeedTokens = companies.length * seedTokensPerCompany;
const totalSeedCost = (totalSeedTokens / 1000) * 0.003;
const sectors = [...new Set(companies.map(c => normalizeSector(c.sector)))];
const geos = [...new Set(companies.map(c => c.geography).filter(Boolean))];
const startedAt = now() - 300000;

await db.execute(
  `INSERT INTO aros_discovery_runs
    (run_id, triggered_by, status, sectors, geographies,
     target_count, completed_count, total_tokens_used, total_cost_usd,
     started_at, completed_at, duration_ms, created_at)
   VALUES (?, 1, 'complete', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [runId,
   sectors.join(','),
   geos.join(','),
   companies.length,
   companies.length,
   totalSeedTokens,
   totalSeedCost.toFixed(6),
   startedAt,
   now(),
   300000,
   now()]
);
console.log(`  ✓ Discovery run ${runId} created`);

// ── Step 2: Insert companies ──────────────────────────────────────────────────
console.log("\n[2/6] Inserting 100 companies...");
const companyIds = {};
let companyInserted = 0;

for (let i = 0; i < companies.length; i++) {
  const c = companies[i];
  const sector = normalizeSector(c.sector);
  const urgency = normalizeUrgency(c.urgency_level);
  const score = Math.min(100, Math.max(0, Math.round(c.opportunity_score ?? 75)));
  const acv = Math.round(c.acv_estimate_usd ?? 150000);
  const revBn = c.annual_revenue_usd ? (c.annual_revenue_usd / 1_000_000_000).toFixed(2) : null;
  const ts = now();

  // Build Decision Twin JSON (stored in decision_twin column)
  const decisionTwin = JSON.stringify({
    primaryObjective: c.strategic_initiative_1 ?? "Digital transformation",
    secondaryObjective: c.strategic_initiative_2 ?? "Operational efficiency",
    keyDecisionMakers: [{ name: c.ceo_name ?? "", title: c.ceo_title ?? "CEO", influence: "PRIMARY" }],
    budgetCycle: "Annual (Q4 planning)",
    competitivePressure: urgency === "IMMEDIATE" ? "Critical" : urgency === "HIGH" ? "High" : "Moderate",
    riskTolerance: ["bank", "infrastructure_investor"].includes(sector) ? "Low" : "Medium",
    aiReadiness: urgency === "IMMEDIATE" ? "Advanced" : urgency === "HIGH" ? "Intermediate" : "Early",
    estimatedDecisionTimeline: urgency === "IMMEDIATE" ? "0-3 months" : urgency === "HIGH" ? "3-6 months" : "6-12 months",
    acvEstimateUsd: acv,
    opportunityScore: score,
    urgencyLevel: urgency,
    signals: [c.strategic_initiative_1, c.strategic_initiative_2].filter(Boolean),
    rationale: c.rationale ?? "",
    generatedAt: ts,
    version: 1,
  });

  // Build Executive Dossier JSON
  const executiveDossier = JSON.stringify({
    company: c.company_name,
    sector,
    geography: c.geography,
    hqCity: c.hq_city,
    annualRevenueUsd: c.annual_revenue_usd,
    ceoName: c.ceo_name,
    ceoTitle: c.ceo_title,
    strategicInitiatives: [c.strategic_initiative_1, c.strategic_initiative_2].filter(Boolean),
    urgencyLevel: urgency,
    opportunityScore: score,
    acvEstimateUsd: acv,
    funnelTier: funnelTier(score),
    rationale: c.rationale,
    generatedAt: ts,
  });

  try {
    const [result] = await db.execute(
      `INSERT INTO aros_companies
        (company_name, sector, country, hq_city, revenue_usd_bn,
         ceo_name, opportunity_score, agenthink_fit_score,
         decision_complexity_score, key_decision_domain,
         active_strategic_initiative, ai_transformation_signal,
         opportunity_type, decision_twin, executive_dossier,
         universe_rank, run_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         opportunity_score = VALUES(opportunity_score),
         agenthink_fit_score = VALUES(agenthink_fit_score),
         active_strategic_initiative = VALUES(active_strategic_initiative),
         ai_transformation_signal = VALUES(ai_transformation_signal),
         decision_twin = VALUES(decision_twin),
         executive_dossier = VALUES(executive_dossier),
         universe_rank = VALUES(universe_rank),
         updated_at = VALUES(updated_at)`,
      [
        c.company_name,
        sector,
        c.geography ?? "",
        c.hq_city ?? "",
        revBn,
        c.ceo_name ?? "",
        score,
        Math.min(100, score + Math.floor(Math.random() * 5 - 2)), // agenthink fit ≈ opportunity score ±2
        Math.round(50 + score * 0.3), // decision complexity
        c.strategic_initiative_1?.slice(0, 100) ?? "Digital transformation",
        c.strategic_initiative_1 ?? "",
        urgency,
        "AI_TRANSFORMATION",
        decisionTwin,
        executiveDossier,
        i + 1, // universe rank (will be re-ranked by score later)
        runId,
        ts,
        ts,
      ]
    );
    companyIds[c.company_name] = result.insertId || null;
    companyInserted++;
  } catch (err) {
    console.error(`  ✗ ${c.company_name}: ${err.message}`);
  }
}

// Fetch actual IDs
const [idRows] = await db.execute("SELECT id, company_name FROM aros_companies ORDER BY created_at DESC LIMIT 200");
for (const row of idRows) {
  if (!companyIds[row.company_name]) companyIds[row.company_name] = row.id;
}
const validCompanies = companies.filter(c => companyIds[c.company_name]);
console.log(`  ✓ ${companyInserted} companies inserted (${validCompanies.length} have valid IDs)`);

// ── Step 3: Token ledger — one entry per company ──────────────────────────────
console.log("\n[3/6] Creating token ledger entries...");
let tokenInserted = 0;
for (const c of validCompanies) {
  const companyId = companyIds[c.company_name];
  if (!companyId) continue;
  const inputTok = Math.round(seedTokensPerCompany * 0.8);
  const outputTok = Math.round(seedTokensPerCompany * 0.2);
  const cost = (seedTokensPerCompany / 1000) * 0.003;
  try {
    await db.execute(
      `INSERT INTO aros_token_ledger
        (run_id, company_id, workflow, model, input_tokens, output_tokens,
         total_tokens, cost_usd, triggered_by, created_at)
       VALUES (?, ?, 'discovery_seed', 'default', ?, ?, ?, ?, 'system_seed', ?)`,
      [runId, companyId, inputTok, outputTok, seedTokensPerCompany, cost.toFixed(8), now()]
    );
    tokenInserted++;
  } catch (err) {
    // Ignore duplicates
  }
}
console.log(`  ✓ ${tokenInserted} token ledger entries created`);

// ── Step 4: Pipeline entries at RESEARCHED ────────────────────────────────────
console.log("\n[4/6] Creating pipeline entries (RESEARCHED stage)...");
let pipelineInserted = 0;
const pipelineIds = {};

for (const c of validCompanies) {
  const companyId = companyIds[c.company_name];
  if (!companyId) continue;
  const score = Math.min(100, Math.max(0, Math.round(c.opportunity_score ?? 75)));
  const acv = Math.round(c.acv_estimate_usd ?? 150000);
  const ts = now();

  try {
    const [result] = await db.execute(
      `INSERT INTO aros_pipeline
        (company_id, stage, researched_at, deal_value_usd,
         notes, created_at, updated_at)
       VALUES (?, 'RESEARCHED', ?, ?, ?, ?, ?)`,
      [companyId, ts, acv,
       `T=0 seed. Score: ${score}. ${(c.rationale ?? "").slice(0, 400)}`,
       ts, ts]
    );
    pipelineIds[c.company_name] = result.insertId;
    pipelineInserted++;
  } catch (err) {
    // May already exist
    const [existing] = await db.execute(
      "SELECT id FROM aros_pipeline WHERE company_id = ? LIMIT 1", [companyId]
    );
    if (existing.length) pipelineIds[c.company_name] = existing[0].id;
  }
}
console.log(`  ✓ ${pipelineInserted} pipeline entries created at RESEARCHED stage`);

// ── Step 5: Outreach queue — top 20 by score ─────────────────────────────────
console.log("\n[5/6] Creating outreach queue entries for top 20 companies...");
const top20 = [...validCompanies]
  .sort((a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0))
  .slice(0, 20);

let outreachInserted = 0;
for (const c of top20) {
  const companyId = companyIds[c.company_name];
  if (!companyId) continue;
  const urgency = normalizeUrgency(c.urgency_level);
  const acv = Math.round(c.acv_estimate_usd ?? 150000);
  const score = Math.min(100, Math.max(0, Math.round(c.opportunity_score ?? 75)));
  const ts = now();

  const emailSubject = `${c.company_name} × AgenThink — ${c.strategic_initiative_1 ?? "AI Transformation"} Partnership`;
  const emailBody = `Dear ${c.ceo_name ?? "Executive Team"},

I'm reaching out because ${c.company_name}'s ${c.strategic_initiative_1 ?? "strategic transformation agenda"} aligns directly with what AgenThink Mesh was built to solve.

${c.rationale ?? `Your organization's position in the ${c.sector} sector, combined with your current strategic priorities, creates a compelling opportunity for AI-powered decision intelligence.`}

AgenThink Mesh provides governed decision infrastructure — every recommendation is evaluated by a council of specialized AI agents, stress-tested across thousands of scenarios, and backed by a machine-verifiable audit trail.

For ${c.company_name}, we estimate an initial engagement value of $${acv.toLocaleString()}/year, with measurable ROI within the first 90 days.

I'd welcome 20 minutes to share how we've approached similar challenges in your sector.

Best regards,
AgenThink Mesh Team`;

  const executiveBrief = `EXECUTIVE BRIEF: ${c.company_name}

OPPORTUNITY: ${c.strategic_initiative_1 ?? "AI Transformation"}
URGENCY: ${urgency}
ESTIMATED ACV: $${acv.toLocaleString()}
OPPORTUNITY SCORE: ${score}/100

STRATEGIC CONTEXT:
${c.rationale ?? "High-priority AI transformation opportunity."}

KEY DECISION MAKER: ${c.ceo_name ?? "CEO"} (${c.ceo_title ?? "CEO"})

RECOMMENDED APPROACH:
1. Lead with decision governance use case (highest urgency signal)
2. Reference comparable ${c.sector} sector deployments
3. Propose 30-day proof-of-concept with measurable KPIs
4. Target Q4 budget cycle for full engagement`;

  const sdrTeaser = `${c.company_name} — Score ${score}/100 | ${urgency} | ACV $${acv.toLocaleString()}
Signal: ${c.strategic_initiative_1 ?? "AI transformation"}
Contact: ${c.ceo_name ?? "CEO"} | ${c.geography}
Action: Send personalized outreach → book 20-min discovery call`;

  try {
    await db.execute(
      `INSERT INTO aros_outreach_queue
        (company_id, run_id, email_subject, email_body, executive_brief,
         sdr_teaser, target_name, target_title,
         estimated_deal_size_usd, priority, approval_status,
         tracking_token, tokens_used, cost_usd, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_CEO_REVIEW', ?, ?, ?, ?, ?)`,
      [
        companyId, runId,
        emailSubject.slice(0, 500),
        emailBody,
        executiveBrief,
        sdrTeaser,
        c.ceo_name ?? "",
        c.ceo_title ?? "CEO",
        acv,
        urgencyToPriority(urgency),
        randomToken(),
        800,
        (800 / 1000 * 0.015).toFixed(6),
        ts, ts,
      ]
    );
    outreachInserted++;
  } catch (err) {
    console.error(`  ✗ Outreach for ${c.company_name}: ${err.message}`);
  }
}
console.log(`  ✓ ${outreachInserted} outreach queue entries created (pending approval)`);

// ── Step 6: T=0 Calibration baselines ────────────────────────────────────────
console.log("\n[6/6] Creating T=0 calibration baselines...");
const T0_BASELINES = [
  { metric: "outreach_response_rate", predicted: 0.10, notes: "Industry baseline: 10% cold outreach response rate for enterprise SaaS" },
  { metric: "response_to_meeting_rate", predicted: 0.50, notes: "50% of responses convert to discovery meetings" },
  { metric: "meeting_to_proposal_rate", predicted: 0.40, notes: "40% of meetings result in formal proposals" },
  { metric: "proposal_to_customer_rate", predicted: 0.25, notes: "25% proposal close rate (enterprise SaaS industry baseline)" },
  { metric: "overall_conversion_rate", predicted: 0.005, notes: "0.5% overall outreach-to-customer conversion rate" },
  { metric: "opportunity_detection_accuracy", predicted: 0.70, notes: "70% of IMMEDIATE/HIGH scored companies confirm real buying intent" },
  { metric: "acv_estimation_accuracy", predicted: 0.65, notes: "65% of ACV estimates within 25% of actual contract value" },
  { metric: "urgency_score_accuracy", predicted: 0.72, notes: "72% urgency classifications confirmed by prospect response behavior" },
];

let baselineInserted = 0;
for (const b of T0_BASELINES) {
  try {
    await db.execute(
      `INSERT INTO aros_calibration
        (run_id, metric, predicted_rate, actual_rate, sample_size,
         observed_at, notes, created_at)
       VALUES (?, ?, ?, NULL, 0, ?, ?, ?)`,
      [runId, b.metric, b.predicted, now(), b.notes, now()]
    );
    baselineInserted++;
  } catch (err) {
    console.error(`  ✗ Baseline ${b.metric}: ${err.message}`);
  }
}
console.log(`  ✓ ${baselineInserted} T=0 calibration baselines created`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("AROS SEED COMPLETE");
console.log("=".repeat(60));
console.log(`Companies seeded:       ${companyInserted}`);
console.log(`Pipeline entries:       ${pipelineInserted} (RESEARCHED)`);
console.log(`Outreach queue:         ${outreachInserted} (top 20, PENDING approval)`);
console.log(`T=0 baselines:          ${baselineInserted}`);
console.log(`Token ledger entries:   ${tokenInserted}`);
console.log(`Discovery run:          ${runId}`);
console.log(`Total tokens:           ${totalSeedTokens.toLocaleString()}`);
console.log(`Total cost:             $${totalSeedCost.toFixed(4)}`);
console.log(`Token ROI (at $25K ACV): ${Math.round(25000 / totalSeedCost).toLocaleString()}x`);
console.log("=".repeat(60));

await db.end();
process.exit(0);
