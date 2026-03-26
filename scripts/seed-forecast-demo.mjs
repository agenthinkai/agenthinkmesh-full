/**
 * ForecastMesh Demo Data Seeder
 * Seeds 8 enterprise GCC scenarios with 10-12 history entries each,
 * agent inputs, triggers, and recommended actions.
 * Idempotent — skips if already seeded (isSeeded flag).
 */

import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
function uuid() { return randomUUID(); }

function buildHistory(startProb, days, volatility = 0.04) {
  const entries = [];
  let prob = startProb;
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    const ts = new Date(now - i * 24 * 60 * 60 * 1000);
    const delta = (Math.random() - 0.48) * volatility;
    prob = Math.max(0.05, Math.min(0.97, prob + delta));
    entries.push({ ts, prob: parseFloat(prob.toFixed(4)) });
  }
  return entries;
}

// ─── Demo Scenarios ─────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    title: "Al Nakheel Logistics — Kuwait MOD Contract Renewal",
    forecastType: "target_probability",
    question: "Will Al Nakheel retain the Ministry of Defence logistics framework contract (KWD 4.2M/yr) expiring in 90 days?",
    description: "Incumbent advantage vs. price pressure from Agility. Three competing bids submitted. Kuwait Tenders Law 15% preference for Kuwaiti companies applies.",
    businessArea: "Government Contracts",
    status: "watchlist",
    currentProbability: 0.6200,
    confidenceScore: 0.7800,
    startProb: 0.71, historyDays: 45, historyVolatility: 0.035,
    deadline: new Date(Date.now() + 90 * 86400000),
    agents: [
      { agentName: "Deal Screener", agentRole: "Contract Risk Analyst", probabilityEstimate: 0.65, confidence: 0.81, upwardForces: JSON.stringify(["7-year incumbent with zero SLA breaches","Kuwait Tenders Law 15% Kuwaiti company preference","Strong MOD end-user relationships"]), downwardForces: JSON.stringify(["Agility bid estimated 12% lower","New MOD procurement head since Q4 2024","Price-competitive rebid environment"]), summary: "Incumbent advantage is strong but new procurement leadership introduces uncertainty. The 15% Kuwaiti preference clause effectively neutralises Agility's price advantage if Al Nakheel maintains satisfactory performance rating.", recommendedActions: JSON.stringify(["Submit formal 7-year SLA performance dossier to MOD","Invoke Tenders Law Art. 42 preference clause formally","Arrange meeting with new MOD procurement director"]) },
      { agentName: "Legal Reviewer", agentRole: "Contract Compliance Agent", probabilityEstimate: 0.68, confidence: 0.74, upwardForces: JSON.stringify(["15% Kuwaiti company preference under Law No. 49/2016","Zero SLA breach record qualifies for satisfactory rating"]), downwardForces: JSON.stringify(["Satisfactory rating must be formally confirmed by MOD","Incumbent preference clause is discretionary"]), summary: "Kuwait Government Tenders Law provides meaningful protection. Key action: ensure satisfactory performance rating is formally on file before evaluation begins.", recommendedActions: JSON.stringify(["File formal satisfactory performance confirmation with MOD","Engage Kuwait Tenders Authority on preference clause application"]) },
    ],
    triggers: [
      { triggerType: "probability_drop", threshold: 0.50, description: "Probability drops below 50% — escalate to IC for contract loss contingency planning", actionsTaken: JSON.stringify(["Initiate contingency revenue plan","Identify MOH and MEW as replacement clients"]) },
      { triggerType: "deadline_approaching", threshold: 0.30, description: "30 days to contract expiry — final negotiation window", actionsTaken: JSON.stringify(["Submit best and final offer","Request direct meeting with MOD procurement committee"]) },
    ],
  },
  {
    title: "Rawabi Medical Centers — NHIF Privatisation Contract",
    forecastType: "target_probability",
    question: "Will Rawabi Medical Centers secure an NHIF-accredited outpatient network contract under Saudi healthcare privatisation?",
    description: "20 contracts to be awarded in H1 2025. Rawabi has 11 branches, pre-qualified. Critical path: CBAHI certification for 4 uncertified branches and EMR system deployment.",
    businessArea: "Healthcare",
    status: "on_track",
    currentProbability: 0.7400,
    confidenceScore: 0.8200,
    startProb: 0.55, historyDays: 52, historyVolatility: 0.04,
    deadline: new Date(Date.now() + 120 * 86400000),
    agents: [
      { agentName: "Deal Screener", agentRole: "Healthcare Sector Analyst", probabilityEstimate: 0.76, confidence: 0.83, upwardForces: JSON.stringify(["11 branches in priority NHIF catchment areas","18% EBITDA above 15% NHIF minimum","Al-Rajhi family office backing provides financial credibility"]), downwardForces: JSON.stringify(["Legacy EMR system — NHIF mandates integrated EMR by Q3 2025","4 of 11 branches lack CBAHI certification"]), summary: "Rawabi is well-positioned but faces two critical path items: CBAHI certification for 4 branches and EMR system deployment. Both are achievable within the timeline if actioned immediately.", recommendedActions: JSON.stringify(["Submit CBAHI applications for 4 uncertified branches immediately","Procure NHIF-compliant EMR system within 30 days","Arrange SAR 15M working capital facility for NHIF payment cycles"]) },
      { agentName: "Insurance Agent", agentRole: "Healthcare Reimbursement Analyst", probabilityEstimate: 0.72, confidence: 0.77, upwardForces: JSON.stringify(["SAR 280-420 per visit NHIF tariff for chronic disease","60-84% revenue uplift potential"]), downwardForces: JSON.stringify(["90-120 day NHIF payment cycles require SAR 15M working capital","NHIF reimbursement disputes average 8% of claims"]), summary: "NHIF revenue potential is transformational but working capital requirement is significant. Pre-arrange facility before contract award.", recommendedActions: JSON.stringify(["Approach NCB and Riyad Bank for SAR 15M working capital facility","Model NHIF payment cycle impact on cash flow"]) },
    ],
    triggers: [
      { triggerType: "deadline_approaching", threshold: 0.60, description: "CBAHI certification deadline approaching — 4 branches still uncertified", actionsTaken: JSON.stringify(["Escalate to NHIF relationship manager for conditional accreditation","Engage CBAHI for expedited review"]) },
      { triggerType: "probability_drop", threshold: 0.55, description: "Probability drops below 55% — review CBAHI and EMR status", actionsTaken: JSON.stringify(["Emergency review of critical path items","Assess whether timeline extension is possible"]) },
    ],
  },
  {
    title: "Gulf Star Food Industries — Ramadan 2025 Revenue Target",
    forecastType: "target_probability",
    question: "Will Gulf Star achieve SAR 28M revenue target in Ramadan 2025 season (March–April)?",
    description: "Driven by dates, gifting hampers, and Eid confectionery. LuLu Hypermarket and Carrefour KSA are primary channels. REDF rate increases have not impacted consumer goods demand.",
    businessArea: "Consumer Goods",
    status: "on_track",
    currentProbability: 0.8100,
    confidenceScore: 0.8800,
    startProb: 0.63, historyDays: 38, historyVolatility: 0.025,
    deadline: new Date(Date.now() + 45 * 86400000),
    agents: [
      { agentName: "Social Media Agent", agentRole: "Consumer Sentiment Analyst", probabilityEstimate: 0.84, confidence: 0.89, upwardForces: JSON.stringify(["4.2x engagement rate on Ramadan campaign","2.1M organic impressions week 1","40% more Carrefour KSA shelf space vs. Ramadan 2024","91% positive sentiment"]), downwardForces: JSON.stringify(["3 of 7 regional distributors unconfirmed","Packaging lead time risk (6 weeks)"]), summary: "Campaign is performing strongly. Carrefour expansion is confirmed. Main risks are regional distributor confirmation and packaging order timing.", recommendedActions: JSON.stringify(["Confirm 3 unconfirmed regional distributors this week","Confirm confectionery packaging order immediately","Set up daily sell-through monitoring from LuLu and Carrefour POS"]) },
      { agentName: "Deal Screener", agentRole: "Revenue Forecast Validator", probabilityEstimate: 0.79, confidence: 0.84, upwardForces: JSON.stringify(["18% YoY growth required vs historical 22%, 19%, 15%","Dates inventory 95% confirmed from Madinah suppliers"]), downwardForces: JSON.stringify(["Decelerating growth trend (22%→19%→15%)","Packaging lead time creates supply risk"]), summary: "Target is achievable but requires Carrefour expansion to fully materialise and regional distributor gaps to close. Growth trend deceleration is a structural concern for future seasons.", recommendedActions: JSON.stringify(["Activate 5% early-order discount for unconfirmed distributors","Prepare week-by-week sell-through dashboard"]) },
    ],
    triggers: [
      { triggerType: "probability_drop", threshold: 0.70, description: "Week 2 sell-through below 60% — activate promotional pricing", actionsTaken: JSON.stringify(["15% discount on hamper bundles at LuLu","Accelerate social media spend"]) },
      { triggerType: "status_worsened", threshold: 0.65, description: "Probability drops below 65% — revise revenue guidance", actionsTaken: JSON.stringify(["Notify CFO for Q1 cash flow revision","Assess distributor gap impact"]) },
    ],
  },
  {
    title: "Wajd Mobile — Zain Kuwait Host Agreement Renewal",
    forecastType: "target_probability",
    question: "Will Wajd Mobile renew its MVNO host agreement with Zain Kuwait on commercially viable terms (rate increase <15%)?",
    description: "Current agreement expires in 6 months. Zain has signalled 18–22% wholesale rate increase. Wajd has 340K active subscribers. Ooredoo Kuwait is a viable alternative host.",
    businessArea: "Telecom / MVNO",
    status: "watchlist",
    currentProbability: 0.5800,
    confidenceScore: 0.7100,
    startProb: 0.72, historyDays: 60, historyVolatility: 0.045,
    deadline: new Date(Date.now() + 180 * 86400000),
    agents: [
      { agentName: "MVNO Intel", agentRole: "MVNO Strategy Analyst", probabilityEstimate: 0.55, confidence: 0.76, upwardForces: JSON.stringify(["KWD 8.5M annual wholesale revenue gives Wajd negotiating leverage","Ooredoo Kuwait alternative creates credible BATNA","CITRA regulatory backstop for >15% rate increases"]), downwardForces: JSON.stringify(["Zain launched competing youth sub-brand Q4 2024","Margin compression to 6-8% at proposed rates","Zain views Wajd as direct competitor in 18-30 segment"]), summary: "Zain's strategic interest in the youth segment has fundamentally changed the negotiating dynamic. The Ooredoo alternative is real and must be actively pursued as leverage, not just a fallback.", recommendedActions: JSON.stringify(["Initiate Ooredoo Kuwait MVNO host discussions immediately","File CITRA pre-emptive inquiry on rate increase","Prepare 3-year commitment counter-proposal for Zain"]) },
      { agentName: "Legal Reviewer", agentRole: "Telecom Regulatory Agent", probabilityEstimate: 0.62, confidence: 0.68, upwardForces: JSON.stringify(["CITRA requires notification for rate increases >15%","Regulatory review creates 30-day backstop"]), downwardForces: JSON.stringify(["CITRA review is advisory not binding","Ooredoo host transition takes 6-9 months"]), summary: "CITRA regulatory backstop is meaningful but not decisive. File inquiry immediately to create negotiating space.", recommendedActions: JSON.stringify(["Submit CITRA inquiry within 7 days","Prepare subscriber migration plan as contingency"]) },
    ],
    triggers: [
      { triggerType: "probability_drop", threshold: 0.45, description: "Probability drops below 45% — begin subscriber migration planning", actionsTaken: JSON.stringify(["Initiate Ooredoo host agreement negotiations","Prepare subscriber communication strategy"]) },
      { triggerType: "low_confidence", threshold: 0.60, description: "Confidence drops below 60% — escalate to board", actionsTaken: JSON.stringify(["Board briefing on MVNO host risk","Authorise Ooredoo negotiations"]) },
    ],
  },
  {
    title: "Khaleeji Insurance — ADGM Parametric Product Approval",
    forecastType: "target_probability",
    question: "Will Khaleeji Insurance receive ADGM FSRA approval for its parametric weather insurance product within 4 weeks?",
    description: "Application submitted 8 weeks ago. Product targets UAE agricultural and event sectors. Data gap waiver request submitted (7 vs 10 years of historical weather data required).",
    businessArea: "Insurance",
    status: "on_track",
    currentProbability: 0.6900,
    confidenceScore: 0.7500,
    startProb: 0.50, historyDays: 56, historyVolatility: 0.03,
    deadline: new Date(Date.now() + 28 * 86400000),
    agents: [
      { agentName: "Insurance Agent", agentRole: "Regulatory Approval Analyst", probabilityEstimate: 0.71, confidence: 0.74, upwardForces: JSON.stringify(["3 precedent parametric approvals in 18 months","Product structure consistent with approved precedents","Thorough stress test submission"]), downwardForces: JSON.stringify(["7 vs 10 year data gap — waiver required","Waiver is discretionary"]), summary: "ADGM FSRA has established a clear precedent for parametric weather products. The data gap waiver is the key uncertainty — it has been granted twice before under similar circumstances.", recommendedActions: JSON.stringify(["Pre-sign conditional distribution agreements with event companies","Prepare product launch materials for immediate post-approval deployment","Secure reinsurance terms from Swiss Re or Munich Re"]) },
      { agentName: "Deal Screener", agentRole: "Market Opportunity Analyst", probabilityEstimate: 0.74, confidence: 0.81, upwardForces: JSON.stringify(["AED 180M event insurance market growing 22%","First-mover in ADGM-regulated parametric event insurance","Zero claims disputes (trigger-based payout)"]), downwardForces: JSON.stringify(["Approval timeline uncertainty","Reinsurance terms not yet secured"]), summary: "Market opportunity is compelling. First-mover advantage in ADGM parametric event insurance is significant — act immediately post-approval to lock in distribution partnerships.", recommendedActions: JSON.stringify(["Approach Encore, Flash Entertainment, Indevr for distribution","Develop pricing calculator for event organisers"]) },
    ],
    triggers: [
      { triggerType: "deadline_approaching", threshold: 0.14, description: "FSRA decision due in 14 days — prepare for rapid launch", actionsTaken: JSON.stringify(["Finalise distribution agreements","Brief reinsurance partner on approval timeline"]) },
      { triggerType: "probability_drop", threshold: 0.50, description: "Probability drops below 50% — engage ADGM relationship manager", actionsTaken: JSON.stringify(["Request informal status update from FSRA","Assess whether additional information submission would help"]) },
    ],
  },
  {
    title: "Tamayuz Real Estate — Jeddah Waterfront Phase 2 Pre-Sales",
    forecastType: "target_probability",
    question: "Will Tamayuz achieve 65% pre-sales target for Jeddah Waterfront Phase 2 (240 units, SAR 1.1B GDV) before Q3 2025 construction commencement?",
    description: "REDF mortgage rate increase from 3.5% to 4.8% has softened mid-tier demand. Premium units (SAR 6M+) are 78% pre-sold. Mid-tier units (SAR 3.5–4.5M) are lagging.",
    businessArea: "Real Estate",
    status: "at_risk",
    currentProbability: 0.5300,
    confidenceScore: 0.6900,
    startProb: 0.68, historyDays: 42, historyVolatility: 0.05,
    deadline: new Date(Date.now() + 90 * 86400000),
    agents: [
      { agentName: "Deal Screener", agentRole: "Real Estate Demand Analyst", probabilityEstimate: 0.50, confidence: 0.73, upwardForces: JSON.stringify(["Premium units 78% pre-sold","Jeddah waterfront location premium","Vision 2030 entertainment district proximity"]), downwardForces: JSON.stringify(["REDF rate 3.5%→4.8% reduces purchasing power 14%","4 competing waterfront projects","Current tracking: 45-52% achievable without intervention"]), summary: "Target is at risk due to REDF rate environment. Sakani programme eligibility could restore mid-tier affordability. Without intervention, 45–52% is the realistic outcome.", recommendedActions: JSON.stringify(["Explore Sakani programme eligibility for Phase 2 units","Introduce 10/90 payment plan for mid-tier units","Consider delaying construction commencement if pre-sales remain below 55%"]) },
      { agentName: "Social Media Agent", agentRole: "Brand & Demand Analyst", probabilityEstimate: 0.56, confidence: 0.67, upwardForces: JSON.stringify(["Jeddah entertainment transformation is a strong content angle","Saudi expat return narrative resonates"]), downwardForces: JSON.stringify(["1.8% vs 3.2% industry benchmark engagement","Generic waterfront imagery not differentiating","4 competing projects with similar messaging"]), summary: "Campaign needs a strategic pivot. Lifestyle content showing Jeddah's entertainment transformation would differentiate from competitors and target the right buyer segment.", recommendedActions: JSON.stringify(["Pivot to Jeddah lifestyle content (F1, concerts, dining)","Target Saudi expats returning under Vision 2030","Increase Instagram and Snapchat spend for 25-40 segment"]) },
    ],
    triggers: [
      { triggerType: "probability_drop", threshold: 0.40, description: "Pre-sales drop below 40% — convene emergency board meeting on construction delay", actionsTaken: JSON.stringify(["Board meeting to consider Q3 commencement delay","Revise financial projections for delayed scenario"]) },
      { triggerType: "status_worsened", threshold: 0.45, description: "Status deteriorates to critical — activate all intervention measures", actionsTaken: JSON.stringify(["Activate Sakani programme application","Launch 10/90 payment plan","Increase marketing budget by SAR 5M"]) },
    ],
  },
  {
    title: "Boubyan Bank — Digital Banking Market Share Target",
    forecastType: "target_probability",
    question: "Will Boubyan Bank achieve 18% digital banking market share in Kuwait by end of 2025 (currently 14.2%)?",
    description: "Driven by app feature development and youth acquisition. Warba Bank's instant P2P feature has driven 40% YoY growth in the 18–30 segment. Boubyan needs a comparable feature.",
    businessArea: "Banking",
    status: "on_track",
    currentProbability: 0.6600,
    confidenceScore: 0.8000,
    startProb: 0.58, historyDays: 50, historyVolatility: 0.028,
    deadline: new Date(Date.now() + 270 * 86400000),
    agents: [
      { agentName: "MVNO Intel", agentRole: "Digital Adoption Analyst", probabilityEstimate: 0.64, confidence: 0.82, upwardForces: JSON.stringify(["4.6 App Store rating vs NBK 4.4","67% of Kuwait banking transactions are digital (CBK 2024)","AAOIFI-compliant positioning is a differentiator"]), downwardForces: JSON.stringify(["Warba Pay P2P feature driving 40% YoY youth growth","Current acquisition rate reaches only 16.8% by year-end","39% of registered users are inactive"]), summary: "Boubyan Pay P2P feature is the single highest-impact action. Without it, the 18% target is unlikely. With it, and an activation campaign for dormant users, the target becomes achievable.", recommendedActions: JSON.stringify(["Accelerate Boubyan Pay P2P launch to Q2 2025","Activate dormant user re-engagement campaign (KWD 5 cashback)","Launch AAOIFI-compliant digital product campaign"]) },
      { agentName: "Social Media Agent", agentRole: "Brand Sentiment Analyst", probabilityEstimate: 0.68, confidence: 0.74, upwardForces: JSON.stringify(["88% positive sentiment on Sharia-compliance messaging","Islamic banking narrative under-exploited in digital channels"]), downwardForces: JSON.stringify(["NBK and Warba have larger social media budgets","Youth segment is price-sensitive not brand-loyal"]), summary: "AAOIFI-compliant positioning is a genuine differentiator that Boubyan is not fully exploiting. A targeted Islamic digital banking campaign could capture the segment that conventional banks cannot serve.", recommendedActions: JSON.stringify(["Create AAOIFI-compliant digital product content series","Target 25-40 segment on Instagram and Snapchat","Highlight Sharia-compliant savings and investment products"]) },
    ],
    triggers: [
      { triggerType: "deadline_approaching", threshold: 0.50, description: "Mid-year review: on track for 18% target?", actionsTaken: JSON.stringify(["Review monthly acquisition rate vs target","Assess Boubyan Pay launch impact"]) },
      { triggerType: "probability_drop", threshold: 0.50, description: "Probability drops below 50% — increase marketing budget", actionsTaken: JSON.stringify(["Authorise SAR 8M incremental marketing spend","Accelerate Boubyan Pay launch timeline"]) },
    ],
  },
  {
    title: "Al Baraka Industrial — NEOM Supplier Qualification",
    forecastType: "target_probability",
    question: "Will Al Baraka Industrial qualify as an approved supplier for NEOM's THE LINE infrastructure phase (40 of 340 applicants selected)?",
    description: "Al Baraka specialises in structural steel fabrication. Meets ISO 9001:2015 and revenue thresholds. Gap: largest project reference is SAR 120M vs NEOM's SAR 200M minimum requirement.",
    businessArea: "Industrial / Construction",
    status: "watchlist",
    currentProbability: 0.4400,
    confidenceScore: 0.6500,
    startProb: 0.35, historyDays: 35, historyVolatility: 0.055,
    deadline: new Date(Date.now() + 60 * 86400000),
    agents: [
      { agentName: "Deal Screener", agentRole: "Industrial Sector Analyst", probabilityEstimate: 0.42, confidence: 0.70, upwardForces: JSON.stringify(["ISO 9001:2015 compliant","100% Saudi ownership (Vision 2030 localisation advantage)","Eastern Province logistics: 4-hour delivery to NEOM site"]), downwardForces: JSON.stringify(["SAR 120M largest project vs SAR 200M NEOM minimum","340 applicants for 40 spots (11.8% base rate)"]), summary: "The project reference gap is the critical disqualification risk. A consortium arrangement with a larger qualified contractor is the most viable path to meeting the SAR 200M requirement.", recommendedActions: JSON.stringify(["Approach Zamil Steel or Al Muhaidib for consortium arrangement","Prepare NEOM logistics advantage documentation","Monitor for NEOM supplier list expansion signals"]) },
      { agentName: "MVNO Intel", agentRole: "Supply Chain Intelligence Agent", probabilityEstimate: 0.47, confidence: 0.62, upwardForces: JSON.stringify(["3 approved suppliers delayed — NEOM may expand list","Eastern Province proximity is a genuine supply security advantage","NEOM structural steel shortage creates urgency"]), downwardForces: JSON.stringify(["List expansion is not confirmed","Consortium arrangement takes time to formalise"]), summary: "The supply chain disruption creates an opportunity. NEOM's need for supply security may override strict qualification criteria. The logistics advantage should be the centrepiece of the application.", recommendedActions: JSON.stringify(["Submit supplementary application emphasising supply security","Quantify logistics advantage formally","Track NEOM procurement announcements for list expansion signals"]) },
    ],
    triggers: [
      { triggerType: "status_worsened", threshold: 0.30, description: "Probability drops below 30% — focus resources on alternative NEOM sub-contract opportunities", actionsTaken: JSON.stringify(["Identify Tier 1 NEOM contractors who may sub-contract steel fabrication","Pivot from direct qualification to sub-contract strategy"]) },
      { triggerType: "probability_drop", threshold: 0.60, description: "Probability exceeds 60% — begin capacity expansion planning", actionsTaken: JSON.stringify(["Model 40% production increase requirement","Identify equipment and workforce needs"]) },
    ],
  },
];

// ─── Seeder ─────────────────────────────────────────────────────────────────
async function seed() {
  const [existing] = await conn.execute("SELECT COUNT(*) as cnt FROM forecasts WHERE isSeeded = 1");
  const count = existing[0].cnt;
  if (count >= 8) {
    console.log(`✓ ForecastMesh already seeded with ${count} demo scenarios. Skipping.`);
    await conn.end();
    return;
  }

  const [users] = await conn.execute("SELECT id FROM users LIMIT 1");
  if (!users.length) {
    console.error("No users found — sign in to AgenThinkMesh first, then re-run this seeder.");
    await conn.end();
    return;
  }
  const userId = users[0].id;
  console.log(`Seeding ForecastMesh demo data for userId=${userId}...`);

  let totalHistory = 0, totalAgents = 0, totalTriggers = 0;

  for (const s of SCENARIOS) {
    const forecastId = uuid();
    const history = buildHistory(s.startProb, s.historyDays, s.historyVolatility);

    // Insert forecast
    await conn.execute(
      `INSERT INTO forecasts
         (id, userId, title, forecastType, question, description, deadline, businessArea,
          currentProbability, confidenceScore, status, isSeeded, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [forecastId, userId, s.title, s.forecastType, s.question, s.description,
       s.deadline, s.businessArea, s.currentProbability, s.confidenceScore, s.status]
    );

    // Insert history entries
    let prevProb = s.startProb;
    for (const h of history) {
      const delta = parseFloat((h.prob - prevProb).toFixed(4));
      const eventType = Math.abs(delta) > 0.05 ? "agent_update" : "manual_update";
      await conn.execute(
        `INSERT INTO forecast_history
           (id, forecastId, probability, confidence, delta, cause, agentSource, eventType, recordedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), forecastId, h.prob, parseFloat((s.confidenceScore + (Math.random() - 0.5) * 0.1).toFixed(4)),
         delta, 'Market data update', 'System', eventType, h.ts]
      );
      prevProb = h.prob;
      totalHistory++;
    }

    // Insert agent inputs
    for (const a of s.agents) {
      await conn.execute(
        `INSERT INTO forecast_agents
           (id, forecastId, agentName, agentRole, probabilityEstimate, confidence,
            upwardForces, downwardForces, summary, recommendedActions, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [uuid(), forecastId, a.agentName, a.agentRole, a.probabilityEstimate, a.confidence,
         a.upwardForces, a.downwardForces, a.summary, a.recommendedActions]
      );
      totalAgents++;
    }

    // Insert triggers
    for (const t of s.triggers) {
      await conn.execute(
        `INSERT INTO forecast_triggers
           (id, forecastId, triggerType, threshold, description, actionsTaken, resolved)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [uuid(), forecastId, t.triggerType, t.threshold, t.description, t.actionsTaken]
      );
      totalTriggers++;
    }

    console.log(`  ✓ ${s.title}`);
  }

  console.log(`\n✅ ForecastMesh seeded: ${SCENARIOS.length} forecasts | ${totalHistory} history entries | ${totalAgents} agent inputs | ${totalTriggers} triggers`);
  await conn.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
