/**
 * Knowledge Vault Seeder
 * Parses all 8 domain JSON files and inserts them into the knowledge_scenarios table.
 * Run: node scripts/seed-knowledge-vault.mjs
 */
import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

// ── Domain extractors ─────────────────────────────────────────────────────────

function extractDealScreening(s) {
  const title = s.company_name || s.target_company || s.deal_name || s.scenario_id;
  const summary = [
    s.deal_type ? `Deal type: ${s.deal_type}` : null,
    s.sector ? `Sector: ${s.sector}` : null,
    s.deal_size_usd ? `Size: USD ${s.deal_size_usd.toLocaleString()}` : null,
    s.recommendation ? `Recommendation: ${s.recommendation}` : null,
  ].filter(Boolean).join(". ");
  const geo = s.geography || s.market || s.country || "GCC";
  const sector = s.sector || s.industry || null;
  const tags = [s.deal_type, s.recommendation, geo, sector].filter(Boolean).join(",");
  return { title, summary, geo, sector, tags };
}

function extractWealth(s) {
  const title = s.client_name || s.client_id || s.scenario_id;
  const summary = [
    s.client_profile ? `Profile: ${s.client_profile}` : null,
    s.aum_usd ? `AUM: USD ${Number(s.aum_usd).toLocaleString()}` : null,
    s.primary_objective ? `Objective: ${s.primary_objective}` : null,
    s.recommended_action ? `Action: ${s.recommended_action}` : null,
  ].filter(Boolean).join(". ");
  const geo = s.domicile || s.nationality || s.market || "GCC";
  const sector = "Wealth Management";
  const tags = [s.risk_profile, s.shariah_compliant ? "shariah" : null, geo].filter(Boolean).join(",");
  return { title, summary, geo, sector, tags };
}

function extractInsurance(s) {
  const title = s.insured_name || s.client_name || s.scenario_id;
  const summary = [
    s.insurance_class ? `Class: ${s.insurance_class}` : null,
    s.sum_insured_usd ? `Sum insured: USD ${Number(s.sum_insured_usd).toLocaleString()}` : null,
    s.underwriting_decision ? `Decision: ${s.underwriting_decision}` : null,
    s.key_risk_factor ? `Key risk: ${s.key_risk_factor}` : null,
  ].filter(Boolean).join(". ");
  const geo = s.market || s.country || "GCC";
  const sector = s.insurance_class || "Insurance";
  const tags = [s.insurance_class, s.underwriting_decision, geo].filter(Boolean).join(",");
  return { title, summary, geo, sector, tags };
}

function extractMvno(s) {
  const title = s.mvno_name || s.scenario_id;
  const summary = [
    s.host_mno ? `Host MNO: ${s.host_mno}` : null,
    s.market ? `Market: ${s.market}` : null,
    s.subscriber_count ? `Subscribers: ${Number(s.subscriber_count).toLocaleString()}` : null,
    s.arpu_usd ? `ARPU: USD ${s.arpu_usd}` : null,
    s.strategic_risk_flag ? `Risk: ${s.strategic_risk_flag.substring(0, 120)}` : null,
  ].filter(Boolean).join(". ");
  const geo = s.market || "GCC";
  const sector = "Telecom / MVNO";
  const tags = [s.subscriber_segment, s.key_differentiator, geo].filter(Boolean).join(",");
  return { title, summary, geo, sector, tags };
}

function extractLegal(s) {
  const title = s.matter_name || s.scenario_id;
  const summary = [
    s.matter_type ? `Type: ${s.matter_type}` : null,
    s.jurisdiction ? `Jurisdiction: ${s.jurisdiction}` : null,
    s.risk_rating ? `Risk: ${s.risk_rating}` : null,
    s.recommended_action ? `Action: ${s.recommended_action?.substring(0, 120)}` : null,
  ].filter(Boolean).join(". ");
  const geo = s.jurisdiction || "GCC";
  const sector = s.matter_type || "Legal";
  const tags = [s.matter_type, s.risk_rating, s.dispute_resolution, geo].filter(Boolean).join(",");
  return { title, summary, geo, sector, tags };
}

function extractBudget(s) {
  const title = s.company_name || s.scenario_id;
  const rev = s.revenue_forecast_kwd || s.revenue_forecast_sar || s.revenue_forecast_aed || s.revenue_forecast_usd;
  const currency = s.revenue_forecast_kwd ? "KWD" : s.revenue_forecast_sar ? "SAR" : s.revenue_forecast_aed ? "AED" : "USD";
  const summary = [
    s.fiscal_year ? `FY${s.fiscal_year}` : null,
    rev ? `Revenue: ${currency} ${Number(rev).toLocaleString()}` : null,
    s.ebitda_margin_forecast_pct ? `EBITDA margin: ${s.ebitda_margin_forecast_pct}%` : null,
    s.board_recommendation ? `Board: ${s.board_recommendation}` : null,
    s.cfo_commentary ? s.cfo_commentary.substring(0, 120) : null,
  ].filter(Boolean).join(". ");
  const geo = currency === "KWD" ? "Kuwait" : currency === "SAR" ? "KSA" : currency === "AED" ? "UAE" : "GCC";
  const sector = s.sector || "Corporate";
  const tags = [s.board_recommendation, geo, currency].filter(Boolean).join(",");
  return { title, summary, geo, sector, tags };
}

function extractSocial(s) {
  const title = s.brand_name || s.scenario_id;
  const summary = [
    s.market ? `Market: ${s.market}` : null,
    s.sentiment_score ? `Sentiment: ${s.sentiment_score}/100` : null,
    s.crisis_flag ? `CRISIS: ${s.crisis_description?.substring(0, 100)}` : null,
    s.recommended_action ? `Action: ${s.recommended_action?.substring(0, 120)}` : null,
  ].filter(Boolean).join(". ");
  const geo = s.market || "GCC";
  const sector = "Social Media / Brand";
  const tags = [s.top_performing_content_type, s.crisis_flag ? "crisis" : null, geo, ...(s.platform_mix || [])].filter(Boolean).join(",");
  return { title, summary, geo, sector, tags };
}

function extractIC(s) {
  const title = `${s.fund_name || ""} — ${s.position_under_review || s.scenario_id}`.trim();
  const summary = [
    s.asset_class ? `Asset class: ${s.asset_class}` : null,
    s.portfolio_manager_recommendation ? `PM recommendation: ${s.portfolio_manager_recommendation}` : null,
    s.ic_decision ? `IC decision: ${s.ic_decision}` : null,
    s.rationale?.[0] ? s.rationale[0].substring(0, 120) : null,
  ].filter(Boolean).join(". ");
  const geo = "GCC";
  const sector = s.asset_class || "Investment Management";
  const tags = [s.asset_class, s.ic_decision, s.esg_flag, s.portfolio_manager_recommendation].filter(Boolean).join(",");
  return { title, summary, geo, sector, tags };
}

const DOMAIN_CONFIG = [
  { file: "domain1_deal_screening.json",       domain: "deal_screening",          extractor: extractDealScreening },
  { file: "domain2_wealth_management.json",    domain: "wealth_management",       extractor: extractWealth },
  { file: "domain3_insurance_underwriting.json", domain: "insurance_underwriting", extractor: extractInsurance },
  { file: "domain4_mvno_intelligence.json",    domain: "mvno_intelligence",       extractor: extractMvno },
  { file: "domain5_legal_review.json",         domain: "legal_review",            extractor: extractLegal },
  { file: "domain6_budget_forecasting.json",   domain: "budget_forecasting",      extractor: extractBudget },
  { file: "domain7_social_media.json",         domain: "social_media",            extractor: extractSocial },
  { file: "domain8_ic_reports.json",           domain: "ic_reports",              extractor: extractIC },
];

async function main() {
  const conn = await createConnection(DATABASE_URL);
  console.log("Connected to database.");

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const { file, domain, extractor } of DOMAIN_CONFIG) {
    const filePath = join(__dirname, "../synthetic-data", file);
    let scenarios;
    try {
      const raw = readFileSync(filePath, "utf-8");
      // Find the first [ and parse from there (handles any leading text)
      const jsonStart = raw.indexOf("[");
      scenarios = JSON.parse(raw.slice(jsonStart));
    } catch (e) {
      console.error(`Failed to parse ${file}: ${e.message}`);
      continue;
    }

    console.log(`\nProcessing ${file} — ${scenarios.length} scenarios`);
    let inserted = 0;
    let skipped = 0;

    for (const s of scenarios) {
      const scenarioId = s.scenario_id;
      if (!scenarioId) { skipped++; continue; }

      const { title, summary, geo, sector, tags } = extractor(s);
      const content = JSON.stringify(s);

      try {
        await conn.execute(
          `INSERT IGNORE INTO knowledge_scenarios (scenarioId, domain, title, summary, content, geography, sector, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [scenarioId, domain, title || scenarioId, summary || "", content, geo || null, sector || null, tags || null]
        );
        inserted++;
      } catch (e) {
        console.error(`  Error inserting ${scenarioId}: ${e.message}`);
        skipped++;
      }
    }

    console.log(`  ✓ Inserted: ${inserted}, Skipped/duplicate: ${skipped}`);
    totalInserted += inserted;
    totalSkipped += skipped;
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Total skipped:  ${totalSkipped}`);
  console.log(`═══════════════════════════════════`);

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
