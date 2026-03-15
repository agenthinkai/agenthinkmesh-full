import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
config();

const DOMAIN_AGENTS = [
  // Finance
  { domain: "Finance", agentName: "Deal Screener", description: "Screens inbound deals against investment thesis, flags top opportunities for partner review.", capabilities: ["deal-screening","vc-analysis","investment-thesis"] },
  { domain: "Finance", agentName: "Due Diligence", description: "Conducts comprehensive due diligence on target companies including financials, team, and market.", capabilities: ["due-diligence","financial-analysis","risk-assessment"] },
  { domain: "Finance", agentName: "Portfolio Monitor", description: "Monitors portfolio company KPIs, flags underperformers, and generates LP-ready updates.", capabilities: ["portfolio-monitoring","kpi-tracking","lp-reporting"] },
  { domain: "Finance", agentName: "LP Comms", description: "Drafts investor communications, quarterly reports, and capital call notices.", capabilities: ["investor-relations","report-writing","capital-calls"] },
  { domain: "Finance", agentName: "Valuation", description: "Builds DCF models, comparable company analysis, and precedent transaction valuations.", capabilities: ["valuation","dcf-modeling","comparable-analysis"] },
  { domain: "Finance", agentName: "Exit Modeler", description: "Models exit scenarios, IRR projections, and distribution waterfall calculations.", capabilities: ["exit-modeling","irr-analysis","waterfall-calculation"] },
  // Legal
  { domain: "Legal", agentName: "Contract Review", description: "Reviews contracts for liability exposure, non-standard clauses, and risk flags.", capabilities: ["contract-review","liability-analysis","clause-extraction"] },
  { domain: "Legal", agentName: "Clause Extractor", description: "Extracts and categorises key clauses from legal documents with structured output.", capabilities: ["clause-extraction","document-parsing","legal-analysis"] },
  { domain: "Legal", agentName: "Risk Flagger", description: "Identifies and prioritises legal risks across contracts, regulations, and jurisdictions.", capabilities: ["risk-flagging","legal-risk","compliance"] },
  { domain: "Legal", agentName: "Jurisdiction Intel", description: "Provides regulatory intelligence across GCC and international jurisdictions.", capabilities: ["jurisdiction-analysis","regulatory-intel","cross-border-law"] },
  { domain: "Legal", agentName: "Draft Gen", description: "Generates first-draft legal documents, NDAs, term sheets, and standard agreements.", capabilities: ["document-drafting","legal-writing","template-generation"] },
  { domain: "Legal", agentName: "Redline", description: "Produces tracked-changes redlines comparing contract versions with commentary.", capabilities: ["redlining","contract-comparison","version-tracking"] },
  // Healthcare
  { domain: "Healthcare", agentName: "Bed Manager", description: "Analyses bed occupancy data and generates staffing and capacity optimisation reports.", capabilities: ["bed-management","capacity-planning","hospital-ops"] },
  { domain: "Healthcare", agentName: "Staffing Optimizer", description: "Optimises shift schedules, identifies staffing gaps, and forecasts demand.", capabilities: ["staffing","scheduling","workforce-planning"] },
  { domain: "Healthcare", agentName: "Patient Flow", description: "Maps patient pathways, identifies bottlenecks, and recommends flow improvements.", capabilities: ["patient-flow","pathway-analysis","throughput"] },
  { domain: "Healthcare", agentName: "Cost Analyzer", description: "Analyses departmental costs, benchmarks against peers, and flags inefficiencies.", capabilities: ["cost-analysis","financial-benchmarking","healthcare-finance"] },
  { domain: "Healthcare", agentName: "Safety Monitor", description: "Monitors safety incidents, adverse events, and compliance with clinical protocols.", capabilities: ["safety-monitoring","incident-tracking","clinical-compliance"] },
  { domain: "Healthcare", agentName: "Report Gen", description: "Generates structured clinical and operational reports from raw data inputs.", capabilities: ["report-generation","clinical-documentation","data-synthesis"] },
  // Enterprise
  { domain: "Enterprise", agentName: "Talent Screener", description: "Screens CVs against job requirements, ranks candidates, and flags top matches.", capabilities: ["talent-screening","cv-analysis","recruitment"] },
  { domain: "Enterprise", agentName: "Vendor Screener", description: "Evaluates vendor proposals, checks compliance, and scores against procurement criteria.", capabilities: ["vendor-screening","procurement","supplier-evaluation"] },
  { domain: "Enterprise", agentName: "Process Monitor", description: "Monitors operational processes, identifies bottlenecks, and recommends improvements.", capabilities: ["process-monitoring","operations","efficiency-analysis"] },
  { domain: "Enterprise", agentName: "KPI Tracker", description: "Tracks KPIs against targets, generates variance reports, and flags at-risk metrics.", capabilities: ["kpi-tracking","performance-management","reporting"] },
  { domain: "Enterprise", agentName: "Resource Planner", description: "Plans resource allocation across projects, teams, and time horizons.", capabilities: ["resource-planning","capacity-management","project-ops"] },
  { domain: "Enterprise", agentName: "SLA Monitor", description: "Monitors service level agreements, flags breaches, and generates compliance reports.", capabilities: ["sla-monitoring","compliance","service-management"] },
  // GCC Wealth
  { domain: "GCC Wealth", agentName: "Client Profiler", description: "Builds comprehensive HNWI client profiles including risk appetite, goals, and Shariah preferences.", capabilities: ["client-profiling","hnwi","wealth-management"] },
  { domain: "GCC Wealth", agentName: "Suitability Checker", description: "Checks investment suitability against client profile, risk tolerance, and Shariah compliance.", capabilities: ["suitability-check","shariah-compliance","investment-suitability"] },
  { domain: "GCC Wealth", agentName: "Portfolio Builder", description: "Constructs diversified portfolios aligned with client goals and GCC market conditions.", capabilities: ["portfolio-construction","asset-allocation","gcc-markets"] },
  { domain: "GCC Wealth", agentName: "Deal Originator", description: "Identifies and sources deal opportunities for family offices and private wealth clients.", capabilities: ["deal-origination","private-equity","family-office"] },
  { domain: "GCC Wealth", agentName: "Asset Allocator", description: "Optimises asset allocation across classes including sukuk, equities, and real assets.", capabilities: ["asset-allocation","sukuk","alternative-investments"] },
  { domain: "GCC Wealth", agentName: "Investor Matcher", description: "Matches investment opportunities with suitable investors based on profile and mandate.", capabilities: ["investor-matching","deal-flow","mandate-analysis"] },
];

async function seed() {
  const conn = await createConnection(process.env.DATABASE_URL);
  
  // Get the first user (owner) as ownerId
  const [users] = await conn.execute("SELECT id FROM users ORDER BY id LIMIT 1");
  const ownerId = users[0]?.id ?? 1;
  
  // Check how many built-in agents already exist
  const [existing] = await conn.execute("SELECT COUNT(*) as cnt FROM agents WHERE isBuiltIn = 1");
  if (existing[0].cnt > 0) {
    console.log(`Already have ${existing[0].cnt} built-in agents, skipping seed.`);
    await conn.end();
    return;
  }
  
  let inserted = 0;
  for (const agent of DOMAIN_AGENTS) {
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
  }
  
  console.log(`Seeded ${inserted} built-in domain agents.`);
  await conn.end();
}

seed().catch(console.error);
