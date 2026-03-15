/**
 * Seed agents for the 8 persona domains not yet in the DB:
 * Banker, Fund Manager, Investment Manager, Investment Analyst,
 * Doctor, Student, Retailer, Office Clerk, Manager, Marketing Manager
 * (Finance / Legal / Healthcare / Enterprise / GCC Wealth already seeded)
 */
import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
config();

const AGENTS = [
  // ── Banker ──────────────────────────────────────────────────────────────────
  { domain: "Banker", agentName: "KYC Screener", description: "Screens customers against AML watchlists, PEP databases, and sanctions lists.", capabilities: ["kyc","aml","sanctions-screening"] },
  { domain: "Banker", agentName: "Credit Risk Scorer", description: "Calculates credit risk scores from financial statements and bureau data.", capabilities: ["credit-risk","scoring","financial-analysis"] },
  { domain: "Banker", agentName: "Regulatory Monitor", description: "Tracks GCC central bank circulars, CBUAE, SAMA, and CBK regulatory updates.", capabilities: ["regulatory-monitoring","gcc-banking","compliance"] },
  { domain: "Banker", agentName: "Loan Underwriter", description: "Automates loan underwriting decisions using income, collateral, and risk data.", capabilities: ["loan-underwriting","credit-assessment","decision-support"] },
  { domain: "Banker", agentName: "Fraud Detector", description: "Identifies suspicious transaction patterns and flags potential fraud cases.", capabilities: ["fraud-detection","transaction-monitoring","risk-flagging"] },
  { domain: "Banker", agentName: "Compliance Checker", description: "Checks banking operations against Basel III, IFRS 9, and local regulations.", capabilities: ["compliance","basel-iii","ifrs-9"] },

  // ── Fund Manager ─────────────────────────────────────────────────────────────
  { domain: "Fund Manager", agentName: "Deal Screener", description: "Screens investment opportunities against fund mandate, sector, and return criteria.", capabilities: ["deal-screening","mandate-matching","investment-analysis"] },
  { domain: "Fund Manager", agentName: "Portfolio Monitor", description: "Monitors portfolio performance, tracks NAV, and flags covenant breaches.", capabilities: ["portfolio-monitoring","nav-tracking","covenant-monitoring"] },
  { domain: "Fund Manager", agentName: "Macro Monitor", description: "Tracks macro indicators, central bank decisions, and geopolitical risk signals.", capabilities: ["macro-analysis","market-intelligence","risk-monitoring"] },
  { domain: "Fund Manager", agentName: "LP Reporter", description: "Generates limited partner reports with performance attribution and commentary.", capabilities: ["lp-reporting","performance-attribution","investor-relations"] },
  { domain: "Fund Manager", agentName: "Benchmark Analyzer", description: "Compares fund performance against relevant benchmarks and peer funds.", capabilities: ["benchmarking","performance-analysis","peer-comparison"] },
  { domain: "Fund Manager", agentName: "Exit Modeler", description: "Models exit scenarios, IRR sensitivities, and distribution waterfalls.", capabilities: ["exit-modeling","irr-analysis","waterfall-modeling"] },

  // ── Investment Manager ────────────────────────────────────────────────────────
  { domain: "Investment Manager", agentName: "Asset Allocator", description: "Optimises asset allocation across equities, fixed income, alternatives, and cash.", capabilities: ["asset-allocation","portfolio-construction","optimisation"] },
  { domain: "Investment Manager", agentName: "AUM Reporter", description: "Generates AUM reports with breakdown by asset class, geography, and client.", capabilities: ["aum-reporting","client-reporting","portfolio-analytics"] },
  { domain: "Investment Manager", agentName: "Risk Attributor", description: "Attributes portfolio risk to individual positions, sectors, and factors.", capabilities: ["risk-attribution","factor-analysis","portfolio-risk"] },
  { domain: "Investment Manager", agentName: "Rebalancing Agent", description: "Recommends portfolio rebalancing actions based on drift and mandate constraints.", capabilities: ["rebalancing","drift-monitoring","mandate-compliance"] },
  { domain: "Investment Manager", agentName: "Client Mandate Checker", description: "Checks proposed trades against client investment policy statements.", capabilities: ["mandate-compliance","ips-checking","trade-compliance"] },
  { domain: "Investment Manager", agentName: "Sovereign Wealth Analyst", description: "Analyses sovereign wealth fund strategies, allocations, and GCC market positions.", capabilities: ["sovereign-wealth","gcc-markets","strategic-analysis"] },

  // ── Investment Analyst ────────────────────────────────────────────────────────
  { domain: "Investment Analyst", agentName: "DCF Modeler", description: "Builds and stress-tests discounted cash flow models from financial inputs.", capabilities: ["dcf-modeling","valuation","financial-modeling"] },
  { domain: "Investment Analyst", agentName: "Earnings Summarizer", description: "Summarises earnings calls, extracts guidance, and flags key surprises.", capabilities: ["earnings-analysis","transcript-summarization","guidance-extraction"] },
  { domain: "Investment Analyst", agentName: "Equity Screener", description: "Screens equities by valuation multiples, growth rates, and quality factors.", capabilities: ["equity-screening","fundamental-analysis","stock-selection"] },
  { domain: "Investment Analyst", agentName: "Comps Builder", description: "Builds comparable company analysis tables with key trading multiples.", capabilities: ["comps-analysis","peer-benchmarking","multiples-analysis"] },
  { domain: "Investment Analyst", agentName: "Sector Analyst", description: "Produces sector deep-dives with competitive dynamics and growth drivers.", capabilities: ["sector-analysis","industry-research","competitive-intelligence"] },
  { domain: "Investment Analyst", agentName: "Arabic Earnings Extractor", description: "Extracts financial data and KPIs from Arabic-language earnings reports.", capabilities: ["arabic-nlp","earnings-extraction","financial-data"] },

  // ── Doctor ────────────────────────────────────────────────────────────────────
  { domain: "Doctor", agentName: "Drug Interaction Checker", description: "Checks for drug-drug and drug-disease interactions from prescription data.", capabilities: ["drug-interactions","pharmacology","clinical-safety"] },
  { domain: "Doctor", agentName: "Clinical Summarizer", description: "Summarises patient records, lab results, and imaging reports into clinical notes.", capabilities: ["clinical-summarization","patient-records","documentation"] },
  { domain: "Doctor", agentName: "ICD Coder", description: "Assigns ICD-10/11 codes to diagnoses from clinical text.", capabilities: ["icd-coding","medical-coding","diagnosis-classification"] },
  { domain: "Doctor", agentName: "Medical Literature Agent", description: "Searches and summarises relevant medical literature and clinical guidelines.", capabilities: ["literature-search","evidence-synthesis","clinical-guidelines"] },
  { domain: "Doctor", agentName: "Patient Report Builder", description: "Generates structured patient reports from consultation notes and test results.", capabilities: ["report-generation","clinical-documentation","patient-communication"] },
  { domain: "Doctor", agentName: "Differential Diagnosis Agent", description: "Suggests differential diagnoses based on symptoms, history, and test results.", capabilities: ["differential-diagnosis","clinical-reasoning","decision-support"] },

  // ── Student ───────────────────────────────────────────────────────────────────
  { domain: "Student", agentName: "Research Assistant", description: "Finds, summarises, and organises academic sources for research papers.", capabilities: ["academic-research","source-finding","literature-review"] },
  { domain: "Student", agentName: "Citation Builder", description: "Formats citations in APA, MLA, Harvard, and Chicago styles from source data.", capabilities: ["citation-formatting","bibliography","academic-writing"] },
  { domain: "Student", agentName: "Concept Explainer", description: "Explains complex concepts in simple language with examples and analogies.", capabilities: ["concept-explanation","tutoring","simplification"] },
  { domain: "Student", agentName: "Essay Outliner", description: "Creates structured essay outlines with thesis, arguments, and supporting points.", capabilities: ["essay-writing","outlining","academic-writing"] },
  { domain: "Student", agentName: "Study Planner", description: "Creates personalised study plans with time allocation and revision schedules.", capabilities: ["study-planning","time-management","academic-productivity"] },
  { domain: "Student", agentName: "Plagiarism Advisor", description: "Reviews text for potential plagiarism issues and suggests paraphrasing.", capabilities: ["plagiarism-check","academic-integrity","paraphrasing"] },

  // ── Retailer ──────────────────────────────────────────────────────────────────
  { domain: "Retailer", agentName: "Demand Forecaster", description: "Forecasts product demand using historical sales, seasonality, and market signals.", capabilities: ["demand-forecasting","inventory-planning","sales-analytics"] },
  { domain: "Retailer", agentName: "Inventory Optimizer", description: "Optimises inventory levels, reorder points, and safety stock across SKUs.", capabilities: ["inventory-optimization","sku-management","supply-chain"] },
  { domain: "Retailer", agentName: "Supplier Risk Scorer", description: "Scores supplier reliability, financial health, and delivery performance.", capabilities: ["supplier-risk","procurement","vendor-assessment"] },
  { domain: "Retailer", agentName: "Pricing Intelligence Agent", description: "Monitors competitor pricing and recommends dynamic pricing adjustments.", capabilities: ["pricing-intelligence","competitive-monitoring","revenue-optimization"] },
  { domain: "Retailer", agentName: "Customer Sentiment Analyzer", description: "Analyses customer reviews and feedback to surface product and service insights.", capabilities: ["sentiment-analysis","customer-feedback","product-insights"] },
  { domain: "Retailer", agentName: "Promotion Planner", description: "Plans promotional campaigns with expected uplift, margin impact, and timing.", capabilities: ["promotion-planning","campaign-analytics","margin-analysis"] },

  // ── Office Clerk ──────────────────────────────────────────────────────────────
  { domain: "Office Clerk", agentName: "Document Summarizer", description: "Summarises long documents, reports, and contracts into concise briefs.", capabilities: ["document-summarization","text-extraction","briefing"] },
  { domain: "Office Clerk", agentName: "Email Drafter", description: "Drafts professional emails from bullet points or verbal instructions.", capabilities: ["email-drafting","business-writing","communication"] },
  { domain: "Office Clerk", agentName: "Meeting Notes Agent", description: "Converts meeting recordings or transcripts into structured action-item notes.", capabilities: ["meeting-notes","action-items","transcription"] },
  { domain: "Office Clerk", agentName: "Task Prioritizer", description: "Prioritises task lists by urgency, importance, and deadline.", capabilities: ["task-management","prioritization","productivity"] },
  { domain: "Office Clerk", agentName: "Form Filler", description: "Extracts data from documents and populates standard forms and templates.", capabilities: ["form-filling","data-extraction","document-processing"] },
  { domain: "Office Clerk", agentName: "Calendar Scheduler", description: "Suggests optimal meeting times and drafts calendar invites from instructions.", capabilities: ["scheduling","calendar-management","coordination"] },

  // ── Manager ───────────────────────────────────────────────────────────────────
  { domain: "Manager", agentName: "Team Performance Analyzer", description: "Analyses team performance metrics, identifies gaps, and recommends actions.", capabilities: ["performance-management","team-analytics","hr-insights"] },
  { domain: "Manager", agentName: "Project Tracker", description: "Tracks project milestones, flags delays, and generates status reports.", capabilities: ["project-tracking","milestone-management","status-reporting"] },
  { domain: "Manager", agentName: "KPI Dashboard Agent", description: "Builds KPI dashboards from raw data with trend analysis and commentary.", capabilities: ["kpi-analysis","dashboard-generation","business-intelligence"] },
  { domain: "Manager", agentName: "Meeting Summarizer", description: "Summarises meeting notes into decisions, owners, and deadlines.", capabilities: ["meeting-summarization","decision-tracking","action-management"] },
  { domain: "Manager", agentName: "Risk Flagging Agent", description: "Identifies operational, financial, and strategic risks from business data.", capabilities: ["risk-identification","operational-risk","strategic-analysis"] },
  { domain: "Manager", agentName: "Budget Variance Analyzer", description: "Compares actual vs budget, explains variances, and flags overspends.", capabilities: ["budget-analysis","variance-reporting","financial-control"] },

  // ── Marketing Manager ─────────────────────────────────────────────────────────
  { domain: "Marketing Manager", agentName: "Campaign Analyzer", description: "Analyses campaign performance across channels with ROI and attribution.", capabilities: ["campaign-analytics","roi-analysis","marketing-attribution"] },
  { domain: "Marketing Manager", agentName: "Audience Segmenter", description: "Segments audiences by behaviour, demographics, and purchase intent.", capabilities: ["audience-segmentation","customer-profiling","targeting"] },
  { domain: "Marketing Manager", agentName: "Content Brief Generator", description: "Generates detailed content briefs with SEO keywords, tone, and structure.", capabilities: ["content-strategy","seo","brief-generation"] },
  { domain: "Marketing Manager", agentName: "Competitor Monitor", description: "Monitors competitor campaigns, messaging, and market positioning.", capabilities: ["competitive-intelligence","market-monitoring","brand-analysis"] },
  { domain: "Marketing Manager", agentName: "Social Sentiment Tracker", description: "Tracks brand sentiment across social platforms with trend alerts.", capabilities: ["social-listening","sentiment-analysis","brand-monitoring"] },
  { domain: "Marketing Manager", agentName: "Email Campaign Optimizer", description: "Optimises email subject lines, send times, and segmentation for higher open rates.", capabilities: ["email-marketing","a-b-testing","conversion-optimization"] },
];

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);

  // Get owner user ID
  const [users] = await conn.execute("SELECT id FROM users LIMIT 1");
  const ownerId = users[0]?.id;
  if (!ownerId) { console.error("No user found"); process.exit(1); }

  let inserted = 0;
  for (const agent of AGENTS) {
    try {
      const [res] = await conn.execute(
        `INSERT INTO agents (ownerId, agentName, developerName, description, capabilities, endpointUrl, averageLatency, pricingModel, status, connectionTested, domain, isBuiltIn, isCustom, version)
         VALUES (?, ?, 'AgenThinkMesh Platform', ?, ?, 'https://mesh.agenthink.ai/agents/internal', 200, 'free', 'active', 1, ?, 1, 0, '1.0.0')`,
        [ownerId, agent.agentName, agent.description, JSON.stringify(agent.capabilities), agent.domain]
      );
      const agentId = res.insertId;
      await conn.execute(
        `INSERT INTO agent_metrics (agentId, tasksCompleted, successRate, avgLatency, errorRate) VALUES (?, ?, '95.00', 200, '1.00')
         ON DUPLICATE KEY UPDATE tasksCompleted=tasksCompleted`,
        [agentId, Math.floor(Math.random() * 500) + 50]
      );
      inserted++;
    } catch (e) {
      console.warn(`Skip ${agent.agentName}: ${e.message}`);
    }
  }

  await conn.end();
  console.log(`Seeded ${inserted} persona domain agents.`);
}

main().catch(console.error);
