/**
 * Persona Selector — 3-step flow:
 *  Step 1: Choose a domain tile (what best describes your work?)
 *  Step 2: Browse agents for that domain, pick one
 *  Step 3: Confirm → classifyPersona → /ask?agent=<agentId>
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import Logo from "@/components/Logo";

// ── Domain tiles ──────────────────────────────────────────────────────────────

const DOMAIN_TILES = [
  {
    id: "Banker",
    label: "Banker",
    icon: "🏦",
    description: "Credit, KYC/AML, GCC regulatory monitoring, compliance",
    color: "#60A5FA",
    bg: "rgba(96,165,250,0.10)",
    border: "rgba(96,165,250,0.35)",
    glow: "rgba(96,165,250,0.25)",
    persona: "BANKER",
  },
  {
    id: "Finance",
    label: "Finance / VC",
    icon: "💰",
    description: "Deal screening, due diligence, portfolio monitoring, LP reporting, valuations",
    color: "#4ADE80",
    bg: "rgba(74,222,128,0.10)",
    border: "rgba(74,222,128,0.35)",
    glow: "rgba(74,222,128,0.25)",
    persona: "FUND_MANAGER",
  },
  {
    id: "Fund Manager",
    label: "Fund Manager",
    icon: "📊",
    description: "Portfolio intelligence, deal screening, macro monitoring, LP reporting",
    color: "#34D399",
    bg: "rgba(52,211,153,0.10)",
    border: "rgba(52,211,153,0.35)",
    glow: "rgba(52,211,153,0.25)",
    persona: "FUND_MANAGER",
  },
  {
    id: "Investment Manager",
    label: "Investment Manager",
    icon: "💼",
    description: "Asset allocation, sovereign wealth, AUM reporting, mandate compliance",
    color: "#FBBF24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.35)",
    glow: "rgba(251,191,36,0.25)",
    persona: "INVESTMENT_MANAGER",
  },
  {
    id: "Investment Analyst",
    label: "Investment Analyst",
    icon: "📈",
    description: "DCF modeling, earnings analysis, equity research, comps",
    color: "#A78BFA",
    bg: "rgba(167,139,250,0.10)",
    border: "rgba(167,139,250,0.35)",
    glow: "rgba(167,139,250,0.25)",
    persona: "INVESTMENT_ANALYST",
  },
  {
    id: "Doctor",
    label: "Doctor",
    icon: "🩺",
    description: "Clinical summaries, drug interactions, ICD coding, medical literature",
    color: "#22D3EE",
    bg: "rgba(34,211,238,0.10)",
    border: "rgba(34,211,238,0.35)",
    glow: "rgba(34,211,238,0.25)",
    persona: "DOCTOR",
  },
  {
    id: "Student",
    label: "Student",
    icon: "🎓",
    description: "Research assistance, citations, concept explanations, essay outlining",
    color: "#818CF8",
    bg: "rgba(129,140,248,0.10)",
    border: "rgba(129,140,248,0.35)",
    glow: "rgba(129,140,248,0.25)",
    persona: "STUDENT",
  },
  {
    id: "Legal",
    label: "Lawyer",
    icon: "⚖️",
    description: "Contract review, regulatory compliance, legal extraction, GCC law",
    color: "#94A3B8",
    bg: "rgba(148,163,184,0.10)",
    border: "rgba(148,163,184,0.35)",
    glow: "rgba(148,163,184,0.25)",
    persona: "LAWYER",
  },
  {
    id: "Healthcare",
    label: "Healthcare",
    icon: "🏥",
    description: "Hospital ops, bed management, staffing, patient flow, clinical reporting",
    color: "#6EE7B7",
    bg: "rgba(110,231,183,0.10)",
    border: "rgba(110,231,183,0.35)",
    glow: "rgba(110,231,183,0.25)",
    persona: "DOCTOR",
  },
  {
    id: "Retailer",
    label: "Retailer",
    icon: "🛒",
    description: "Demand forecasting, inventory, supplier risk, pricing intelligence",
    color: "#FB923C",
    bg: "rgba(251,146,60,0.10)",
    border: "rgba(251,146,60,0.35)",
    glow: "rgba(251,146,60,0.25)",
    persona: "RETAILER",
  },
  {
    id: "Office Clerk",
    label: "Office Clerk",
    icon: "📋",
    description: "Document processing, email drafting, meeting notes, task prioritisation",
    color: "#2DD4BF",
    bg: "rgba(45,212,191,0.10)",
    border: "rgba(45,212,191,0.35)",
    glow: "rgba(45,212,191,0.25)",
    persona: "OFFICE_CLERK",
  },
  {
    id: "Manager",
    label: "Manager",
    icon: "🎯",
    description: "Team performance, KPIs, project tracking, budget variance",
    color: "#F87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.35)",
    glow: "rgba(248,113,113,0.25)",
    persona: "MANAGER",
  },
  {
    id: "Marketing Manager",
    label: "Marketing Manager",
    icon: "📣",
    description: "Campaign analysis, audience segmentation, content briefs, competitor monitoring",
    color: "#F472B6",
    bg: "rgba(244,114,182,0.10)",
    border: "rgba(244,114,182,0.35)",
    glow: "rgba(244,114,182,0.25)",
    persona: "MARKETING_MANAGER",
  },
  {
    id: "Enterprise",
    label: "Enterprise",
    icon: "🏢",
    description: "Workflow automation, multi-domain routing, HR, procurement, SLA management",
    color: "#9CA3AF",
    bg: "rgba(156,163,175,0.10)",
    border: "rgba(156,163,175,0.35)",
    glow: "rgba(156,163,175,0.25)",
    persona: "ENTERPRISE",
  },
  {
    id: "GCC Wealth",
    label: "GCC Wealth",
    icon: "💎",
    description: "Private wealth, HNWI profiling, Shariah compliance, family office",
    color: "#C9A84C",
    bg: "rgba(201,168,76,0.10)",
    border: "rgba(201,168,76,0.35)",
    glow: "rgba(201,168,76,0.25)",
    persona: "INVESTMENT_MANAGER",
  },
  {
    id: "OTHER",
    label: "Other / General",
    icon: "✨",
    description: "Research, document review, task assistance, general analysis",
    color: "#E879F9",
    bg: "rgba(232,121,249,0.10)",
    border: "rgba(232,121,249,0.35)",
    glow: "rgba(232,121,249,0.25)",
    persona: "OTHER",
  },
];

// ── Capability badge colours ───────────────────────────────────────────────────

const CAP_COLORS: Record<string, string> = {
  "deal-screening": "#7BA3D4",
  "due-diligence": "#60C8F5",
  "portfolio-monitoring": "#4ADE80",
  "contract-review": "#8BBFD4",
  "risk-flagging": "#F87171",
  "document-drafting": "#A78BFA",
  "bed-management": "#7DC4A8",
  "staffing": "#34D399",
  "patient-flow": "#6EE7B7",
  "talent-screening": "#A89BD4",
  "kpi-tracking": "#C084FC",
  "sla-monitoring": "#E879F9",
  "client-profiling": "#C9A84C",
  "shariah-compliance": "#FCD34D",
  "portfolio-construction": "#FDE68A",
};
function capColor(cap: string) {
  return CAP_COLORS[cap] ?? "#637080";
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DomainAgent = {
  id: number;
  agentName: string;
  description: string;
  capabilities: string | null;
  tasksCompleted: number | null;
  successRate: string | null;
  isBuiltIn: boolean | null;
};

// ── Agent Card ────────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  selected,
  domainColor,
  onSelect,
}: {
  agent: DomainAgent;
  selected: boolean;
  domainColor: string;
  onSelect: () => void;
}) {
  let caps: string[] = [];
  try { caps = JSON.parse(agent.capabilities ?? "[]"); } catch { caps = []; }

  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "16px",
        borderRadius: 14,
        border: selected
          ? `2px solid ${domainColor}`
          : "1.5px solid rgba(255,255,255,0.08)",
        background: selected
          ? `linear-gradient(135deg, ${domainColor}18, ${domainColor}08)`
          : "rgba(255,255,255,0.03)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.18s ease",
        position: "relative",
        outline: "none",
        boxShadow: selected ? `0 0 0 3px ${domainColor}30` : "none",
      }}
    >
      {/* Selected check */}
      {selected && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: 20, height: 20, borderRadius: "50%",
          background: domainColor,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${domainColor}18`,
          border: `1px solid ${domainColor}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
        }}>
          🤖
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#F0F4FA", lineHeight: 1.2, paddingRight: 24 }}>
            {agent.agentName}
          </div>
          {agent.isBuiltIn && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 9, color: domainColor, fontFamily: "monospace",
              background: `${domainColor}15`, border: `1px solid ${domainColor}30`,
              borderRadius: 4, padding: "1px 6px", marginTop: 3,
            }}>
              ✓ PLATFORM
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 12, color: "rgba(240,244,250,0.55)", lineHeight: 1.55, margin: 0 }}>
        {agent.description}
      </p>

      {/* Capabilities */}
      {caps.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {caps.slice(0, 3).map((c) => (
            <span key={c} style={{
              fontSize: 9, padding: "2px 7px", borderRadius: 4,
              background: `${capColor(c)}15`,
              border: `1px solid ${capColor(c)}30`,
              color: capColor(c),
              fontFamily: "monospace",
              textTransform: "lowercase",
            }}>
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      {(agent.tasksCompleted != null || agent.successRate != null) && (
        <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
          {agent.tasksCompleted != null && (
            <span style={{ fontSize: 10, color: "rgba(240,244,250,0.35)", fontFamily: "monospace" }}>
              {agent.tasksCompleted} tasks
            </span>
          )}
          {agent.successRate != null && (
            <span style={{ fontSize: 10, color: "#4ADE80", fontFamily: "monospace" }}>
              {parseFloat(agent.successRate).toFixed(0)}% success
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PersonaSelector() {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedDomain, setSelectedDomain] = useState<typeof DOMAIN_TILES[0] | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<DomainAgent | null>(null);
  const [, navigate] = useLocation();

  const utils = trpc.useUtils();

  // Fetch agent counts for all domains (used on step 1 to show badge + hide empty tiles)
  const countsQuery = trpc.agent.countByDomain.useQuery(undefined, { staleTime: 120_000 });
  const domainCounts: Record<string, number> = countsQuery.data ?? {};

  // Fetch agents for selected domain (only when a domain is selected)
  const agentsQuery = trpc.agent.listByDomain.useQuery(
    { domain: selectedDomain?.id ?? "" },
    {
      enabled: !!selectedDomain && selectedDomain.id !== "OTHER",
      staleTime: 60_000,
    }
  );

  const classifyPersona = trpc.identity.classifyPersona.useMutation({
    onSuccess: async () => {
      await utils.identity.getProfile.invalidate();
      if (selectedAgent) {
        navigate(`/ask?agent=${selectedAgent.id}&agentName=${encodeURIComponent(selectedAgent.agentName)}`);
      } else {
        navigate("/ask");
      }
    },
    onError: () => {
      if (selectedAgent) {
        navigate(`/ask?agent=${selectedAgent.id}&agentName=${encodeURIComponent(selectedAgent.agentName)}`);
      } else {
        navigate("/ask");
      }
    },
  });

  const handleDomainClick = (domain: typeof DOMAIN_TILES[0]) => {
    setSelectedDomain(domain);
    setSelectedAgent(null);
    if (domain.id === "OTHER") {
      // No agents to show for "Other", go straight to confirm
      setStep(2);
    } else {
      setStep(2);
    }
  };

  const handleConfirm = () => {
    if (!selectedDomain) return;
    classifyPersona.mutate({ selectedPersona: selectedDomain.persona });
  };

  const handleBack = () => {
    setStep(1);
    setSelectedAgent(null);
  };

  const domainColor = selectedDomain?.color ?? "#7BA3D4";
  const agents = (agentsQuery.data ?? []) as DomainAgent[];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080D1A",
      color: "#F0F4FA",
      fontFamily: "'Inter', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 32px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <Logo size={32} />
        </a>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[1, 2].map((s) => (
            <div key={s} style={{
              width: s === step ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: s === step ? "#38BDF8" : "rgba(255,255,255,0.12)",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        <div style={{ width: 80 }} />
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1,
        maxWidth: 900,
        width: "100%",
        margin: "0 auto",
        padding: "40px 24px 60px",
      }}>

        {/* ── STEP 1: Domain selection ── */}
        {step === 1 && (
          <>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <h1 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>
                What best describes your work?
              </h1>
              <p style={{ fontSize: 14, color: "rgba(240,244,250,0.45)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
                Select your domain. The Mesh will show you the specialist agents built for your field.
              </p>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 14,
            }}>
              {DOMAIN_TILES.map((tile) => {
                const agentCount = domainCounts[tile.id] ?? 0;
                return (
                <button
                  key={tile.id}
                  onClick={() => handleDomainClick(tile)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: "20px",
                    borderRadius: 16,
                    border: `1.5px solid ${tile.border}`,
                    background: tile.bg,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.18s ease",
                    outline: "none",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 2px ${tile.glow}, 0 8px 32px ${tile.glow}`;
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLButtonElement).style.transform = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: `${tile.color}18`,
                      border: `1px solid ${tile.color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22, flexShrink: 0,
                    }}>
                      {tile.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#F0F4FA" }}>{tile.label}</div>
                      <div style={{ fontSize: 10, color: tile.color, fontFamily: "monospace", marginTop: 2 }}>
                        {tile.id === "OTHER" ? "General" : `${tile.id} domain`}
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(240,244,250,0.45)", lineHeight: 1.6, margin: 0 }}>
                    {tile.description}
                  </p>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    {/* Agent count badge */}
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: agentCount > 0 ? tile.color : "rgba(240,244,250,0.25)",
                      background: agentCount > 0 ? `${tile.color}15` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${agentCount > 0 ? tile.color + "30" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 20,
                      padding: "2px 9px",
                    }}>
                      {countsQuery.isLoading ? "…" : agentCount > 0 ? `${agentCount} agent${agentCount !== 1 ? "s" : ""}` : "0 agents"}
                    </span>
                    <span style={{ fontSize: 12, color: tile.color, fontWeight: 600, marginLeft: "auto" }}>
                      View agents →
                    </span>
                  </div>
                </button>
              );
              })}
            </div>
          </>
        )}

        {/* ── STEP 2: Agent selection ── */}
        {step === 2 && selectedDomain && (
          <>
            {/* Back + heading */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
              <button
                onClick={handleBack}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "6px 14px",
                  color: "rgba(240,244,250,0.6)", fontSize: 13, cursor: "pointer",
                }}
              >
                ← Back
              </button>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{selectedDomain.icon}</span>
                  <h2 style={{ fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
                    {selectedDomain.label} Agents
                  </h2>
                </div>
                <p style={{ fontSize: 13, color: "rgba(240,244,250,0.4)", margin: "4px 0 0" }}>
                  {selectedDomain.id === "OTHER"
                    ? "General-purpose agents for research, documents, and tasks"
                    : `Select an agent to work with in the ${selectedDomain.label} domain`}
                </p>
              </div>
            </div>

            {/* Agent grid */}
            {selectedDomain.id === "OTHER" ? (
              /* No specific agents for Other — show a simple message */
              <div style={{
                padding: "40px 24px", textAlign: "center",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16, marginBottom: 28,
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
                <p style={{ fontSize: 14, color: "rgba(240,244,250,0.5)", lineHeight: 1.7 }}>
                  The Mesh will automatically select the best general-purpose agents for your task.<br />
                  Just describe what you need on the next screen.
                </p>
              </div>
            ) : agentsQuery.isLoading ? (
              /* Loading skeleton */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 28 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{
                    height: 140, borderRadius: 14,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }} />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div style={{
                padding: "40px 24px", textAlign: "center",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16, marginBottom: 28,
              }}>
                <p style={{ fontSize: 14, color: "rgba(240,244,250,0.4)" }}>
                  No agents found for this domain yet.
                </p>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 12,
                marginBottom: 28,
              }}>
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    selected={selectedAgent?.id === agent.id}
                    domainColor={domainColor}
                    onSelect={() => {
                      setSelectedAgent(agent);
                      if (selectedDomain) {
                        classifyPersona.mutate({ selectedPersona: selectedDomain.persona });
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {/* Loading state while navigating */}
            {classifyPersona.isPending ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0" }}>
                <svg style={{ animation: "spin 1s linear infinite", width: 28, height: 28, color: domainColor }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 13, color: domainColor, fontWeight: 600 }}>
                  {selectedAgent ? `Opening ${selectedAgent.agentName}…` : "Configuring your Mesh…"}
                </span>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "rgba(240,244,250,0.30)", textAlign: "center", marginTop: 4 }}>
                Click any agent card to open it directly in the Mesh
              </p>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
