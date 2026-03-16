// ─────────────────────────────────────────────────────────────────────────────
// AGENTHINKMESH — Shared mesh data: contexts, agents, spawning, layout
// 14 contexts · 112 base agents · 22 spawnable extras
// ─────────────────────────────────────────────────────────────────────────────

export const DOMAIN_MAP: Record<string, { label: string; icon: string }> = {
  finance:    { label: "Finance",    icon: "💹" },
  legal:      { label: "Legal",      icon: "⚖️" },
  healthcare: { label: "Healthcare", icon: "🏥" },
  enterprise: { label: "Enterprise", icon: "🏢" },
  gccwealth:  { label: "GCC Wealth", icon: "🏦" },
};

export interface MeshContext {
  icon: string;
  label: string;
  domain: string;
  color: string;
  agents: string[];
  quickTasks: string[];
  systemPromptBase: string;
}

export const CONTEXTS: Record<string, MeshContext> = {
  // ── Finance ──────────────────────────────────────────────────────────────
  vc: {
    icon: "💹", label: "VC / PE Fund", domain: "finance", color: "#7BA3D4",
    agents: ["Deal Screener","Due Diligence","Portfolio Monitor","LP Comms","Cap Table","Exit Modeler","Valuation","Term Sheet"],
    quickTasks: ["Draft term sheet for new deal","Should we approve this investment?","Write LP update email for Q3","Model exit scenario and recommend timing"],
    systemPromptBase: "You are operating within a VC/PE Fund institutional Mesh. Apply venture capital and private equity frameworks.",
  },
  swf: {
    icon: "💹", label: "Sovereign Wealth Fund", domain: "finance", color: "#7BA3D4",
    agents: ["Asset Allocation","Macro Intel","Risk Monitor","ESG Screener","FX Overlay","Rebalancing","Liquidity","Board Reporter"],
    quickTasks: ["Should we rebalance the portfolio now?","Draft board report for Q3 SWF performance","Write ESG screening memo for new holding","Is our FX exposure compliant with policy?"],
    systemPromptBase: "You are operating within a Sovereign Wealth Fund institutional Mesh. Apply sovereign investment and macro frameworks.",
  },
  fm: {
    icon: "💹", label: "Fund Manager", domain: "finance", color: "#7BA3D4",
    agents: ["iNAV Engine","Compliance","Performance","Trade Exec","Risk Monitor","Report Gen","Benchmark","Investor Notifier"],
    quickTasks: ["Draft investor notification for NAV update","Are we compliant with CBK capital requirements?","Write performance report for fund committee","Should we execute this trade given current risk?"],
    systemPromptBase: "You are operating within a Fund Management institutional Mesh. Apply fund administration and portfolio management frameworks.",
  },
  // ── Legal ─────────────────────────────────────────────────────────────────
  lawfirm: {
    icon: "⚖️", label: "Law Firm", domain: "legal", color: "#7C3AED",
    agents: ["Contract Review","Clause Extractor","Risk Flagger","Jurisdiction Intel","Precedent Search","Draft Gen","Redline","Deadline Monitor"],
    quickTasks: ["Write NDA for new technology partner","Draft supplier collaboration agreement","Should we sign this contract as-is?","Write legal opinion memo on jurisdiction risk"],
    systemPromptBase: "You are operating within a Law Firm institutional Mesh. Apply legal analysis, contract review, and risk assessment frameworks.",
  },
  inhouse: {
    icon: "⚖️", label: "In-House Counsel", domain: "legal", color: "#7C3AED",
    agents: ["Policy Monitor","Regulatory Watch","Contract Tracker","Approval Workflow","Liability Screener","Report Gen","Entity Manager","NDA"],
    quickTasks: ["Are we compliant with new ADGM regulations?","Draft policy memo on regulatory change","Should we approve this vendor contract?","Write entity restructuring recommendation"],
    systemPromptBase: "You are operating within an In-House Counsel institutional Mesh. Apply corporate legal, compliance, and regulatory frameworks.",
  },
  // ── Healthcare ────────────────────────────────────────────────────────────
  hospital: {
    icon: "🏥", label: "Hospital Ops", domain: "healthcare", color: "#059669",
    agents: ["Bed Manager","Staffing Optimizer","Procurement Intel","Patient Flow","Cost Analyzer","Compliance","Incident Logger","Shift Planner"],
    quickTasks: ["Draft incident report for clinical review","Should we approve this procurement request?","Write staffing plan for Q4 peak season","Are we compliant with MOH patient safety standards?"],
    systemPromptBase: "You are operating within a Hospital Operations institutional Mesh. Apply healthcare operations, patient safety, and clinical compliance frameworks.",
  },
  clinical: {
    icon: "🏥", label: "Clinical Research", domain: "healthcare", color: "#059669",
    agents: ["Trial Screener","Protocol Checker","Data Curator","Safety Monitor","Regulatory Mapper","Report Gen","Site Monitor","IRB"],
    quickTasks: ["Draft IRB submission for Phase 2 trial","Are we compliant with GCP protocol requirements?","Write safety signal report for regulatory filing","Should we proceed to next trial phase?"],
    systemPromptBase: "You are operating within a Clinical Research institutional Mesh. Apply clinical trial, GCP, and regulatory submission frameworks.",
  },
  // ── Enterprise ────────────────────────────────────────────────────────────
  hr: {
    icon: "🏢", label: "HR & People Ops", domain: "enterprise", color: "#0891B2",
    agents: ["Talent Screener","Policy Checker","Onboarding","Performance","Comp Benchmarker","Culture Pulse","Leave Tracker","L&D"],
    quickTasks: ["Draft offer letter for senior hire","Write performance improvement plan","Should we approve this compensation package?","Are our HR policies compliant with Kuwait Labour Law?"],
    systemPromptBase: "You are operating within an HR & People Operations institutional Mesh. Apply talent management, HR policy, and organisational development frameworks.",
  },
  procurement: {
    icon: "🏢", label: "Procurement", domain: "enterprise", color: "#0891B2",
    agents: ["Vendor Screener","RFP Analyzer","Contract Tracker","Spend Optimizer","Risk Assessor","Supplier Intel","PO Manager","Audit"],
    quickTasks: ["Draft RFP for new logistics vendor","Should we approve this supplier contract?","Write vendor evaluation report","Are our procurement practices compliant with policy?"],
    systemPromptBase: "You are operating within a Procurement institutional Mesh. Apply vendor management, spend analysis, and supply chain risk frameworks.",
  },
  operations: {
    icon: "🏢", label: "Operations", domain: "enterprise", color: "#0891B2",
    agents: ["Process Monitor","KPI Tracker","Bottleneck Finder","Resource Planner","Incident Logger","Report Gen","SLA Monitor","Escalation"],
    quickTasks: ["Write SLA breach escalation memo","Draft ops performance report for leadership","Should we approve this process change?","Generate Python script to automate KPI tracking"],
    systemPromptBase: "You are operating within an Operations institutional Mesh. Apply process optimisation, KPI management, and operational excellence frameworks.",
  },
  // ── GCC Wealth & Investment Banking ──────────────────────────────────────
  privatewealth: {
    icon: "🏦", label: "Private Wealth Mgmt", domain: "gccwealth", color: "#B45309",
    agents: ["Client Profiler","Suitability Checker","Portfolio Builder","Rebalancing Advisor","Report Generator","Tax Optimizer","Estate Planner","Onboarding Agent"],
    quickTasks: ["Draft client portfolio review letter","Should we recommend this product to the client?","Write suitability assessment for new HNWI client","Are we compliant with DFSA suitability requirements?"],
    systemPromptBase: "You are operating within a GCC Private Wealth Management institutional Mesh. Apply HNWI client profiling, Shariah-compliant product suitability, DFSA/ADGM regulatory frameworks, and GCC estate planning (including Faraid succession law).",
  },
  ibgcc: {
    icon: "🏦", label: "Investment Banking GCC", domain: "gccwealth", color: "#B45309",
    agents: ["Deal Originator","Pitch Deck Builder","Mandate Tracker","Regulatory Mapper","Valuation Agent","Syndication Desk","Tombstone Writer","Compliance Checker"],
    quickTasks: ["Draft pitch deck outline for M&A mandate","Should we proceed with this deal at current valuation?","Write regulatory mapping memo for ADGM listing","Are we compliant with CMA disclosure requirements?"],
    systemPromptBase: "You are operating within a GCC Investment Banking institutional Mesh. Apply M&A, ECM, DCM, and capital markets frameworks with GCC regulatory context (CMA, DFSA, ADGM, Vision 2030).",
  },
  familyoffice: {
    icon: "🏦", label: "Family Office GCC", domain: "gccwealth", color: "#B45309",
    agents: ["Asset Allocator","Alternatives Scout","Succession Planner","Philanthropy Advisor","Real Assets Monitor","FX Hedger","Liquidity Manager","Reporting Agent"],
    quickTasks: ["Draft succession plan memo for family council","Should we increase alternatives allocation?","Write real estate investment recommendation","Are our structures compliant with Faraid succession law?"],
    systemPromptBase: "You are operating within a GCC Family Office institutional Mesh. Apply multi-generational wealth preservation, Shariah-compliant alternatives, GCC real estate, and succession planning frameworks.",
  },
  funddist: {
    icon: "🏦", label: "Fund Distribution GCC", domain: "gccwealth", color: "#B45309",
    agents: ["Investor Matcher","Subscription Tracker","LP Relations Agent","Fund Fact Sheet Writer","Roadshow Planner","Due Diligence Responder","Regulatory Filing Agent","Investor Comms"],
    quickTasks: ["Draft DD questionnaire response for LP","Write roadshow presentation outline","Should we accept this investor subscription?","Are our fund documents compliant with CIMA requirements?"],
    systemPromptBase: "You are operating within a GCC Fund Distribution institutional Mesh. Apply fund marketing, LP relations, CIMA/DFSA fund registration, and institutional investor frameworks.",
  },
};

export const ROLE_CONTEXT_MAP: Record<string, string> = {
  vc: "vc", finance: "vc", legal: "lawfirm", healthcare: "hospital",
  hr: "hr", operations: "operations", procurement: "procurement",
  wealth: "privatewealth", banking: "ibgcc",
};

// ── Spawnable extras ──────────────────────────────────────────────────────────
const SPAWN_RULES: Array<{ keywords: string[]; agents: string[] }> = [
  { keywords: ["risk","exposure","volatility","downside"], agents: ["Risk Assessor","Scenario Modeller"] },
  { keywords: ["esg","sustainability","climate","impact"], agents: ["ESG Analyst","Impact Scorer"] },
  { keywords: ["shariah","islamic","sukuk","halal"], agents: ["Shariah Screener","Sukuk Structurer"] },
  { keywords: ["hnwi","family office","ultra","billionaire"], agents: ["HNWI Profiler","Wealth Structurer"] },
  { keywords: ["fx","currency","hedge","exchange rate"], agents: ["FX Hedger","Currency Analyst"] },
  { keywords: ["ipo","listing","public offering","equity capital"], agents: ["IPO Advisor","Equity Structurer"] },
  { keywords: ["m&a","merger","acquisition","takeover"], agents: ["M&A Advisor","Integration Planner"] },
  { keywords: ["compliance","regulatory","sanction","aml","kyc"], agents: ["Compliance Officer","AML Screener"] },
  { keywords: ["litigation","dispute","arbitration","court"], agents: ["Litigation Analyst","Dispute Resolver"] },
  { keywords: ["clinical","trial","patient","protocol"], agents: ["Clinical Analyst","Protocol Reviewer"] },
  { keywords: ["procurement","vendor","rfp","tender"], agents: ["Procurement Specialist","Vendor Ranker"] },
  { keywords: ["succession","inheritance","estate","faraid"], agents: ["Succession Planner","Estate Structurer"] },
];

export interface AgentNode {
  id: string;
  label: string;
  spawned: boolean;
}

export function inferAgents(task: string, baseAgents: string[]): AgentNode[] {
  const lower = task.toLowerCase();
  const extras: string[] = [];
  for (const rule of SPAWN_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      rule.agents.forEach(a => {
        if (!baseAgents.includes(a) && !extras.includes(a)) extras.push(a);
      });
    }
  }
  const all = [...baseAgents, ...extras].slice(0, 50);
  return all.map((label, i) => ({
    id: "a" + i,
    label,
    spawned: !baseAgents.includes(label),
  }));
}

// ── Radial layout ─────────────────────────────────────────────────────────────
export interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  center?: boolean;
  color: string;
  spawned?: boolean;
}

export function buildLayout(agents: AgentNode[], contextColor: string): LayoutNode[] {
  const nodes: LayoutNode[] = [
    { id: "core", label: "Mesh Core", x: 50, y: 50, center: true, color: contextColor },
  ];
  const count = agents.length;
  const rings = count <= 8 ? 1 : count <= 20 ? 2 : 3;
  const perRing = Math.ceil(count / rings);
  agents.forEach((ag, i) => {
    const ring = Math.floor(i / perRing) + 1;
    const posInRing = i % perRing;
    const total = Math.min(perRing, count - (ring - 1) * perRing);
    const angle = (posInRing / total) * 2 * Math.PI - Math.PI / 2;
    const r = ring * (rings === 1 ? 32 : rings === 2 ? 26 : 20);
    nodes.push({
      id: ag.id,
      label: ag.label,
      x: 50 + r * Math.cos(angle),
      y: 50 + r * Math.sin(angle),
      color: ag.spawned ? "#F59E0B" : contextColor,
      spawned: ag.spawned,
    });
  });
  return nodes;
}
