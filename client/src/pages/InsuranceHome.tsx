import { useState } from "react";
import { useLocation } from "wouter";
import SiteNav from "@/components/SiteNav";
import GateScreen from "@/components/GateScreen";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Design tokens ──────────────────────────────────────────────────────────────
const NAVY = "#0B1628";
const NAVY_CARD = "#0F1E35";
const NAVY_BORDER = "#1E3050";
const TEAL = "#0EA5E9";
const TEAL_LIGHT = "#E0F2FE";
const GOLD = "#F59E0B";
const GOLD_LIGHT = "#FEF3C7";
const EMERALD = "#10B981";
const EMERALD_LIGHT = "#D1FAE5";
const SILVER_50 = "#F0F4FA";
const SILVER_400 = "#94A3B8";
const SILVER_600 = "#4A5A72";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const WORKFLOWS = [
  {
    id: "underwriting",
    icon: "📋",
    title: "Underwriting Decision Engine",
    subtitle: "Direct Insurance · 7 Agents",
    description:
      "Full underwriting pipeline: risk intake, Takaful classification, risk modelling, Shariah compliance, actuarial pricing, claims history analysis, and final APPROVE / REFER / DECLINE decision.",
    badge: "Flagship",
    badgeColor: GOLD,
    accent: GOLD,
    accentLight: GOLD_LIGHT,
    sla: "< 5 min",
    output: "APPROVE / REFER / DECLINE",
    agents: ["RiskIntakeParser", "TakafulClassifier", "RiskModeler", "ShariaComplianceAgent", "PricingActuary", "ClaimsAnalyst", "UnderwritingDecisionAgent"],
  },
  {
    id: "treaty",
    icon: "🤝",
    title: "Treaty Analysis Engine",
    subtitle: "Reinsurance · 5 Agents",
    description:
      "Reinsurance treaty analysis: risk intake, exposure modelling, treaty structure review (QS vs XL), catastrophe modelling, and cession rate optimisation.",
    badge: "Reinsurance",
    badgeColor: TEAL,
    accent: TEAL,
    accentLight: TEAL_LIGHT,
    sla: "< 4 min",
    output: "ACCEPT / DECLINE / NEGOTIATE",
    agents: ["RiskIntakeParser", "RiskModeler", "TreatyAnalyst", "CatastropheModeler", "CessionOptimizer"],
  },
  {
    id: "claims",
    icon: "🔍",
    title: "Claims Intelligence",
    subtitle: "Direct Insurance · 4 Agents",
    description:
      "Claims triage and fraud detection: risk intake, exposure context, claims history analysis with IBNR estimation, fraud scoring, and settlement recommendation.",
    badge: "Claims",
    badgeColor: EMERALD,
    accent: EMERALD,
    accentLight: EMERALD_LIGHT,
    sla: "< 3 min",
    output: "Pay / Investigate / Deny",
    agents: ["RiskIntakeParser", "RiskModeler", "ClaimsAnalyst", "UnderwritingDecisionAgent"],
  },
  {
    id: "compliance",
    icon: "☪️",
    title: "Takaful Compliance Scan",
    subtitle: "Islamic Insurance · 3 Agents",
    description:
      "Shariah compliance review: product classification, Takaful model identification (Wakala/Mudharaba), gharar/riba/maysir screening under AAOIFI standards.",
    badge: "Takaful",
    badgeColor: "#8B5CF6",
    accent: "#8B5CF6",
    accentLight: "#EDE9FE",
    sla: "< 2 min",
    output: "Compliant / Non-Compliant",
    agents: ["RiskIntakeParser", "TakafulClassifier", "ShariaComplianceAgent"],
  },
  {
    id: "cat_model",
    icon: "🌪️",
    title: "CAT Model",
    subtitle: "Reinsurance · 4 Agents",
    description:
      "GCC catastrophe exposure modelling: risk intake, exposure profiling, PML estimation for earthquake/flood/windstorm/terrorism, and reinsurance programme optimisation.",
    badge: "CAT",
    badgeColor: "#EF4444",
    accent: "#EF4444",
    accentLight: "#FEE2E2",
    sla: "< 3 min",
    output: "PML / Reinsurance Need",
    agents: ["RiskIntakeParser", "RiskModeler", "CatastropheModeler", "CessionOptimizer"],
  },
];

const AGENT_CLUSTERS = [
  {
    cluster: "Intake",
    color: TEAL,
    agents: [
      { id: "IN-IN-001", name: "RiskIntakeParser", icon: "📄" },
      { id: "IN-IN-002", name: "TakafulClassifier", icon: "☪️" },
    ],
  },
  {
    cluster: "Underwriting",
    color: GOLD,
    agents: [
      { id: "IN-UW-001", name: "RiskModeler", icon: "⚡" },
      { id: "IN-UW-002", name: "ShariaComplianceAgent", icon: "⚖️" },
      { id: "IN-UW-003", name: "PricingActuary", icon: "🧮" },
      { id: "IN-UW-004", name: "ClaimsAnalyst", icon: "🔍" },
    ],
  },
  {
    cluster: "Reinsurance",
    color: TEAL,
    agents: [
      { id: "IN-RE-001", name: "TreatyAnalyst", icon: "📋" },
      { id: "IN-RE-002", name: "CatastropheModeler", icon: "🌪️" },
      { id: "IN-RE-003", name: "CessionOptimizer", icon: "📊" },
    ],
  },
  {
    cluster: "Decision",
    color: EMERALD,
    agents: [
      { id: "IN-DM-001", name: "UnderwritingDecisionAgent", icon: "🎯" },
    ],
  },
];

function WorkflowCard({
  workflow,
  onStart,
  isLoading,
}: {
  workflow: typeof WORKFLOWS[0];
  onStart: (id: string) => void;
  isLoading: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? `${workflow.accent}08` : NAVY_CARD,
        border: `1px solid ${hovered ? workflow.accent + "50" : NAVY_BORDER}`,
        borderRadius: 16,
        padding: 28,
        transition: "all 0.2s ease",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 10,
              background: `${workflow.accent}18`,
              border: `1px solid ${workflow.accent}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}
          >
            {workflow.icon}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: SILVER_50, fontFamily: FONT }}>
              {workflow.title}
            </div>
            <div style={{ fontSize: 11, color: SILVER_600, marginTop: 2, fontFamily: MONO, letterSpacing: "0.04em" }}>
              {workflow.subtitle}
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
            color: workflow.badgeColor,
            background: `${workflow.badgeColor}18`,
            border: `1px solid ${workflow.badgeColor}30`,
            borderRadius: 6, padding: "3px 8px",
            fontFamily: MONO, whiteSpace: "nowrap",
          }}
        >
          {workflow.badge}
        </span>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: SILVER_400, lineHeight: 1.6, margin: 0 }}>
        {workflow.description}
      </p>

      {/* Output + SLA */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{
          background: `${workflow.accent}10`,
          border: `1px solid ${workflow.accent}25`,
          borderRadius: 8, padding: "6px 12px",
          fontSize: 11, color: workflow.accent, fontFamily: MONO,
        }}>
          Output: {workflow.output}
        </div>
        <div style={{
          background: "#1E3050",
          border: "1px solid #2A4060",
          borderRadius: 8, padding: "6px 12px",
          fontSize: 11, color: SILVER_400, fontFamily: MONO,
        }}>
          SLA: {workflow.sla}
        </div>
      </div>

      {/* Agent pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {workflow.agents.map(agent => (
          <span
            key={agent}
            style={{
              fontSize: 10, color: SILVER_600, fontFamily: MONO,
              background: "#1A2A40", border: "1px solid #243550",
              borderRadius: 4, padding: "2px 7px",
            }}
          >
            {agent}
          </span>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => onStart(workflow.id)}
        disabled={isLoading}
        style={{
          marginTop: 4,
          background: hovered ? workflow.accent : `${workflow.accent}20`,
          border: `1px solid ${workflow.accent}50`,
          borderRadius: 8, padding: "10px 0",
          color: hovered ? "#000" : workflow.accent,
          fontFamily: MONO, fontSize: 12, fontWeight: 700,
          letterSpacing: "0.06em", cursor: isLoading ? "not-allowed" : "pointer",
          transition: "all 0.15s ease", opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? "LAUNCHING..." : `▶ RUN ${workflow.title.toUpperCase().split(" ")[0]} ENGINE`}
      </button>
    </div>
  );
}

export default function InsuranceHome() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [showInputFor, setShowInputFor] = useState<string | null>(null);

  const startRunMutation = trpc.insurance.startRun.useMutation({
    onSuccess: (data) => {
      setLocation(`/insurance/run/${data.runType}/${data.runId}`);
    },
  });

  const handleWorkflowClick = (workflowId: string) => {
    setShowInputFor(workflowId);
    setActiveWorkflow(workflowId);
    setInputText(getDefaultInput(workflowId));
  };

  const handleLaunch = () => {
    if (!showInputFor || !inputText.trim()) return;
    startRunMutation.mutate({
      runType: showInputFor as "underwriting" | "claims" | "treaty" | "compliance" | "cat_model",
      inputText: inputText.trim(),
    });
  };

  const getDefaultInput = (workflowId: string) => {
    const defaults: Record<string, string> = {
      underwriting: "Risk Submission: Property Insurance — Al-Futtaim Group, UAE. Mixed-use commercial complex in Dubai Investment Park. Sum insured: AED 850M. Coverage: All-risks property + business interruption. Construction year: 2019. Takaful required. No major claims in past 5 years.",
      treaty: "Reinsurance Treaty Review: Gulf Insurance Group (KSE: GULFINS). Quota share treaty renewal for motor portfolio. GWP: KWD 45M. Loss ratio last 3 years: 68%, 72%, 65%. Seeking 30% QS cession to Arab Re and Munich Re. Territory: Kuwait, Saudi Arabia, UAE.",
      claims: "Claims Notification: Policy No. TK-2024-8821. Insured: Saudi Aramco contractor. Incident: Construction equipment fire at Jubail Industrial City. Estimated loss: SAR 12M. Date of loss: 15 March 2026. Third-party liability exposure: SAR 3M. Claimant has prior claim in 2022.",
      compliance: "Takaful Product Review: Family Takaful (Life) product for Al-Rajhi Insurance. Wakala model with 15% operator fee. Investment portfolio includes sukuk (80%) and equities (20%). Surplus distribution: 70% to participants, 30% to operator. Minimum contribution: SAR 500/month.",
      cat_model: "CAT Exposure Assessment: ADNIC property portfolio. Total insured value: AED 12B across UAE. Concentration: Dubai (45%), Abu Dhabi (35%), Northern Emirates (20%). Key exposures: earthquake (Fujairah fault), flood (Dubai wadi), terrorism (financial district). Current reinsurance: QS 20% + CAT XL USD 500M xs USD 50M.",
    };
    return defaults[workflowId] || "";
  };

  if (loading) return null;
  if (!user) return <GateScreen />;

  const activeWorkflowData = WORKFLOWS.find(w => w.id === activeWorkflow);

  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: SILVER_50, fontFamily: FONT }}>
      <SiteNav />

      {/* Hero */}
      <div style={{ borderBottom: `1px solid ${NAVY_BORDER}`, background: `${NAVY_CARD}80` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 32px 40px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => setLocation("/portfolio")}
                  style={{ color: SILVER_600, fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  ← AgenThinkMesh
                </button>
                <span style={{ color: SILVER_600 }}>/</span>
                <span style={{ fontSize: 13, color: SILVER_50 }}>Insurance Intelligence</span>
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: SILVER_50, margin: 0, lineHeight: 1.2 }}>
                Insurance & Reinsurance
                <br />
                <span style={{ color: TEAL }}>Intelligence Engine</span>
              </h1>
              <p style={{ fontSize: 14, color: SILVER_400, marginTop: 12, maxWidth: 560, lineHeight: 1.6 }}>
                10 specialist agents across 5 institutional workflows. Covers direct insurance and reinsurance
                with native Takaful and Shariah compliance support for the GCC market.
              </p>
            </div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              {[
                { label: "Specialist Agents", value: "10" },
                { label: "Workflows", value: "5 Live" },
                { label: "Takaful Native", value: "AAOIFI" },
                { label: "Coverage", value: "GCC + MENA" },
              ].map(stat => (
                <div key={stat.label}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: SILVER_50, fontFamily: MONO }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: SILVER_600, marginTop: 2, letterSpacing: "0.04em" }}>{stat.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 40, alignItems: "start" }}>

          {/* Left: Workflow cards */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: SILVER_600, letterSpacing: "0.08em", marginBottom: 20 }}>
              SELECT WORKFLOW
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {WORKFLOWS.map(workflow => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  onStart={handleWorkflowClick}
                  isLoading={startRunMutation.isPending && activeWorkflow === workflow.id}
                />
              ))}
            </div>
          </div>

          {/* Right: Input panel + Agent Registry */}
          <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Input Panel */}
            {showInputFor ? (
              <div style={{
                background: NAVY_CARD, border: `1px solid ${activeWorkflowData?.accent}40`,
                borderRadius: 16, padding: 24,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 20 }}>{activeWorkflowData?.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: SILVER_50 }}>
                      {activeWorkflowData?.title}
                    </div>
                    <div style={{ fontSize: 11, color: SILVER_600, fontFamily: MONO }}>
                      {activeWorkflowData?.agents.length} agents · {activeWorkflowData?.sla}
                    </div>
                  </div>
                </div>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Paste risk submission, policy details, or reinsurance slip..."
                  rows={10}
                  style={{
                    width: "100%", background: "#0A1525",
                    border: `1px solid ${NAVY_BORDER}`,
                    borderRadius: 8, padding: 12,
                    color: SILVER_50, fontSize: 12, fontFamily: MONO,
                    lineHeight: 1.6, resize: "vertical", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    onClick={handleLaunch}
                    disabled={startRunMutation.isPending || !inputText.trim()}
                    style={{
                      flex: 1, background: activeWorkflowData?.accent,
                      border: "none", borderRadius: 8, padding: "11px 0",
                      color: "#000", fontFamily: MONO, fontSize: 12, fontWeight: 700,
                      letterSpacing: "0.06em", cursor: startRunMutation.isPending ? "not-allowed" : "pointer",
                      opacity: startRunMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    {startRunMutation.isPending ? "LAUNCHING PIPELINE..." : "▶ LAUNCH PIPELINE"}
                  </button>
                  <button
                    onClick={() => { setShowInputFor(null); setActiveWorkflow(null); }}
                    style={{
                      background: "transparent", border: `1px solid ${NAVY_BORDER}`,
                      borderRadius: 8, padding: "11px 14px",
                      color: SILVER_400, cursor: "pointer", fontSize: 12,
                    }}
                  >
                    ✕
                  </button>
                </div>
                {startRunMutation.isError && (
                  <p style={{ fontSize: 11, color: "#F87171", marginTop: 8 }}>
                    {startRunMutation.error?.message || "Failed to start run"}
                  </p>
                )}
              </div>
            ) : (
              <div style={{
                background: NAVY_CARD, border: `1px solid ${NAVY_BORDER}`,
                borderRadius: 16, padding: 24, textAlign: "center",
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🏛️</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: SILVER_50, marginBottom: 8 }}>
                  Select a Workflow
                </div>
                <p style={{ fontSize: 12, color: SILVER_400, lineHeight: 1.6 }}>
                  Click any workflow card to configure and launch the pipeline.
                  Each run streams live agent outputs in real time.
                </p>
              </div>
            )}

            {/* Quick links */}
            <div style={{ background: NAVY_CARD, border: `1px solid ${NAVY_BORDER}`, borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: SILVER_600, letterSpacing: "0.08em", marginBottom: 14 }}>
                QUICK ACCESS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => setLocation("/insurance/takaful-alerts")}
                  style={{
                    background: "#8B5CF610", border: "1px solid #8B5CF630",
                    borderRadius: 8, padding: "10px 14px",
                    color: "#A78BFA", fontFamily: MONO, fontSize: 11,
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  ☪️ Takaful Compliance Alerts
                </button>
                <button
                  onClick={() => setLocation("/insurance/history")}
                  style={{
                    background: "#1E3050", border: `1px solid ${NAVY_BORDER}`,
                    borderRadius: 8, padding: "10px 14px",
                    color: SILVER_400, fontFamily: MONO, fontSize: 11,
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  📁 Run History
                </button>
              </div>
            </div>

            {/* Agent Registry Preview */}
            <div style={{ background: NAVY_CARD, border: `1px solid ${NAVY_BORDER}`, borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: SILVER_600, letterSpacing: "0.08em", marginBottom: 14 }}>
                AGENT REGISTRY — 10 SPECIALISTS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {AGENT_CLUSTERS.map(cluster => (
                  <div key={cluster.cluster}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: cluster.color,
                      letterSpacing: "0.06em", marginBottom: 8,
                      fontFamily: MONO,
                    }}>
                      {cluster.cluster.toUpperCase()} CLUSTER
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {cluster.agents.map(agent => (
                        <div
                          key={agent.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "6px 10px", borderRadius: 6,
                            background: "#0A1525",
                            border: `1px solid ${NAVY_BORDER}`,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{agent.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: SILVER_50 }}>{agent.name}</div>
                            <div style={{ fontSize: 10, color: SILVER_600, fontFamily: MONO }}>{agent.id}</div>
                          </div>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: EMERALD, flexShrink: 0 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
