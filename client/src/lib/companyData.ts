// AgenThink Decision Twin — Core Data Layer
// All five companies: KEO, Zain, Warba, RWE, Tencent
// Six engines per company: Revenue, Margin, Geography, AI Impact, Pricing, Enterprise Value
// Five scenarios: Status Quo, AI-Augmented, Margin Compression, Growth Scenario, Competitive Threat

// ─── TYPE DEFINITIONS ───────────────────────────────────────────────────────

export type ScenarioKey =
  | "statusQuo"
  | "aiAugmented"
  | "marginCompression"
  | "growthScenario"
  | "competitiveThreat";

export interface EngineMetric {
  value: string | number;
  unit: string;
  delta: number;
}

export interface ScenarioEngines {
  revenue: EngineMetric;
  margin: EngineMetric;
  geography: EngineMetric;
  aiImpact: EngineMetric;
  pricing: EngineMetric;
  enterpriseValue: EngineMetric;
}

export interface ProjectionPoint {
  year: string;
  revenue: number;
  ebitda: number;
}

export interface ScenarioResult {
  engines: ScenarioEngines;
  projectionData: ProjectionPoint[];
  scenarioDescription: string;
}

export interface GrowthPathway {
  name: string;
  description: string;
  probability: number;
  valueCreation: string;
  historicalSupport: string;
  criticalAssumption: string;
}

export interface FailurePathway {
  name: string;
  description: string;
  probability: number;
  hiddenVariable: string;
  historicalPrecedent: string;
  earlyWarning: string;
}

export interface CriticalAssumption {
  name: string;
  description: string;
  confidence: number;
  isMostDangerous: boolean;
  failureConsequence: string;
  historicalFailure: string;
}

export interface CouncilMember {
  persona: string;
  role: string;
  verdict: "Support" | "Oppose" | "Neutral";
  analysis: string;
  keyConcern: string;
  confidence: number;
}

export interface EarlyWarningIndicator {
  name: string;
  status: "safe" | "watch" | "alert";
  description: string;
  frequency: string;
}

export interface ScenarioComparison {
  scenario: string;
  evChange: number;
}

export interface FinalRecommendation {
  verdict: string;
  text: string;
  confidence: number;
}

export interface Company {
  id: string;
  name: string;
  sector: string;
  geography: string;
  employees: string;
  description: string;
  dataYear: string;
  confidenceScore: number;
  baseMetrics: {
    revenue: number;
    revenueUnit: string;
    ebitdaMargin: number;
    enterpriseValue: number;
    evUnit: string;
  };
  scenarios: Record<ScenarioKey, ScenarioResult>;
  growthPathways: GrowthPathway[];
  failurePathways: FailurePathway[];
  criticalAssumptions: CriticalAssumption[];
  councilReview: CouncilMember[];
  earlyWarningIndicators: EarlyWarningIndicator[];
  scenarioComparison: ScenarioComparison[];
  finalRecommendation: FinalRecommendation;
}

// ─── KEO INTERNATIONAL CONSULTANTS ──────────────────────────────────────────

const keo: Company = {
  id: "keo",
  name: "KEO International Consultants",
  sector: "Engineering & Consulting",
  geography: "Middle East / Global",
  employees: "3,500+",
  description:
    "A leading multidisciplinary engineering and design consultancy operating across the GCC, MENA, and international markets. KEO competes on project delivery excellence, local knowledge, and integrated service offerings across architecture, engineering, and project management.",
  dataYear: "2024",
  confidenceScore: 72,
  baseMetrics: { revenue: 320, revenueUnit: "$M", ebitdaMargin: 12, enterpriseValue: 480, evUnit: "$M" },
  scenarios: {
    statusQuo: {
      scenarioDescription: "Current project pipeline maintained; GCC Vision 2030 projects drive moderate growth",
      engines: {
        revenue: { value: 320, unit: "$M", delta: 0 },
        margin: { value: 12, unit: "%", delta: 0 },
        geography: { value: 68, unit: "% GCC", delta: 0 },
        aiImpact: { value: 5, unit: "% efficiency gain", delta: 0 },
        pricing: { value: 100, unit: "index", delta: 0 },
        enterpriseValue: { value: 480, unit: "$M", delta: 0 },
      },
      projectionData: [
        { year: "2024", revenue: 320, ebitda: 38 },
        { year: "2025", revenue: 335, ebitda: 40 },
        { year: "2026", revenue: 350, ebitda: 42 },
        { year: "2027", revenue: 360, ebitda: 43 },
        { year: "2028", revenue: 372, ebitda: 45 },
      ],
    },
    aiAugmented: {
      scenarioDescription: "AI-driven design automation reduces delivery costs by 20%; wins larger contracts",
      engines: {
        revenue: { value: 385, unit: "$M", delta: 20 },
        margin: { value: 16, unit: "%", delta: 33 },
        geography: { value: 72, unit: "% GCC", delta: 6 },
        aiImpact: { value: 22, unit: "% efficiency gain", delta: 340 },
        pricing: { value: 112, unit: "index", delta: 12 },
        enterpriseValue: { value: 680, unit: "$M", delta: 42 },
      },
      projectionData: [
        { year: "2024", revenue: 320, ebitda: 38 },
        { year: "2025", revenue: 355, ebitda: 50 },
        { year: "2026", revenue: 370, ebitda: 59 },
        { year: "2027", revenue: 385, ebitda: 62 },
        { year: "2028", revenue: 410, ebitda: 66 },
      ],
    },
    marginCompression: {
      scenarioDescription: "Increased competition from global firms compresses fees; talent costs rise",
      engines: {
        revenue: { value: 310, unit: "$M", delta: -3 },
        margin: { value: 8, unit: "%", delta: -33 },
        geography: { value: 65, unit: "% GCC", delta: -4 },
        aiImpact: { value: 3, unit: "% efficiency gain", delta: -40 },
        pricing: { value: 92, unit: "index", delta: -8 },
        enterpriseValue: { value: 340, unit: "$M", delta: -29 },
      },
      projectionData: [
        { year: "2024", revenue: 320, ebitda: 38 },
        { year: "2025", revenue: 315, ebitda: 28 },
        { year: "2026", revenue: 310, ebitda: 25 },
        { year: "2027", revenue: 305, ebitda: 24 },
        { year: "2028", revenue: 300, ebitda: 24 },
      ],
    },
    growthScenario: {
      scenarioDescription: "Wins major Saudi giga-project packages; expands into Africa and South Asia",
      engines: {
        revenue: { value: 480, unit: "$M", delta: 50 },
        margin: { value: 14, unit: "%", delta: 17 },
        geography: { value: 58, unit: "% GCC", delta: -15 },
        aiImpact: { value: 12, unit: "% efficiency gain", delta: 140 },
        pricing: { value: 108, unit: "index", delta: 8 },
        enterpriseValue: { value: 820, unit: "$M", delta: 71 },
      },
      projectionData: [
        { year: "2024", revenue: 320, ebitda: 38 },
        { year: "2025", revenue: 370, ebitda: 48 },
        { year: "2026", revenue: 420, ebitda: 59 },
        { year: "2027", revenue: 455, ebitda: 64 },
        { year: "2028", revenue: 480, ebitda: 67 },
      ],
    },
    competitiveThreat: {
      scenarioDescription: "Global engineering giants enter GCC with aggressive pricing and AI tools",
      engines: {
        revenue: { value: 285, unit: "$M", delta: -11 },
        margin: { value: 7, unit: "%", delta: -42 },
        geography: { value: 60, unit: "% GCC", delta: -12 },
        aiImpact: { value: 2, unit: "% efficiency gain", delta: -60 },
        pricing: { value: 85, unit: "index", delta: -15 },
        enterpriseValue: { value: 290, unit: "$M", delta: -40 },
      },
      projectionData: [
        { year: "2024", revenue: 320, ebitda: 38 },
        { year: "2025", revenue: 305, ebitda: 25 },
        { year: "2026", revenue: 295, ebitda: 21 },
        { year: "2027", revenue: 285, ebitda: 20 },
        { year: "2028", revenue: 278, ebitda: 19 },
      ],
    },
  },
  growthPathways: [
    {
      name: "Saudi Giga-Project Capture",
      description: "NEOM, Red Sea Project, and Diriyah Gate collectively represent over $500B in construction. KEO's established Saudi presence and multidisciplinary capability positions it to win integrated packages.",
      probability: 58,
      valueCreation: "Revenue uplift of $80–120M over 3 years; margin expansion from scale",
      historicalSupport: "KEO has delivered major projects in KSA including KAFD; regional firms with local presence have won 40–60% of Vision 2030 packages",
      criticalAssumption: "Saudi Vision 2030 timelines remain on track and KEO maintains competitive fee structures against global giants",
    },
    {
      name: "AI-Augmented Design Delivery",
      description: "Deploying generative AI and BIM automation to reduce design iteration cycles by 30–40%, enabling faster project delivery and higher margin on fixed-fee contracts.",
      probability: 45,
      valueCreation: "Margin expansion of 3–5 percentage points; competitive differentiation on speed",
      historicalSupport: "Arup and WSP have demonstrated 25–35% productivity gains from AI-assisted design; early movers capture premium pricing",
      criticalAssumption: "KEO can attract and retain AI-capable talent in a competitive GCC market",
    },
    {
      name: "Africa & South Asia Expansion",
      description: "Leveraging GCC client relationships to follow infrastructure investment flows into East Africa and South Asia, where KEO's Islamic finance expertise creates differentiation.",
      probability: 32,
      valueCreation: "New revenue stream of $40–60M by 2028; geographic diversification reduces GCC concentration risk",
      historicalSupport: "AECOM and Arcadis have successfully followed Gulf sovereign wealth into Africa; KEO has existing relationships with GCC development finance institutions",
      criticalAssumption: "Political stability in target markets and successful local partnership formation",
    },
  ],
  failurePathways: [
    {
      name: "Key Account Concentration Collapse",
      description: "KEO's revenue is concentrated in a small number of large GCC clients. Loss of one or two anchor relationships could trigger a 25–35% revenue decline within 12 months.",
      probability: 28,
      hiddenVariable: "Relationship dependency on individual champions within client organizations",
      historicalPrecedent: "Parsons lost 40% of its GCC revenue in 2016 when a key Saudi client relationship deteriorated following a leadership change",
      earlyWarning: "Monitor client-level revenue concentration quarterly; flag if any single client exceeds 15% of revenue",
    },
    {
      name: "Talent Exodus to Competitors",
      description: "Engineering talent in the GCC is highly mobile. A systematic poaching campaign by a global competitor could strip KEO of its project delivery capability within 18 months.",
      probability: 35,
      hiddenVariable: "Compensation gap between KEO and global firms has widened since 2022",
      historicalPrecedent: "Atkins lost 200+ engineers to AECOM in a 2019 GCC talent war; recovery took 3 years",
      earlyWarning: "Track voluntary attrition rate monthly; alert if it exceeds 12% annualized",
    },
    {
      name: "AI Disruption Without Adaptation",
      description: "If AI design tools commoditize traditional engineering services faster than KEO can adapt, fee pressure could compress margins to near zero on standard deliverables.",
      probability: 22,
      hiddenVariable: "Speed of AI adoption by clients who may bring design in-house",
      historicalPrecedent: "Kodak's film business collapsed 5 years faster than internal projections; digital disruption timelines are consistently underestimated",
      earlyWarning: "Track client RFP requirements for AI-native delivery; monitor competitor AI capability announcements",
    },
  ],
  criticalAssumptions: [
    {
      name: "GCC Infrastructure Spending Continuity",
      description: "KEO's entire growth thesis depends on GCC governments continuing to fund large-scale infrastructure projects at current or higher levels through 2030.",
      confidence: 68,
      isMostDangerous: false,
      failureConsequence: "30–40% revenue decline; potential insolvency if oil prices collapse below $50/barrel for 18+ months",
      historicalFailure: "2014–2016 oil price crash caused GCC project cancellations worth $200B; firms like KEO saw revenue drop 20–30%",
    },
    {
      name: "Competitive Moat from Local Knowledge",
      description: "KEO assumes its GCC relationships and local regulatory knowledge create a durable competitive advantage that global firms cannot easily replicate.",
      confidence: 55,
      isMostDangerous: true,
      failureConsequence: "Margin compression to 5–7%; loss of anchor client relationships; potential acquisition at distressed valuation",
      historicalFailure: "AECOM's aggressive GCC expansion in 2018–2020 eroded local firm advantages faster than predicted; several mid-size consultancies were acquired at 0.3–0.5x revenue",
    },
    {
      name: "Talent Retention at Current Compensation Levels",
      description: "KEO assumes it can retain key engineering talent without matching the compensation packages offered by global firms entering the GCC market.",
      confidence: 48,
      isMostDangerous: false,
      failureConsequence: "Project delivery failures; client relationship damage; 18–24 month recovery period",
      historicalFailure: "Atkins GCC division lost 15% of senior staff in 2019 to AECOM; project delays cost $30M in penalty clauses",
    },
  ],
  councilReview: [
    {
      persona: "The Value Investor",
      role: "Long-term capital allocator",
      verdict: "Neutral",
      analysis: "KEO trades at a reasonable multiple given its GCC exposure, but the concentration risk in Saudi Arabia and the lack of a clear AI strategy make it a hold rather than a buy. The Vision 2030 tailwind is real but priced in.",
      keyConcern: "No evidence of systematic AI capability building; risk of being disrupted from below by tech-enabled competitors",
      confidence: 62,
    },
    {
      persona: "The Activist Operator",
      role: "Operational efficiency specialist",
      verdict: "Support",
      analysis: "KEO has significant margin expansion opportunity through AI-augmented delivery. The 12% EBITDA margin is 4–6 points below global peers. A focused AI transformation program could close this gap within 3 years.",
      keyConcern: "Execution risk is high; AI transformation requires cultural change that engineering firms historically resist",
      confidence: 71,
    },
    {
      persona: "The Geopolitical Analyst",
      role: "Country risk and macro strategist",
      verdict: "Support",
      analysis: "GCC infrastructure spending is structurally supported by Vision 2030, Vision 2035, and similar national transformation programs. The oil price floor has risen due to OPEC+ discipline. KEO's geographic positioning is a genuine advantage.",
      keyConcern: "Regional instability risk remains non-trivial; a single major geopolitical event could freeze project pipelines for 12–18 months",
      confidence: 65,
    },
    {
      persona: "The Bear Case Analyst",
      role: "Adversarial stress-tester",
      verdict: "Oppose",
      analysis: "KEO's competitive moat is weaker than management believes. Global firms are investing heavily in GCC presence and AI capability simultaneously. The window to defend market position is closing faster than the board recognizes.",
      keyConcern: "The most dangerous assumption — that local knowledge creates durable advantage — has already been falsified in other professional services markets",
      confidence: 58,
    },
  ],
  earlyWarningIndicators: [
    { name: "Revenue Concentration", status: "watch", description: "Top 3 clients represent ~45% of revenue; above the 35% safe threshold", frequency: "Quarterly" },
    { name: "Staff Attrition Rate", status: "watch", description: "Voluntary attrition at 9.5% annualized; approaching 12% alert threshold", frequency: "Monthly" },
    { name: "AI Capability Index", status: "alert", description: "No formal AI strategy; competitors deploying AI tools in design delivery", frequency: "Semi-annual" },
    { name: "GCC Project Pipeline", status: "safe", description: "Vision 2030 pipeline remains strong; $1.2T in projects announced through 2030", frequency: "Quarterly" },
    { name: "Fee Rate Trend", status: "watch", description: "Average fee rates down 3% YoY; competitive pressure from global entrants", frequency: "Monthly" },
    { name: "Client Satisfaction Score", status: "safe", description: "NPS at 68; above industry average of 55 for engineering consultancies", frequency: "Semi-annual" },
  ],
  scenarioComparison: [
    { scenario: "Growth", evChange: 71 },
    { scenario: "AI-Aug", evChange: 42 },
    { scenario: "Status Quo", evChange: 0 },
    { scenario: "Margin Compress", evChange: -29 },
    { scenario: "Comp. Threat", evChange: -40 },
  ],
  finalRecommendation: {
    verdict: "Conditional Hold — Accelerate AI Strategy",
    text: "KEO is well-positioned to benefit from GCC infrastructure spending but faces a narrowing window to build AI capability before global competitors establish dominance. The board should commission a 90-day AI transformation roadmap and establish a dedicated innovation budget of $5–8M. Without this, the competitive moat will erode faster than current projections suggest.",
    confidence: 67,
  },
};

// ─── ZAIN GROUP ──────────────────────────────────────────────────────────────

const zain: Company = {
  id: "zain",
  name: "Zain Group",
  sector: "Telecommunications",
  geography: "GCC / MENA",
  employees: "7,200+",
  description:
    "A leading mobile telecommunications operator across 7 countries in the Middle East and Africa. Zain serves 48M+ customers and is navigating the transition from voice/data to digital services, fintech, and enterprise connectivity in markets with high smartphone penetration and young demographics.",
  dataYear: "2024",
  confidenceScore: 78,
  baseMetrics: { revenue: 1680, revenueUnit: "$M", ebitdaMargin: 42, enterpriseValue: 8200, evUnit: "$M" },
  scenarios: {
    statusQuo: {
      scenarioDescription: "Voice/data revenue stable; digital services growing at 15% annually from small base",
      engines: {
        revenue: { value: 1680, unit: "$M", delta: 0 },
        margin: { value: 42, unit: "%", delta: 0 },
        geography: { value: 7, unit: "markets", delta: 0 },
        aiImpact: { value: 8, unit: "% cost reduction", delta: 0 },
        pricing: { value: 100, unit: "ARPU index", delta: 0 },
        enterpriseValue: { value: 8200, unit: "$M", delta: 0 },
      },
      projectionData: [
        { year: "2024", revenue: 1680, ebitda: 706 },
        { year: "2025", revenue: 1720, ebitda: 722 },
        { year: "2026", revenue: 1760, ebitda: 739 },
        { year: "2027", revenue: 1800, ebitda: 756 },
        { year: "2028", revenue: 1840, ebitda: 773 },
      ],
    },
    aiAugmented: {
      scenarioDescription: "AI-driven network optimization and customer service automation; fintech acceleration",
      engines: {
        revenue: { value: 1920, unit: "$M", delta: 14 },
        margin: { value: 47, unit: "%", delta: 12 },
        geography: { value: 7, unit: "markets", delta: 0 },
        aiImpact: { value: 22, unit: "% cost reduction", delta: 175 },
        pricing: { value: 108, unit: "ARPU index", delta: 8 },
        enterpriseValue: { value: 10800, unit: "$M", delta: 32 },
      },
      projectionData: [
        { year: "2024", revenue: 1680, ebitda: 706 },
        { year: "2025", revenue: 1780, ebitda: 790 },
        { year: "2026", revenue: 1860, ebitda: 874 },
        { year: "2027", revenue: 1920, ebitda: 902 },
        { year: "2028", revenue: 2020, ebitda: 949 },
      ],
    },
    marginCompression: {
      scenarioDescription: "Regulatory price caps and OTT substitution compress ARPU; 5G capex weighs on margins",
      engines: {
        revenue: { value: 1580, unit: "$M", delta: -6 },
        margin: { value: 35, unit: "%", delta: -17 },
        geography: { value: 7, unit: "markets", delta: 0 },
        aiImpact: { value: 5, unit: "% cost reduction", delta: -38 },
        pricing: { value: 88, unit: "ARPU index", delta: -12 },
        enterpriseValue: { value: 6200, unit: "$M", delta: -24 },
      },
      projectionData: [
        { year: "2024", revenue: 1680, ebitda: 706 },
        { year: "2025", revenue: 1640, ebitda: 623 },
        { year: "2026", revenue: 1610, ebitda: 564 },
        { year: "2027", revenue: 1590, ebitda: 557 },
        { year: "2028", revenue: 1580, ebitda: 553 },
      ],
    },
    growthScenario: {
      scenarioDescription: "Zain Fintech achieves scale; enterprise 5G wins; new market entry in Egypt or Ethiopia",
      engines: {
        revenue: { value: 2200, unit: "$M", delta: 31 },
        margin: { value: 44, unit: "%", delta: 5 },
        geography: { value: 9, unit: "markets", delta: 29 },
        aiImpact: { value: 15, unit: "% cost reduction", delta: 88 },
        pricing: { value: 115, unit: "ARPU index", delta: 15 },
        enterpriseValue: { value: 13500, unit: "$M", delta: 65 },
      },
      projectionData: [
        { year: "2024", revenue: 1680, ebitda: 706 },
        { year: "2025", revenue: 1850, ebitda: 814 },
        { year: "2026", revenue: 2000, ebitda: 880 },
        { year: "2027", revenue: 2120, ebitda: 933 },
        { year: "2028", revenue: 2200, ebitda: 968 },
      ],
    },
    competitiveThreat: {
      scenarioDescription: "Starlink satellite internet disrupts mobile data in rural markets; STC expands aggressively",
      engines: {
        revenue: { value: 1450, unit: "$M", delta: -14 },
        margin: { value: 32, unit: "%", delta: -24 },
        geography: { value: 7, unit: "markets", delta: 0 },
        aiImpact: { value: 4, unit: "% cost reduction", delta: -50 },
        pricing: { value: 80, unit: "ARPU index", delta: -20 },
        enterpriseValue: { value: 5100, unit: "$M", delta: -38 },
      },
      projectionData: [
        { year: "2024", revenue: 1680, ebitda: 706 },
        { year: "2025", revenue: 1580, ebitda: 600 },
        { year: "2026", revenue: 1520, ebitda: 547 },
        { year: "2027", revenue: 1480, ebitda: 474 },
        { year: "2028", revenue: 1450, ebitda: 464 },
      ],
    },
  },
  growthPathways: [
    {
      name: "Zain Fintech Platform Scaling",
      description: "Zain Cash and digital financial services across 7 markets represent a $2B+ revenue opportunity. Mobile money penetration in Iraq, Sudan, and Jordan is still below 30%, creating a large addressable market.",
      probability: 52,
      valueCreation: "Fintech revenue of $200–400M by 2028; higher-margin than connectivity; EV re-rating to tech multiples",
      historicalSupport: "Safaricom's M-Pesa generated 40% of group revenue within 10 years; MTN MoMo achieved $1B+ revenue in 2023",
      criticalAssumption: "Regulatory approval for banking licenses in key markets; ability to build trust with unbanked populations",
    },
    {
      name: "Enterprise 5G & IoT Monetization",
      description: "GCC enterprise 5G adoption is accelerating. Zain's network infrastructure positions it to capture B2B connectivity, smart city, and industrial IoT contracts.",
      probability: 44,
      valueCreation: "Enterprise revenue growing to 25% of total from 15%; higher ARPU and lower churn than consumer",
      historicalSupport: "Telstra's enterprise segment generates 45% of revenue at 55% gross margin; GCC enterprise 5G RFPs accelerating in 2024",
      criticalAssumption: "5G rollout completion on schedule; enterprise sales capability build-out",
    },
    {
      name: "Africa Expansion via Acquisition",
      description: "Zain's existing Africa footprint (Sudan, South Sudan) and GCC investor relationships position it to acquire or partner in high-growth African telecom markets.",
      probability: 28,
      valueCreation: "Access to 500M+ addressable population; demographic dividend in mobile-first markets",
      historicalSupport: "MTN's Africa expansion generated 60% of group revenue by 2022; Airtel Africa IPO at 8x EV/EBITDA",
      criticalAssumption: "Regulatory approvals and political stability in target markets",
    },
  ],
  failurePathways: [
    {
      name: "Satellite Internet Disruption",
      description: "Starlink and competing LEO satellite services could capture 15–25% of Zain's rural mobile data customers within 3 years, particularly in markets with poor fixed broadband infrastructure.",
      probability: 38,
      hiddenVariable: "Speed of Starlink regulatory approval in MENA markets; pricing trajectory",
      historicalPrecedent: "Fixed-line operators lost 40% of revenue within 5 years of mobile disruption; disruption timelines are consistently underestimated",
      earlyWarning: "Monitor Starlink licensing applications in Zain's markets; track rural data ARPU trends quarterly",
    },
    {
      name: "Iraq Political Risk Crystallization",
      description: "Iraq represents ~35% of Zain's revenue. Political instability, currency devaluation, or regulatory changes could impair this critical market.",
      probability: 32,
      hiddenVariable: "Iraqi dinar stability and government telecom policy under current coalition",
      historicalPrecedent: "Zain Sudan revenue collapsed 60% in 2019 following political crisis; geographic concentration creates binary risk",
      earlyWarning: "Monitor Iraqi political stability indicators; track dinar/USD exchange rate monthly",
    },
    {
      name: "OTT Substitution Acceleration",
      description: "WhatsApp, Telegram, and other OTT platforms continue to erode voice and SMS revenue. If data ARPU doesn't compensate, total ARPU could decline 15–20% by 2027.",
      probability: 45,
      hiddenVariable: "Pace of 5G-enabled new service monetization vs. legacy revenue decline",
      historicalPrecedent: "European telcos lost 30–40% of voice/SMS revenue to OTT between 2012–2020; ARPU recovery through data was slower than projected",
      earlyWarning: "Track voice/SMS revenue as % of total monthly; alert if declining faster than 8% annually",
    },
  ],
  criticalAssumptions: [
    {
      name: "Iraq Market Stability",
      description: "Zain's financial model assumes Iraq continues to generate stable, remittable cash flows representing ~35% of group revenue.",
      confidence: 58,
      isMostDangerous: true,
      failureConsequence: "Group revenue decline of 30–35%; potential covenant breach; credit rating downgrade",
      historicalFailure: "Zain Sudan impairment of $1.1B in 2020 following political crisis; single-market concentration has destroyed value repeatedly in MENA telcos",
    },
    {
      name: "5G Investment Returns",
      description: "Zain assumes its $2B+ 5G capex program will generate sufficient ARPU uplift to justify the investment within 5 years.",
      confidence: 52,
      isMostDangerous: false,
      failureConsequence: "Free cash flow destruction for 3–4 years; dividend sustainability at risk",
      historicalFailure: "European telcos invested $150B+ in 4G with average ARPU recovery of only 40% of projected; 5G ROI timelines are being revised downward",
    },
    {
      name: "Fintech Regulatory Pathway",
      description: "Zain assumes it will receive banking licenses or fintech operating permits in its key markets to scale Zain Cash into a full financial services platform.",
      confidence: 61,
      isMostDangerous: false,
      failureConsequence: "Fintech revenue capped at $50–80M vs. $300M+ potential; EV re-rating opportunity lost",
      historicalFailure: "Telecom-led fintech in Pakistan and Bangladesh faced 3–5 year regulatory delays; M-Pesa Kenya succeeded partly due to unique regulatory environment",
    },
  ],
  councilReview: [
    {
      persona: "The Emerging Markets Specialist",
      role: "MENA telecom sector expert",
      verdict: "Support",
      analysis: "Zain is undervalued relative to its fintech optionality. The market is pricing Zain as a pure connectivity play, but Zain Cash has the potential to re-rate the stock to a fintech multiple within 3–5 years. The Iraq risk is real but manageable.",
      keyConcern: "Execution risk on fintech: Zain needs to hire 200+ fintech-native talent and build a product culture that is foreign to telco DNA",
      confidence: 72,
    },
    {
      persona: "The Credit Analyst",
      role: "Fixed income and leverage specialist",
      verdict: "Neutral",
      analysis: "Zain's balance sheet is adequate but not strong. The 5G capex program will stress free cash flow for 2–3 years. Dividend coverage is thin. A single market shock (Iraq) could trigger a credit event.",
      keyConcern: "Net debt/EBITDA approaching 2.5x; limited headroom for acquisition-led growth without equity issuance",
      confidence: 68,
    },
    {
      persona: "The Technology Disruptor",
      role: "Digital transformation and competitive dynamics",
      verdict: "Oppose",
      analysis: "Zain is fighting the last war. The real threat is not STC or Ooredoo — it is Starlink, WhatsApp, and the gradual irrelevance of the telco layer. Zain needs a radical transformation, not an incremental fintech overlay.",
      keyConcern: "No evidence of strategic response to satellite internet threat; management team is telco-native without digital transformation experience",
      confidence: 55,
    },
    {
      persona: "The ESG Investor",
      role: "Sustainability and governance analyst",
      verdict: "Support",
      analysis: "Zain's digital inclusion mission in underserved MENA markets aligns with growing ESG capital flows. The fintech play specifically addresses financial inclusion, which attracts development finance institution co-investment.",
      keyConcern: "Governance quality varies significantly across Zain's 7 markets; Sudan and South Sudan operations carry reputational risk",
      confidence: 60,
    },
  ],
  earlyWarningIndicators: [
    { name: "Iraq Revenue Trend", status: "watch", description: "Iraq ARPU down 4% YoY; political uncertainty affecting consumer spending", frequency: "Monthly" },
    { name: "OTT Substitution Rate", status: "alert", description: "Voice revenue declining 11% YoY; faster than 8% alert threshold", frequency: "Monthly" },
    { name: "Zain Cash MAU Growth", status: "safe", description: "Monthly active users growing 28% YoY; on track for fintech scale", frequency: "Monthly" },
    { name: "5G Capex vs. Budget", status: "watch", description: "5G rollout 8% over budget; supply chain delays in 2 markets", frequency: "Quarterly" },
    { name: "Satellite Licensing Activity", status: "watch", description: "Starlink filed for licenses in Jordan and Kuwait; 18-month approval timeline", frequency: "Quarterly" },
    { name: "Net Promoter Score", status: "safe", description: "NPS at 52 across markets; above regional average of 44", frequency: "Semi-annual" },
  ],
  scenarioComparison: [
    { scenario: "Growth", evChange: 65 },
    { scenario: "AI-Aug", evChange: 32 },
    { scenario: "Status Quo", evChange: 0 },
    { scenario: "Margin Compress", evChange: -24 },
    { scenario: "Comp. Threat", evChange: -38 },
  ],
  finalRecommendation: {
    verdict: "Buy — with Iraq Risk Hedge",
    text: "Zain's fintech optionality is materially undervalued by the market. The stock offers a compelling risk/reward if Iraq remains stable. The board should accelerate Zain Cash commercialization, establish a dedicated enterprise 5G sales force, and develop a contingency plan for Iraq revenue disruption. The satellite internet threat requires a strategic response within 12 months.",
    confidence: 72,
  },
};

// ─── WARBA BANK ──────────────────────────────────────────────────────────────

const warba: Company = {
  id: "warba",
  name: "Warba Bank",
  sector: "Islamic Banking",
  geography: "Kuwait / GCC",
  employees: "1,200+",
  description:
    "Kuwait's youngest Islamic bank, established in 2010, with a focused retail and corporate banking franchise. Warba has grown rapidly through digital-first positioning and Sharia-compliant product innovation. The bank is navigating Kuwait's new mortgage law, GCC expansion, and the potential Gulf Bank merger.",
  dataYear: "2024",
  confidenceScore: 74,
  baseMetrics: { revenue: 280, revenueUnit: "$M", ebitdaMargin: 38, enterpriseValue: 1200, evUnit: "$M" },
  scenarios: {
    statusQuo: {
      scenarioDescription: "Organic growth continues; Kuwait mortgage law creates new retail opportunity",
      engines: {
        revenue: { value: 280, unit: "$M", delta: 0 },
        margin: { value: 38, unit: "%", delta: 0 },
        geography: { value: 85, unit: "% Kuwait", delta: 0 },
        aiImpact: { value: 6, unit: "% efficiency gain", delta: 0 },
        pricing: { value: 100, unit: "spread index", delta: 0 },
        enterpriseValue: { value: 1200, unit: "$M", delta: 0 },
      },
      projectionData: [
        { year: "2024", revenue: 280, ebitda: 106 },
        { year: "2025", revenue: 300, ebitda: 114 },
        { year: "2026", revenue: 320, ebitda: 122 },
        { year: "2027", revenue: 338, ebitda: 128 },
        { year: "2028", revenue: 355, ebitda: 135 },
      ],
    },
    aiAugmented: {
      scenarioDescription: "AI credit scoring and digital onboarding reduce cost-to-serve by 30%; fintech partnerships",
      engines: {
        revenue: { value: 330, unit: "$M", delta: 18 },
        margin: { value: 44, unit: "%", delta: 16 },
        geography: { value: 82, unit: "% Kuwait", delta: -4 },
        aiImpact: { value: 28, unit: "% efficiency gain", delta: 367 },
        pricing: { value: 106, unit: "spread index", delta: 6 },
        enterpriseValue: { value: 1750, unit: "$M", delta: 46 },
      },
      projectionData: [
        { year: "2024", revenue: 280, ebitda: 106 },
        { year: "2025", revenue: 305, ebitda: 128 },
        { year: "2026", revenue: 320, ebitda: 141 },
        { year: "2027", revenue: 330, ebitda: 145 },
        { year: "2028", revenue: 355, ebitda: 156 },
      ],
    },
    marginCompression: {
      scenarioDescription: "Rising funding costs and NPL normalization compress net profit margin",
      engines: {
        revenue: { value: 265, unit: "$M", delta: -5 },
        margin: { value: 30, unit: "%", delta: -21 },
        geography: { value: 85, unit: "% Kuwait", delta: 0 },
        aiImpact: { value: 4, unit: "% efficiency gain", delta: -33 },
        pricing: { value: 92, unit: "spread index", delta: -8 },
        enterpriseValue: { value: 950, unit: "$M", delta: -21 },
      },
      projectionData: [
        { year: "2024", revenue: 280, ebitda: 106 },
        { year: "2025", revenue: 272, ebitda: 90 },
        { year: "2026", revenue: 268, ebitda: 86 },
        { year: "2027", revenue: 265, ebitda: 80 },
        { year: "2028", revenue: 262, ebitda: 79 },
      ],
    },
    growthScenario: {
      scenarioDescription: "Gulf Bank merger creates #2 Islamic bank in Kuwait; GCC expansion accelerates",
      engines: {
        revenue: { value: 520, unit: "$M", delta: 86 },
        margin: { value: 40, unit: "%", delta: 5 },
        geography: { value: 70, unit: "% Kuwait", delta: -18 },
        aiImpact: { value: 14, unit: "% efficiency gain", delta: 133 },
        pricing: { value: 108, unit: "spread index", delta: 8 },
        enterpriseValue: { value: 2400, unit: "$M", delta: 100 },
      },
      projectionData: [
        { year: "2024", revenue: 280, ebitda: 106 },
        { year: "2025", revenue: 360, ebitda: 144 },
        { year: "2026", revenue: 440, ebitda: 176 },
        { year: "2027", revenue: 490, ebitda: 196 },
        { year: "2028", revenue: 520, ebitda: 208 },
      ],
    },
    competitiveThreat: {
      scenarioDescription: "KFH and Boubyan Bank accelerate digital transformation; neobank entry into Kuwait",
      engines: {
        revenue: { value: 248, unit: "$M", delta: -11 },
        margin: { value: 28, unit: "%", delta: -26 },
        geography: { value: 85, unit: "% Kuwait", delta: 0 },
        aiImpact: { value: 3, unit: "% efficiency gain", delta: -50 },
        pricing: { value: 85, unit: "spread index", delta: -15 },
        enterpriseValue: { value: 880, unit: "$M", delta: -27 },
      },
      projectionData: [
        { year: "2024", revenue: 280, ebitda: 106 },
        { year: "2025", revenue: 268, ebitda: 88 },
        { year: "2026", revenue: 258, ebitda: 77 },
        { year: "2027", revenue: 252, ebitda: 71 },
        { year: "2028", revenue: 248, ebitda: 69 },
      ],
    },
  },
  growthPathways: [
    {
      name: "Kuwait Mortgage Law Activation",
      description: "Kuwait's new mortgage law (2023) opens a $15B+ residential mortgage market. As an Islamic bank, Warba can offer Sharia-compliant Murabaha and Ijara home finance products to Kuwait's large expatriate and national population.",
      probability: 65,
      valueCreation: "Mortgage book of $1.5–2B by 2028; 15–20% of total financing portfolio; stable, long-duration assets",
      historicalSupport: "Dubai Islamic Bank grew mortgage book 40% in first 2 years after UAE mortgage law reform; Islamic mortgage penetration in GCC averages 25% of total mortgages",
      criticalAssumption: "Warba can build mortgage origination capability and compete on speed with established banks",
    },
    {
      name: "Gulf Bank Merger Execution",
      description: "A potential merger with Gulf Bank would create Kuwait's second-largest Islamic banking entity with combined assets of $12B+. Scale benefits include cost synergies of $40–60M and cross-selling opportunities.",
      probability: 35,
      valueCreation: "EV doubling to $2.4B; cost synergies of $40–60M; market share jump from 8% to 18%",
      historicalSupport: "GCC banking mergers have delivered 15–25% cost synergies; ADCB-Union National Bank merger created $70B asset bank with 20% synergy realization",
      criticalAssumption: "Regulatory approval from CBK; shareholder alignment on valuation; cultural integration success",
    },
    {
      name: "GCC Digital Banking Expansion",
      description: "Warba's digital-first model can be exported to Saudi Arabia and UAE, where Islamic banking demand is growing and digital banking licenses are available.",
      probability: 38,
      valueCreation: "New revenue stream of $50–80M by 2028; geographic diversification reduces Kuwait concentration",
      historicalSupport: "Boubyan Bank successfully entered Saudi Arabia digitally; Al Rajhi Bank's digital transformation increased customer acquisition by 60%",
      criticalAssumption: "Regulatory licensing approval in target markets; sufficient capital for expansion",
    },
  ],
  failurePathways: [
    {
      name: "NPL Normalization Shock",
      description: "Warba's NPL ratio has been artificially suppressed by government support programs during COVID. As these expire, NPLs could normalize to 4–6%, requiring significant provisioning.",
      probability: 42,
      hiddenVariable: "True credit quality of the SME and retail portfolio post-COVID support",
      historicalPrecedent: "Kuwaiti banks saw NPLs spike from 2% to 8% during the 2009 financial crisis; provisioning consumed 3 years of profits",
      earlyWarning: "Monitor Stage 2 loan migration quarterly; alert if Stage 2 exceeds 12% of total book",
    },
    {
      name: "Digital Disruption from Neobanks",
      description: "Global neobanks and regional fintech players (Liv, YAP, Wio) are targeting the GCC's young, mobile-first population. Warba's digital positioning may not be differentiated enough.",
      probability: 30,
      hiddenVariable: "Speed of neobank regulatory approval in Kuwait; customer switching behavior",
      historicalPrecedent: "Revolut captured 15% of UK under-35 banking relationships within 4 years; traditional banks underestimated switching costs",
      earlyWarning: "Track digital account opening rates vs. competitors monthly; monitor fintech licensing applications in Kuwait",
    },
    {
      name: "Funding Cost Spike",
      description: "Islamic banks fund through profit-sharing investment accounts (PSIAs) which are sensitive to rate expectations. A sustained high-rate environment could increase funding costs by 150–200bps.",
      probability: 35,
      hiddenVariable: "Duration mismatch between PSIA liabilities and financing assets",
      historicalPrecedent: "Kuwait Finance House saw funding costs rise 180bps in 2022–2023; net profit margin compressed 4 percentage points",
      earlyWarning: "Monitor PSIA renewal rates and competitor profit rates monthly; track net profit margin trend",
    },
  ],
  criticalAssumptions: [
    {
      name: "Asset Quality Stability",
      description: "Warba's growth strategy assumes its financing portfolio maintains NPL ratios below 2.5% and provisioning costs remain at current levels.",
      confidence: 58,
      isMostDangerous: true,
      failureConsequence: "Profit decline of 40–60%; potential capital raise; dividend suspension; management credibility damage",
      historicalFailure: "Warba Bank itself had to raise capital in 2016 following asset quality deterioration; Islamic banks in Kuwait have a history of NPL surprises",
    },
    {
      name: "Mortgage Law Implementation Speed",
      description: "Warba assumes the Kuwait mortgage law will be fully implemented and that mortgage origination infrastructure will be in place by 2025.",
      confidence: 62,
      isMostDangerous: false,
      failureConsequence: "Missed $1.5B+ mortgage opportunity; market share loss to faster-moving competitors",
      historicalFailure: "Saudi mortgage law took 3 years longer than expected to implement; banks that waited lost first-mover advantage to Al Rajhi",
    },
    {
      name: "Digital Banking Differentiation",
      description: "Warba assumes its digital banking capabilities create a sustainable competitive advantage over traditional Islamic banks and new neobank entrants.",
      confidence: 52,
      isMostDangerous: false,
      failureConsequence: "Customer acquisition cost increases; ARPU compression; loss of young customer segment",
      historicalFailure: "Multiple 'digital-first' banks have failed to sustain differentiation as incumbents upgraded their digital offerings; Monzo's UK market share plateaued at 4%",
    },
  ],
  councilReview: [
    {
      persona: "The Islamic Finance Expert",
      role: "Sharia-compliant banking specialist",
      verdict: "Support",
      analysis: "Warba's Sharia compliance infrastructure is genuinely differentiated. The mortgage law activation creates a once-in-a-decade opportunity for Islamic banks. Warba is better positioned than KFH to capture the digital-native segment of this market.",
      keyConcern: "Sharia board capacity to approve new products at the speed required for mortgage market entry",
      confidence: 74,
    },
    {
      persona: "The Credit Risk Officer",
      role: "Banking sector credit analyst",
      verdict: "Neutral",
      analysis: "The asset quality story is the key risk. Warba's rapid growth has been funded by PSIA deposits that are more rate-sensitive than conventional deposits. The combination of NPL normalization and funding cost pressure could compress ROE from 12% to 7% within 2 years.",
      keyConcern: "Concentration in SME financing; SME default rates in Kuwait historically 2x retail default rates",
      confidence: 65,
    },
    {
      persona: "The M&A Strategist",
      role: "Banking sector consolidation specialist",
      verdict: "Support",
      analysis: "The Gulf Bank merger, if executed well, would be transformative. Kuwait's banking sector is over-banked relative to GDP; consolidation is inevitable. Warba as the acquirer rather than the target is the preferred strategic position.",
      keyConcern: "Integration risk is high; Warba's culture is digital-first while Gulf Bank is traditional; talent retention post-merger is critical",
      confidence: 68,
    },
    {
      persona: "The Regulatory Analyst",
      role: "Central bank policy and compliance specialist",
      verdict: "Neutral",
      analysis: "CBK's regulatory stance on Islamic banking innovation is supportive but cautious. The mortgage law implementation will be slower than banks expect. Warba's GCC expansion plans face a 2–3 year regulatory runway in each market.",
      keyConcern: "Basel IV implementation in Kuwait will increase capital requirements by 15–20%; Warba's capital ratios are adequate but not comfortable",
      confidence: 70,
    },
  ],
  earlyWarningIndicators: [
    { name: "NPL Ratio", status: "safe", description: "NPL at 1.8%; below 2.5% alert threshold; Stage 2 migration stable", frequency: "Monthly" },
    { name: "Funding Cost Trend", status: "watch", description: "PSIA profit rates up 40bps YoY; approaching margin compression threshold", frequency: "Monthly" },
    { name: "Digital Acquisition Rate", status: "safe", description: "Digital onboarding growing 35% YoY; above target of 25%", frequency: "Monthly" },
    { name: "Capital Adequacy Ratio", status: "safe", description: "CAR at 17.2%; well above CBK minimum of 13%; comfortable buffer", frequency: "Quarterly" },
    { name: "Mortgage Pipeline", status: "watch", description: "Mortgage origination infrastructure 60% complete; behind 2025 target", frequency: "Monthly" },
    { name: "Merger Negotiation Status", status: "watch", description: "Gulf Bank merger discussions ongoing; regulatory pre-approval sought", frequency: "Quarterly" },
  ],
  scenarioComparison: [
    { scenario: "Growth", evChange: 100 },
    { scenario: "AI-Aug", evChange: 46 },
    { scenario: "Status Quo", evChange: 0 },
    { scenario: "Margin Compress", evChange: -21 },
    { scenario: "Comp. Threat", evChange: -27 },
  ],
  finalRecommendation: {
    verdict: "Buy — Mortgage Law Catalyst Imminent",
    text: "Warba Bank is at an inflection point. The Kuwait mortgage law creates a structural growth opportunity that will drive above-market loan growth for 3–5 years. The Gulf Bank merger optionality adds further upside. The key risk is asset quality normalization — the board should commission an independent portfolio review before the merger negotiations progress further.",
    confidence: 71,
  },
};

// ─── RWE AG ──────────────────────────────────────────────────────────────────

const rwe: Company = {
  id: "rwe",
  name: "RWE AG",
  sector: "Energy & Utilities",
  geography: "Germany / Europe / Global",
  employees: "35,000+",
  description:
    "One of Europe's largest electricity producers, undergoing a fundamental transformation from coal and nuclear to renewable energy. RWE has committed to investing €55B in renewables by 2030 and is building one of the world's largest offshore wind portfolios. The company faces the dual challenge of managing legacy asset decline while building a new energy future.",
  dataYear: "2024",
  confidenceScore: 81,
  baseMetrics: { revenue: 28500, revenueUnit: "$M", ebitdaMargin: 22, enterpriseValue: 42000, evUnit: "$M" },
  scenarios: {
    statusQuo: {
      scenarioDescription: "Renewable buildout on track; coal phase-out proceeds as planned; energy prices normalize",
      engines: {
        revenue: { value: 28500, unit: "$M", delta: 0 },
        margin: { value: 22, unit: "%", delta: 0 },
        geography: { value: 45, unit: "% Germany", delta: 0 },
        aiImpact: { value: 4, unit: "% efficiency gain", delta: 0 },
        pricing: { value: 100, unit: "power price index", delta: 0 },
        enterpriseValue: { value: 42000, unit: "$M", delta: 0 },
      },
      projectionData: [
        { year: "2024", revenue: 28500, ebitda: 6270 },
        { year: "2025", revenue: 29200, ebitda: 6424 },
        { year: "2026", revenue: 30100, ebitda: 6622 },
        { year: "2027", revenue: 31000, ebitda: 6820 },
        { year: "2028", revenue: 32000, ebitda: 7040 },
      ],
    },
    aiAugmented: {
      scenarioDescription: "AI-optimized grid management and predictive maintenance reduce opex by 15%",
      engines: {
        revenue: { value: 30200, unit: "$M", delta: 6 },
        margin: { value: 26, unit: "%", delta: 18 },
        geography: { value: 43, unit: "% Germany", delta: -4 },
        aiImpact: { value: 18, unit: "% efficiency gain", delta: 350 },
        pricing: { value: 104, unit: "power price index", delta: 4 },
        enterpriseValue: { value: 52000, unit: "$M", delta: 24 },
      },
      projectionData: [
        { year: "2024", revenue: 28500, ebitda: 6270 },
        { year: "2025", revenue: 29500, ebitda: 7375 },
        { year: "2026", revenue: 30200, ebitda: 7852 },
        { year: "2027", revenue: 31000, ebitda: 8060 },
        { year: "2028", revenue: 32200, ebitda: 8372 },
      ],
    },
    marginCompression: {
      scenarioDescription: "Renewable oversupply depresses power prices; rising interest rates increase capex cost",
      engines: {
        revenue: { value: 26800, unit: "$M", delta: -6 },
        margin: { value: 16, unit: "%", delta: -27 },
        geography: { value: 45, unit: "% Germany", delta: 0 },
        aiImpact: { value: 3, unit: "% efficiency gain", delta: -25 },
        pricing: { value: 85, unit: "power price index", delta: -15 },
        enterpriseValue: { value: 32000, unit: "$M", delta: -24 },
      },
      projectionData: [
        { year: "2024", revenue: 28500, ebitda: 6270 },
        { year: "2025", revenue: 27800, ebitda: 5004 },
        { year: "2026", revenue: 27200, ebitda: 4352 },
        { year: "2027", revenue: 26900, ebitda: 4304 },
        { year: "2028", revenue: 26800, ebitda: 4288 },
      ],
    },
    growthScenario: {
      scenarioDescription: "Offshore wind leadership; US IRA incentives drive North American expansion; hydrogen scale-up",
      engines: {
        revenue: { value: 38000, unit: "$M", delta: 33 },
        margin: { value: 25, unit: "%", delta: 14 },
        geography: { value: 35, unit: "% Germany", delta: -22 },
        aiImpact: { value: 12, unit: "% efficiency gain", delta: 200 },
        pricing: { value: 110, unit: "power price index", delta: 10 },
        enterpriseValue: { value: 68000, unit: "$M", delta: 62 },
      },
      projectionData: [
        { year: "2024", revenue: 28500, ebitda: 6270 },
        { year: "2025", revenue: 31000, ebitda: 7750 },
        { year: "2026", revenue: 34000, ebitda: 8500 },
        { year: "2027", revenue: 36500, ebitda: 9125 },
        { year: "2028", revenue: 38000, ebitda: 9500 },
      ],
    },
    competitiveThreat: {
      scenarioDescription: "Chinese solar/wind manufacturers undercut European renewable economics; policy reversal risk",
      engines: {
        revenue: { value: 25000, unit: "$M", delta: -12 },
        margin: { value: 14, unit: "%", delta: -36 },
        geography: { value: 48, unit: "% Germany", delta: 7 },
        aiImpact: { value: 2, unit: "% efficiency gain", delta: -50 },
        pricing: { value: 78, unit: "power price index", delta: -22 },
        enterpriseValue: { value: 28000, unit: "$M", delta: -33 },
      },
      projectionData: [
        { year: "2024", revenue: 28500, ebitda: 6270 },
        { year: "2025", revenue: 27000, ebitda: 4590 },
        { year: "2026", revenue: 26000, ebitda: 3900 },
        { year: "2027", revenue: 25500, ebitda: 3570 },
        { year: "2028", revenue: 25000, ebitda: 3500 },
      ],
    },
  },
  growthPathways: [
    {
      name: "Offshore Wind Portfolio Expansion",
      description: "RWE is building one of the world's largest offshore wind portfolios with 8GW+ under construction. First-mover advantage in the North Sea and US East Coast positions RWE for 20-year contracted cash flows.",
      probability: 68,
      valueCreation: "€20B+ in contracted renewable revenues by 2030; stable, inflation-linked cash flows",
      historicalSupport: "Ørsted's offshore wind transformation delivered 300% TSR over 10 years; RWE's project pipeline has 85% permitting success rate",
      criticalAssumption: "Offshore wind construction costs stabilize after 2024 supply chain disruptions",
    },
    {
      name: "US IRA-Driven North American Expansion",
      description: "The Inflation Reduction Act provides $370B in clean energy incentives. RWE's acquisition of Con Edison Clean Energy Businesses positions it to capture significant IRA tax credits.",
      probability: 55,
      valueCreation: "US revenue growing to 25% of group by 2028; IRA tax credits worth $2–3B over 10 years",
      historicalSupport: "European utilities with US renewable exposure (Iberdrola, Enel) have outperformed peers by 15–20% since IRA passage",
      criticalAssumption: "IRA provisions remain intact under future US administrations; permitting reform accelerates",
    },
    {
      name: "Green Hydrogen at Scale",
      description: "RWE's electrolyzer capacity and renewable generation assets position it to become a leading green hydrogen producer for industrial decarbonization in Germany and Europe.",
      probability: 32,
      valueCreation: "Hydrogen revenue of €2–4B by 2030; premium pricing vs. grey hydrogen if carbon pricing rises",
      historicalSupport: "Green hydrogen economics are improving rapidly; electrolyzer costs down 60% since 2020; EU hydrogen strategy supports demand",
      criticalAssumption: "Green hydrogen achieves cost parity with grey hydrogen by 2028; industrial customers commit to long-term offtake",
    },
  ],
  failurePathways: [
    {
      name: "Renewable Capex Overrun",
      description: "RWE's €55B capex program is exposed to supply chain inflation, permitting delays, and interest rate increases. A 20% cost overrun would destroy €11B in value.",
      probability: 38,
      hiddenVariable: "Offshore wind turbine supply chain constraints; Jones Act compliance costs in the US",
      historicalPrecedent: "Ørsted cancelled US offshore wind projects in 2023 citing 50% cost overruns; Equinor wrote down $300M on US offshore wind",
      earlyWarning: "Monitor quarterly capex vs. budget; alert if any project exceeds budget by 15%",
    },
    {
      name: "Power Price Collapse",
      description: "Rapid renewable capacity additions across Europe could create structural oversupply, collapsing power prices and destroying the economics of uncontracted generation.",
      probability: 35,
      hiddenVariable: "Speed of European grid expansion to absorb renewable generation; storage deployment",
      historicalPrecedent: "German power prices went negative 300+ hours in 2023; renewable curtailment is increasing as grid cannot absorb supply",
      earlyWarning: "Monitor European power forward curves quarterly; alert if 2027 forwards fall below €40/MWh",
    },
    {
      name: "Policy Reversal Risk",
      description: "Political shifts in Germany, the EU, or the US could reverse renewable energy subsidies or carbon pricing mechanisms, fundamentally altering RWE's investment economics.",
      probability: 25,
      hiddenVariable: "Far-right political gains in Germany and EU elections; US presidential election outcome",
      historicalPrecedent: "Spain's retroactive renewable subsidy cuts in 2012 destroyed €20B in utility value; policy risk is the most underpriced risk in European utilities",
      earlyWarning: "Monitor election polling in Germany and EU; track legislative proposals affecting renewable subsidies",
    },
  ],
  criticalAssumptions: [
    {
      name: "Renewable Capex Cost Stability",
      description: "RWE's entire €55B investment program assumes that offshore wind construction costs will stabilize and decline from 2025 onwards after 2022–2024 supply chain disruptions.",
      confidence: 62,
      isMostDangerous: true,
      failureConsequence: "Project cancellations; €10–15B in write-downs; dividend cut; strategic credibility damage",
      historicalFailure: "Ørsted cancelled 2.9GW of US offshore wind in 2023 after costs rose 50%; Vattenfall abandoned Norfolk Boreas after similar cost escalation",
    },
    {
      name: "European Carbon Price Trajectory",
      description: "RWE's coal phase-out economics depend on EU ETS carbon prices remaining above €60/tonne, making coal generation uneconomic and accelerating the transition.",
      confidence: 71,
      isMostDangerous: false,
      failureConsequence: "Coal assets become economically attractive again; transition timeline extends; stranded asset risk for new renewables",
      historicalFailure: "EU ETS prices collapsed from €30 to €5 in 2012 following over-allocation; carbon market credibility took 5 years to restore",
    },
    {
      name: "IRA Policy Continuity",
      description: "RWE's US expansion assumes the Inflation Reduction Act's clean energy tax credits remain intact through 2030 and beyond.",
      confidence: 58,
      isMostDangerous: false,
      failureConsequence: "US renewable economics deteriorate; $8–12B in US investments face reduced returns; potential asset sales",
      historicalFailure: "US production tax credits have been allowed to expire multiple times; policy uncertainty has historically caused boom-bust cycles in US renewables",
    },
  ],
  councilReview: [
    {
      persona: "The Energy Transition Investor",
      role: "Climate-focused institutional investor",
      verdict: "Support",
      analysis: "RWE is one of the most credible energy transition stories in Europe. The transformation from coal to renewables is structurally irreversible and the offshore wind portfolio will generate stable, long-duration cash flows. The stock is undervalued relative to its 2030 earnings power.",
      keyConcern: "Execution risk on the US expansion is higher than management acknowledges; Jones Act and permitting complexity are underestimated",
      confidence: 76,
    },
    {
      persona: "The Capital Markets Analyst",
      role: "European utilities equity analyst",
      verdict: "Neutral",
      analysis: "RWE's capex program is the largest in European utilities. The balance sheet can support it, but there is no margin for error. A single large project cancellation would trigger a credit rating review and dividend cut.",
      keyConcern: "Net debt/EBITDA approaching 3x by 2026; refinancing risk if interest rates remain elevated",
      confidence: 68,
    },
    {
      persona: "The Geopolitical Risk Analyst",
      role: "European energy security specialist",
      verdict: "Support",
      analysis: "Russia's invasion of Ukraine has permanently altered European energy security calculus. RWE's renewable buildout is now a national security priority, not just a climate priority. This creates political protection for the investment program.",
      keyConcern: "German industrial competitiveness concerns could trigger policy backlash against high renewable energy costs",
      confidence: 72,
    },
    {
      persona: "The Technology Disruptor",
      role: "Energy technology and storage analyst",
      verdict: "Oppose",
      analysis: "RWE is building a 2030 energy system using 2024 technology assumptions. Battery storage, demand response, and distributed generation will fundamentally alter the grid economics that RWE's offshore wind model depends on. The 20-year contracts being signed today may be stranded assets by 2035.",
      keyConcern: "RWE has no credible battery storage or distributed energy strategy; it is building centralized generation in a world moving toward decentralization",
      confidence: 52,
    },
  ],
  earlyWarningIndicators: [
    { name: "Offshore Wind Capex Variance", status: "watch", description: "2 projects showing 12% cost overruns; below 15% alert threshold but trending up", frequency: "Quarterly" },
    { name: "European Power Forward Curve", status: "safe", description: "2027 forwards at €58/MWh; above €40/MWh floor; renewable economics intact", frequency: "Monthly" },
    { name: "EU ETS Carbon Price", status: "safe", description: "Carbon at €68/tonne; well above €60 threshold; coal phase-out economics supported", frequency: "Monthly" },
    { name: "US IRA Policy Risk", status: "watch", description: "Congressional debate on IRA provisions ongoing; 20% probability of modification", frequency: "Quarterly" },
    { name: "Net Debt / EBITDA", status: "watch", description: "Leverage at 2.6x; approaching 3x alert threshold as capex accelerates", frequency: "Quarterly" },
    { name: "Renewable Capacity Factor", status: "safe", description: "Offshore wind capacity factors at 42%; above 38% minimum for project economics", frequency: "Monthly" },
  ],
  scenarioComparison: [
    { scenario: "Growth", evChange: 62 },
    { scenario: "AI-Aug", evChange: 24 },
    { scenario: "Status Quo", evChange: 0 },
    { scenario: "Margin Compress", evChange: -24 },
    { scenario: "Comp. Threat", evChange: -33 },
  ],
  finalRecommendation: {
    verdict: "Buy — Energy Transition Leader with Execution Risk",
    text: "RWE is executing the most ambitious energy transition in European utilities. The offshore wind portfolio will generate €6–8B in stable EBITDA by 2030. The key risk is capex execution — the board should establish a project control office with monthly reporting to the supervisory board. The US expansion requires a dedicated risk management framework given Jones Act and permitting complexity.",
    confidence: 76,
  },
};

// ─── TENCENT ─────────────────────────────────────────────────────────────────

const tencent: Company = {
  id: "tencent",
  name: "Tencent",
  sector: "Technology Platform",
  geography: "China / Global",
  employees: "105,000+",
  description:
    "China's largest technology company by market capitalization, operating the world's largest social media platform (WeChat/Weixin with 1.3B users), the world's largest gaming business, and a rapidly growing cloud and enterprise services division. Tencent is navigating China's regulatory environment, international expansion constraints, and the AI transformation of its core businesses.",
  dataYear: "2024",
  confidenceScore: 76,
  baseMetrics: { revenue: 85000, revenueUnit: "$M", ebitdaMargin: 32, enterpriseValue: 380000, evUnit: "$M" },
  scenarios: {
    statusQuo: {
      scenarioDescription: "Gaming recovery continues; WeChat monetization deepens; cloud grows 20% annually",
      engines: {
        revenue: { value: 85000, unit: "$M", delta: 0 },
        margin: { value: 32, unit: "%", delta: 0 },
        geography: { value: 88, unit: "% China", delta: 0 },
        aiImpact: { value: 8, unit: "% productivity gain", delta: 0 },
        pricing: { value: 100, unit: "ARPU index", delta: 0 },
        enterpriseValue: { value: 380000, unit: "$M", delta: 0 },
      },
      projectionData: [
        { year: "2024", revenue: 85000, ebitda: 27200 },
        { year: "2025", revenue: 92000, ebitda: 29440 },
        { year: "2026", revenue: 99000, ebitda: 31680 },
        { year: "2027", revenue: 106000, ebitda: 33920 },
        { year: "2028", revenue: 113000, ebitda: 36160 },
      ],
    },
    aiAugmented: {
      scenarioDescription: "Hunyuan AI model monetizes across WeChat, gaming, and enterprise; AI-native products launch",
      engines: {
        revenue: { value: 102000, unit: "$M", delta: 20 },
        margin: { value: 36, unit: "%", delta: 13 },
        geography: { value: 85, unit: "% China", delta: -3 },
        aiImpact: { value: 28, unit: "% productivity gain", delta: 250 },
        pricing: { value: 115, unit: "ARPU index", delta: 15 },
        enterpriseValue: { value: 520000, unit: "$M", delta: 37 },
      },
      projectionData: [
        { year: "2024", revenue: 85000, ebitda: 27200 },
        { year: "2025", revenue: 93000, ebitda: 33480 },
        { year: "2026", revenue: 98000, ebitda: 35280 },
        { year: "2027", revenue: 102000, ebitda: 36720 },
        { year: "2028", revenue: 112000, ebitda: 40320 },
      ],
    },
    marginCompression: {
      scenarioDescription: "Regulatory compliance costs rise; gaming revenue tax increases; talent competition with ByteDance",
      engines: {
        revenue: { value: 82000, unit: "$M", delta: -4 },
        margin: { value: 26, unit: "%", delta: -19 },
        geography: { value: 88, unit: "% China", delta: 0 },
        aiImpact: { value: 5, unit: "% productivity gain", delta: -38 },
        pricing: { value: 94, unit: "ARPU index", delta: -6 },
        enterpriseValue: { value: 300000, unit: "$M", delta: -21 },
      },
      projectionData: [
        { year: "2024", revenue: 85000, ebitda: 27200 },
        { year: "2025", revenue: 83500, ebitda: 23380 },
        { year: "2026", revenue: 82500, ebitda: 21450 },
        { year: "2027", revenue: 82000, ebitda: 21320 },
        { year: "2028", revenue: 82000, ebitda: 21320 },
      ],
    },
    growthScenario: {
      scenarioDescription: "International gaming dominance; WeChat Pay global expansion; Hunyuan AI platform leadership",
      engines: {
        revenue: { value: 125000, unit: "$M", delta: 47 },
        margin: { value: 35, unit: "%", delta: 9 },
        geography: { value: 72, unit: "% China", delta: -18 },
        aiImpact: { value: 20, unit: "% productivity gain", delta: 150 },
        pricing: { value: 122, unit: "ARPU index", delta: 22 },
        enterpriseValue: { value: 650000, unit: "$M", delta: 71 },
      },
      projectionData: [
        { year: "2024", revenue: 85000, ebitda: 27200 },
        { year: "2025", revenue: 96000, ebitda: 33600 },
        { year: "2026", revenue: 108000, ebitda: 37800 },
        { year: "2027", revenue: 118000, ebitda: 41300 },
        { year: "2028", revenue: 125000, ebitda: 43750 },
      ],
    },
    competitiveThreat: {
      scenarioDescription: "ByteDance/TikTok captures gaming and social share; Alibaba Cloud wins enterprise; US sanctions expand",
      engines: {
        revenue: { value: 76000, unit: "$M", delta: -11 },
        margin: { value: 24, unit: "%", delta: -25 },
        geography: { value: 90, unit: "% China", delta: 2 },
        aiImpact: { value: 4, unit: "% productivity gain", delta: -50 },
        pricing: { value: 86, unit: "ARPU index", delta: -14 },
        enterpriseValue: { value: 260000, unit: "$M", delta: -32 },
      },
      projectionData: [
        { year: "2024", revenue: 85000, ebitda: 27200 },
        { year: "2025", revenue: 81000, ebitda: 22680 },
        { year: "2026", revenue: 79000, ebitda: 20540 },
        { year: "2027", revenue: 77000, ebitda: 18480 },
        { year: "2028", revenue: 76000, ebitda: 18240 },
      ],
    },
  },
  growthPathways: [
    {
      name: "Hunyuan AI Platform Monetization",
      description: "Tencent's Hunyuan large language model, integrated across WeChat, QQ, and enterprise cloud, creates a new AI-native revenue stream. WeChat's 1.3B users provide an unparalleled distribution advantage for AI product monetization.",
      probability: 55,
      valueCreation: "AI-driven ARPU uplift of 15–20%; new enterprise AI revenue of $5–8B by 2028",
      historicalSupport: "Microsoft's Copilot integration drove 15% enterprise revenue uplift; WeChat's distribution advantage exceeds any Western AI platform",
      criticalAssumption: "Chinese regulatory environment supports AI monetization; Hunyuan achieves competitive parity with global models",
    },
    {
      name: "International Gaming Dominance",
      description: "Tencent's gaming portfolio (League of Legends, PUBG, Honor of Kings) and global studio acquisitions (Riot Games, Supercell) position it to capture 25%+ of global gaming revenue.",
      probability: 62,
      valueCreation: "International gaming revenue growing to 35% of total gaming from 20%; higher margins than China gaming",
      historicalSupport: "Tencent's international gaming revenue grew 14% in 2023; Honor of Kings international launch exceeded projections by 40%",
      criticalAssumption: "No additional US/EU restrictions on Chinese gaming companies; continued studio acquisition pipeline",
    },
    {
      name: "WeChat Pay Global Financial Services",
      description: "WeChat Pay's expansion into Southeast Asia, Europe, and the Americas through partnerships creates a global payment and financial services network comparable to Visa/Mastercard.",
      probability: 28,
      valueCreation: "Fintech revenue of $10–15B by 2030; payment processing margins of 1.5–2% on transaction volume",
      historicalSupport: "Alipay's international expansion achieved $1T+ in annual transaction volume; WeChat Pay has 900M+ active users in China",
      criticalAssumption: "Geopolitical environment allows Chinese payment platforms to operate in Western markets",
    },
  ],
  failurePathways: [
    {
      name: "Regulatory Crackdown Recurrence",
      description: "China's 2021–2022 tech regulatory crackdown destroyed $500B+ in Tencent market value. A recurrence targeting gaming, fintech, or data practices could repeat this destruction.",
      probability: 30,
      hiddenVariable: "Xi administration's tolerance for private tech sector concentration; data sovereignty priorities",
      historicalPrecedent: "Tencent lost 45% of market value in 2021–2022 during regulatory crackdown; Ant Group IPO was cancelled; Didi was forced to delist",
      earlyWarning: "Monitor MIIT and SAMR regulatory announcements; track gaming license approval rates monthly",
    },
    {
      name: "ByteDance Competitive Displacement",
      description: "TikTok/Douyin's algorithm-driven content model is capturing time-on-platform from WeChat. If ByteDance successfully enters gaming and enterprise, Tencent's core moats could erode simultaneously.",
      probability: 42,
      hiddenVariable: "ByteDance's ability to monetize Douyin's engagement advantage into gaming and enterprise",
      historicalPrecedent: "Facebook lost the under-25 demographic to TikTok within 3 years; platform network effects are less durable than assumed",
      earlyWarning: "Track WeChat daily active user growth monthly; monitor Douyin gaming and enterprise product launches",
    },
    {
      name: "US Technology Sanctions Expansion",
      description: "Escalating US-China technology tensions could result in sanctions targeting Tencent's semiconductor access, cloud infrastructure, or international operations.",
      probability: 28,
      hiddenVariable: "US legislative appetite for expanding tech sanctions beyond semiconductors to software platforms",
      historicalPrecedent: "Huawei was effectively cut off from global markets within 18 months of initial sanctions; speed of escalation was underestimated",
      earlyWarning: "Monitor US congressional legislation targeting Chinese tech platforms; track CFIUS review activity",
    },
  ],
  criticalAssumptions: [
    {
      name: "WeChat Network Effect Durability",
      description: "Tencent's entire valuation rests on the assumption that WeChat's 1.3B user network effect is durable and cannot be disrupted by a competing platform.",
      confidence: 72,
      isMostDangerous: false,
      failureConsequence: "40–60% EV destruction; Tencent becomes a sum-of-parts story trading at 8–10x earnings",
      historicalFailure: "MySpace lost 90% of users to Facebook in 3 years; QQ (Tencent's own product) was disrupted by WeChat; no network effect is permanent",
    },
    {
      name: "Regulatory Environment Stability",
      description: "Tencent assumes the 2021–2022 regulatory crackdown was a one-time event and that the current regulatory environment represents a stable equilibrium.",
      confidence: 58,
      isMostDangerous: true,
      failureConsequence: "Repeat of 2021–2022 scenario: 40–50% market cap destruction; forced divestitures; gaming revenue caps",
      historicalFailure: "Tencent management explicitly stated in 2020 that regulatory risk was 'manageable'; the 2021 crackdown was more severe than any internal model predicted",
    },
    {
      name: "AI Competitive Parity",
      description: "Tencent assumes its Hunyuan AI model will achieve competitive parity with global frontier models (GPT-4, Gemini) within 2 years, enabling AI monetization at scale.",
      confidence: 55,
      isMostDangerous: false,
      failureConsequence: "AI monetization delayed 3–5 years; WeChat AI features lag international platforms; enterprise cloud growth slows",
      historicalFailure: "Chinese AI models have consistently lagged Western frontier models by 12–18 months; export controls on advanced chips may widen this gap",
    },
  ],
  councilReview: [
    {
      persona: "The China Tech Specialist",
      role: "Greater China technology sector analyst",
      verdict: "Support",
      analysis: "Tencent is the most undervalued mega-cap technology company in the world. The regulatory overhang is priced in, but the AI opportunity is not. Hunyuan's integration into WeChat's 1.3B user base creates a monetization flywheel that Western analysts consistently underestimate.",
      keyConcern: "Geopolitical risk is binary and unhedgeable; a Taiwan scenario would make the investment thesis irrelevant",
      confidence: 74,
    },
    {
      persona: "The Geopolitical Risk Analyst",
      role: "US-China relations and sanctions specialist",
      verdict: "Neutral",
      analysis: "Tencent's international expansion is severely constrained by geopolitical reality. The US market is effectively closed; Europe is increasingly hostile. The company's growth story is structurally limited to China and friendly markets.",
      keyConcern: "Advanced chip export controls will widen the AI capability gap; Tencent cannot train frontier models without NVIDIA H100s",
      confidence: 65,
    },
    {
      persona: "The Platform Economics Expert",
      role: "Digital platform competitive dynamics",
      verdict: "Support",
      analysis: "WeChat's super-app model is the most defensible platform architecture in existence. The combination of messaging, payments, mini-programs, and social creates switching costs that no competitor has overcome in 12 years. ByteDance is a threat but not an existential one.",
      keyConcern: "The under-25 demographic in China is showing early signs of preferring Douyin over WeChat for social interaction",
      confidence: 70,
    },
    {
      persona: "The Regulatory Risk Specialist",
      role: "Chinese regulatory environment analyst",
      verdict: "Oppose",
      analysis: "The 2021–2022 crackdown was not a one-time event; it was a demonstration of state power over private tech. The CCP's tolerance for private platform dominance has structural limits. Tencent's gaming and fintech businesses remain vulnerable to policy reversal.",
      keyConcern: "Gaming revenue caps for minors were just the beginning; data sovereignty regulations could fragment WeChat's business model",
      confidence: 60,
    },
  ],
  earlyWarningIndicators: [
    { name: "Gaming License Approvals", status: "safe", description: "MIIT approving 80+ games/month in 2024; normalization from 2021–2022 freeze", frequency: "Monthly" },
    { name: "WeChat DAU Growth", status: "safe", description: "WeChat DAU growing 3% YoY; stable but slowing in China's saturated market", frequency: "Monthly" },
    { name: "Regulatory Announcement Volume", status: "watch", description: "SAMR and MIIT draft regulations on AI and data increasing; monitoring required", frequency: "Weekly" },
    { name: "ByteDance Market Share", status: "watch", description: "Douyin gaining 2% social time-on-platform per quarter; approaching WeChat in under-25s", frequency: "Monthly" },
    { name: "Hunyuan AI Benchmark Position", status: "watch", description: "Hunyuan ranks #4 in Chinese LLM benchmarks; behind GPT-4 equivalent by 18 months", frequency: "Quarterly" },
    { name: "International Revenue Growth", status: "safe", description: "International gaming revenue +14% YoY; exceeding 20% of total gaming revenue", frequency: "Quarterly" },
  ],
  scenarioComparison: [
    { scenario: "Growth", evChange: 71 },
    { scenario: "AI-Aug", evChange: 37 },
    { scenario: "Status Quo", evChange: 0 },
    { scenario: "Margin Compress", evChange: -21 },
    { scenario: "Comp. Threat", evChange: -32 },
  ],
  finalRecommendation: {
    verdict: "Buy — Regulatory Risk Priced In, AI Upside Not",
    text: "Tencent trades at a 40% discount to global tech peers on a risk-adjusted basis. The regulatory environment has stabilized, gaming is recovering, and the Hunyuan AI platform creates a monetization opportunity that the market is not pricing. The key risk is geopolitical — investors should size positions accordingly. The board should accelerate international gaming expansion and establish a dedicated AI product organization separate from existing business units.",
    confidence: 68,
  },
};

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

export const companies: Company[] = [keo, zain, warba, rwe, tencent];

export function getCompany(id: string): Company | undefined {
  return companies.find(c => c.id === id);
}

export function runScenario(companyId: string, scenario: ScenarioKey): ScenarioResult | undefined {
  const company = getCompany(companyId);
  if (!company) return undefined;
  return company.scenarios[scenario];
}
