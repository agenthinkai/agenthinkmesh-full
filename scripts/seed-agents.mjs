/**
 * Seed script: insert 15 curated AgenThink domain agents into the agents table.
 * Run with: node scripts/seed-agents.mjs
 *
 * Owner ID = 1 (Farouq Sultan — platform owner)
 * All agents use the internal Mesh endpoint (handled by agent.routeTask via invokeLLM).
 * endpointUrl is set to the platform's own /api/trpc/mesh.runAgentTask path — 
 * for curated agents this is a sentinel value; actual execution goes through invokeLLM.
 */

import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load DATABASE_URL from .env
const envPath = resolve(__dirname, "../.env");
let DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  try {
    const env = readFileSync(envPath, "utf8");
    const match = env.match(/DATABASE_URL=(.+)/);
    if (match) DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
}
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const OWNER_ID = 1; // Farouq Sultan
const INTERNAL_ENDPOINT = "https://agenthink-7enctkan.manus.space/api/internal/agent";

const AGENTS = [
  // ── GCC Finance (5) ──────────────────────────────────────────────────────────
  {
    agentName: "GCC Equity Screener",
    developerName: "AgenThink",
    description: "Screens GCC-listed equities by sector, P/E ratio, dividend yield, and market capitalisation across Boursa Kuwait, Tadawul, ADX, and DFM.",
    capabilities: ["equity_screening", "gcc_markets", "fundamental_analysis", "sector_analysis"],
    domain: "GCC Finance",
  },
  {
    agentName: "Kuwait Macro Monitor",
    developerName: "AgenThink",
    description: "Tracks Kuwait economic indicators including oil price, KD FX rates, CPI, government spending, and CBK policy signals.",
    capabilities: ["macro_economics", "kuwait_market", "fx_analysis", "oil_price", "central_bank"],
    domain: "GCC Finance",
  },
  {
    agentName: "IPO Pipeline Tracker",
    developerName: "AgenThink",
    description: "Monitors upcoming and recent IPOs across Boursa Kuwait, Tadawul, ADX, and DFM including subscription windows, pricing, and sector allocation.",
    capabilities: ["ipo_analysis", "gcc_markets", "equity_markets", "primary_markets"],
    domain: "GCC Finance",
  },
  {
    agentName: "Oil Price Sensitivity Analyzer",
    developerName: "AgenThink",
    description: "Models portfolio sensitivity to Brent crude price movements, including correlation analysis, beta estimation, and scenario stress testing for GCC portfolios.",
    capabilities: ["oil_price", "portfolio_risk", "sensitivity_analysis", "stress_testing", "commodities"],
    domain: "GCC Finance",
  },
  {
    agentName: "Sovereign Wealth Fund Activity Tracker",
    developerName: "AgenThink",
    description: "Tracks disclosed positions and strategic moves by GCC sovereign wealth funds including KIA, ADIA, PIF, Mubadala, and QIA.",
    capabilities: ["sovereign_wealth", "gcc_swf", "institutional_flows", "portfolio_monitoring"],
    domain: "GCC Finance",
  },

  // ── Islamic Finance (3) ───────────────────────────────────────────────────────
  {
    agentName: "Shariah Compliance Screener",
    developerName: "AgenThink",
    description: "Screens equities and financial instruments against AAOIFI Shariah standards, identifying non-compliant revenue streams, debt ratios, and business activities.",
    capabilities: ["shariah_compliance", "aaoifi", "islamic_finance", "equity_screening", "halal_investing"],
    domain: "Islamic Finance",
  },
  {
    agentName: "Sukuk Structure Analyzer",
    developerName: "AgenThink",
    description: "Parses and classifies sukuk structures including ijara, murabaha, wakala, musharaka, and hybrid structures. Extracts key terms, tenor, and yield metrics.",
    capabilities: ["sukuk", "islamic_bonds", "fixed_income", "islamic_finance", "structure_analysis"],
    domain: "Islamic Finance",
  },
  {
    agentName: "Halal Revenue Screener",
    developerName: "AgenThink",
    description: "Identifies and quantifies haram revenue streams from company financials, flagging exposure to alcohol, tobacco, gambling, conventional banking, and weapons.",
    capabilities: ["halal_screening", "revenue_analysis", "shariah_compliance", "islamic_finance"],
    domain: "Islamic Finance",
  },

  // ── Arabic NLP (3) ────────────────────────────────────────────────────────────
  {
    agentName: "Gulf Dialect Sentiment Analyzer",
    developerName: "AgenThink",
    description: "Performs sentiment analysis on Gulf Arabic text including Kuwaiti, Saudi, Emirati, and Qatari dialects. Returns polarity, intensity, and dialect classification.",
    capabilities: ["arabic_nlp", "sentiment_analysis", "gulf_dialect", "kuwaiti_arabic", "text_classification"],
    domain: "Arabic NLP",
  },
  {
    agentName: "Arabic Financial News Summarizer",
    developerName: "AgenThink",
    description: "Summarises Arabic-language financial news articles and earnings releases into structured English summaries with key figures, entities, and market implications.",
    capabilities: ["arabic_nlp", "financial_news", "summarisation", "translation", "news_analysis"],
    domain: "Arabic NLP",
  },
  {
    agentName: "Arabic Earnings Extractor",
    developerName: "AgenThink",
    description: "Extracts key financial metrics from Arabic earnings releases and annual reports: revenue, net profit, EPS, dividend, and year-on-year comparisons.",
    capabilities: ["arabic_nlp", "earnings_extraction", "financial_data", "arabic_documents", "information_extraction"],
    domain: "Arabic NLP",
  },

  // ── Legal / Compliance (4) ────────────────────────────────────────────────────
  {
    agentName: "ADGM Regulatory Monitor",
    developerName: "AgenThink",
    description: "Tracks ADGM (Abu Dhabi Global Market) rule updates, consultation papers, enforcement actions, and compliance deadlines for regulated entities.",
    capabilities: ["regulatory_monitoring", "adgm", "uae_compliance", "financial_regulation", "compliance"],
    domain: "Legal / Compliance",
  },
  {
    agentName: "Kuwait CMA Compliance Checker",
    developerName: "AgenThink",
    description: "Checks filings, disclosures, and corporate actions against Kuwait Capital Markets Authority rules and listing obligations for Boursa Kuwait-listed entities.",
    capabilities: ["kuwait_cma", "compliance", "regulatory_filing", "disclosure", "boursa_kuwait"],
    domain: "Legal / Compliance",
  },
  {
    agentName: "GCC Sanctions Screener",
    developerName: "AgenThink",
    description: "Screens entities, individuals, and transactions against UAE, Saudi Arabia, and Kuwait sanctions lists, as well as OFAC and UN consolidated lists.",
    capabilities: ["sanctions_screening", "aml", "compliance", "gcc_sanctions", "ofac", "kyc"],
    domain: "Legal / Compliance",
  },
  {
    agentName: "KYC/AML Flag Agent",
    developerName: "AgenThink",
    description: "Flags suspicious patterns in KYC data and transaction records against GCC AML standards and FATF recommendations, generating risk scores and narrative summaries.",
    capabilities: ["kyc", "aml", "risk_scoring", "compliance", "financial_crime", "transaction_monitoring"],
    domain: "Legal / Compliance",
  },
];

async function seed() {
  const conn = await createConnection(DATABASE_URL);
  console.log("Connected to database.");

  // Check existing agents to avoid duplicates
  const [existing] = await conn.execute("SELECT agentName FROM agents WHERE ownerId = ?", [OWNER_ID]);
  const existingNames = new Set(existing.map((r) => r.agentName));

  let inserted = 0;
  let skipped = 0;

  for (const agent of AGENTS) {
    if (existingNames.has(agent.agentName)) {
      console.log(`  SKIP  ${agent.agentName} (already exists)`);
      skipped++;
      continue;
    }

    await conn.execute(
      `INSERT INTO agents 
        (ownerId, agentName, developerName, description, capabilities, endpointUrl, 
         averageLatency, pricingModel, status, connectionTested, version, lastVerifiedAt, failCount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        OWNER_ID,
        agent.agentName,
        agent.developerName,
        agent.description,
        JSON.stringify(agent.capabilities),
        INTERNAL_ENDPOINT,
        300, // 300ms average latency
        "free",
        "active",
        1, // connectionTested = true
        "1.0.0",
        0, // failCount = 0
      ]
    );

    // Also seed agentMetrics row
    const [result] = await conn.execute("SELECT id FROM agents WHERE agentName = ? AND ownerId = ?", [agent.agentName, OWNER_ID]);
    if (result.length > 0) {
      const agentId = result[0].id;
      await conn.execute(
        `INSERT IGNORE INTO agent_metrics (agentId, tasksCompleted, successRate, avgLatency, errorRate)
         VALUES (?, ?, ?, ?, ?)`,
        [agentId, 0, "95.00", 300, "0.00"]
      );
    }

    console.log(`  INSERT ${agent.agentName} [${agent.domain}]`);
    inserted++;
  }

  console.log(`\nDone. ${inserted} agents inserted, ${skipped} skipped.`);
  await conn.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
