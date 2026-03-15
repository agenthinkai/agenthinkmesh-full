/**
 * Persona Selector — 2-step flow:
 *  Step 1: Choose a role (Doctor / Lawyer / Manager / etc.)
 *  Step 2: Browse agents for that role's domain, click one to run it
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import Logo from "@/components/Logo";
import SiteNav from "@/components/SiteNav";

// ── Role tiles ────────────────────────────────────────────────────────────────

const ROLE_TILES = [
  {
    id: "doctor",
    label: "Doctor",
    icon: "🩺",
    color: "#22D3EE",
    domain: "Healthcare",
    persona: "DOCTOR",
    desc: "Clinical summaries, drug interactions, ICD coding, patient records",
  },
  {
    id: "lawyer",
    label: "Lawyer",
    icon: "⚖️",
    color: "#94A3B8",
    domain: "Legal",
    persona: "LAWYER",
    desc: "Contract review, clause extraction, GCC compliance, risk scoring",
  },
  {
    id: "manager",
    label: "Manager",
    icon: "🎯",
    color: "#F87171",
    domain: "Enterprise",
    persona: "ENTERPRISE",
    desc: "KPI tracking, budget analysis, project monitoring, meeting summaries",
  },
  {
    id: "analyst",
    label: "Financial Analyst",
    icon: "📈",
    color: "#4ADE80",
    domain: "Finance",
    persona: "FUND_MANAGER",
    desc: "Deal screening, DCF models, comps, macro monitoring",
  },
  {
    id: "banker",
    label: "Banker",
    icon: "🏦",
    color: "#60A5FA",
    domain: "Finance",
    persona: "FUND_MANAGER",
    desc: "KYC/AML, credit risk, loan structuring, portfolio monitoring",
  },
  {
    id: "investor",
    label: "Investor",
    icon: "💎",
    color: "#C9A84C",
    domain: "GCC Wealth",
    persona: "INVESTMENT_MANAGER",
    desc: "Private wealth, HNWI profiling, Shariah compliance, family office",
  },
  {
    id: "student",
    label: "Student",
    icon: "🎓",
    color: "#818CF8",
    domain: "Education",
    persona: "STUDENT",
    desc: "Research assistance, citations, essay outlining, study planning",
  },
  {
    id: "enterprise",
    label: "Enterprise",
    icon: "🏢",
    color: "#E879F9",
    domain: "Enterprise",
    persona: "ENTERPRISE",
    desc: "HR, procurement, SLA management, workflow automation",
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
  roleColor,
  onSelect,
}: {
  agent: DomainAgent;
  roleColor: string;
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
        border: `1.5px solid rgba(255,255,255,0.08)`,
        background: "rgba(255,255,255,0.03)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.18s ease",
        outline: "none",
        width: "100%",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.border = `1.5px solid ${roleColor}60`;
        el.style.background = `${roleColor}0A`;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = `0 8px 24px ${roleColor}20`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.border = "1.5px solid rgba(255,255,255,0.08)";
        el.style.background = "rgba(255,255,255,0.03)";
        el.style.transform = "none";
        el.style.boxShadow = "none";
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${roleColor}18`,
          border: `1px solid ${roleColor}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
        }}>
          🤖
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#F0F4FA", lineHeight: 1.2 }}>
            {agent.agentName}
          </div>
          {agent.isBuiltIn && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 9, color: roleColor, fontFamily: "monospace",
              background: `${roleColor}15`, border: `1px solid ${roleColor}30`,
              borderRadius: 4, padding: "1px 6px", marginTop: 3,
            }}>
              ✓ PLATFORM
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color: roleColor, fontWeight: 600, flexShrink: 0 }}>
          Run →
        </span>
      </div>

      {/* Description */}
      {agent.description && (
        <p style={{ fontSize: 11, color: "rgba(240,244,250,0.45)", lineHeight: 1.55, margin: 0 }}>
          {agent.description.length > 100 ? agent.description.slice(0, 100) + "…" : agent.description}
        </p>
      )}

      {/* Capabilities */}
      {caps.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {caps.slice(0, 3).map((cap) => (
            <span key={cap} style={{
              fontSize: 9, padding: "2px 7px", borderRadius: 10,
              background: `${capColor(cap)}18`,
              border: `1px solid ${capColor(cap)}30`,
              color: capColor(cap),
              fontFamily: "monospace",
            }}>
              {cap}
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
  const [selectedRole, setSelectedRole] = useState<typeof ROLE_TILES[0] | null>(null);
  const [, navigate] = useLocation();

  const utils = trpc.useUtils();

  // Fetch agent counts per domain for Step 1 badges
  const countQuery = trpc.agent.countByDomain.useQuery(undefined, { staleTime: 60_000 });
  const domainCounts: Record<string, number> = countQuery.data ?? {};

  // Fetch agents for selected role's domain
  const agentsQuery = trpc.agent.listByDomain.useQuery(
    { domain: selectedRole?.domain ?? "" },
    { enabled: !!selectedRole, staleTime: 60_000 }
  );

  const classifyPersona = trpc.identity.classifyPersona.useMutation({
    onSuccess: async (_, variables) => {
      await utils.identity.getProfile.invalidate();
      navigate("/ask");
    },
    onError: () => {
      navigate("/ask");
    },
  });

  const handleRoleClick = (role: typeof ROLE_TILES[0]) => {
    setSelectedRole(role);
    setStep(2);
  };

  const handleAgentClick = (agent: DomainAgent) => {
    if (!selectedRole) return;
    classifyPersona.mutate({ selectedPersona: selectedRole.persona });
    // Navigate immediately with agent context; mutation runs in background
    navigate(`/ask?agent=${agent.id}&agentName=${encodeURIComponent(agent.agentName)}`);
  };

  const handleBack = () => {
    setStep(1);
    setSelectedRole(null);
  };

  const roleColor = selectedRole?.color ?? "#7BA3D4";
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
      {/* ── Shared sticky navbar ── */}
      <SiteNav />

      {/* ── Step indicator sub-bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "10px 32px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
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

      {/* ── Body ── */}
      <div style={{
        flex: 1,
        maxWidth: 900,
        width: "100%",
        margin: "0 auto",
        padding: "40px 24px 60px",
      }}>

        {/* ── STEP 1: Role selection ── */}
        {step === 1 && (
          <>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ fontSize: 11, color: "rgba(240,244,250,0.35)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 10 }}>
                Step 1 of 2
              </div>
              <h1 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>
                What best describes your role?
              </h1>
              <p style={{ fontSize: 14, color: "rgba(240,244,250,0.45)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
                Select your professional role. We'll show you the specialist agents built for your field.
              </p>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
            }}>
              {ROLE_TILES.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleRoleClick(role)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: "20px",
                    borderRadius: 16,
                    border: `1.5px solid ${role.color}40`,
                    background: `${role.color}0A`,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.18s ease",
                    outline: "none",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.boxShadow = `0 0 0 2px ${role.color}30, 0 8px 32px ${role.color}20`;
                    el.style.transform = "translateY(-2px)";
                    el.style.borderColor = `${role.color}70`;
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.boxShadow = "none";
                    el.style.transform = "none";
                    el.style.borderColor = `${role.color}40`;
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: `${role.color}18`,
                      border: `1px solid ${role.color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22, flexShrink: 0,
                    }}>
                      {role.icon}
                    </div>
                    <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#F0F4FA" }}>{role.label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: role.color, fontFamily: "monospace" }}>
                        {role.domain}
                      </span>
                      {domainCounts[role.domain] != null && (
                        <span style={{
                          fontSize: 9, fontFamily: "monospace", fontWeight: 700,
                          background: `${role.color}20`,
                          border: `1px solid ${role.color}40`,
                          color: role.color,
                          borderRadius: 10,
                          padding: "1px 7px",
                        }}>
                          {domainCounts[role.domain]} agents
                        </span>
                      )}
                    </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(240,244,250,0.45)", lineHeight: 1.6, margin: 0 }}>
                    {role.desc}
                  </p>
                  <span style={{ fontSize: 12, color: role.color, fontWeight: 600, alignSelf: "flex-end" }}>
                    Select →
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── STEP 2: Agent list ── */}
        {step === 2 && selectedRole && (
          <>
            {/* Back + heading */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 32 }}>
              <button
                onClick={handleBack}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "6px 14px",
                  color: "rgba(240,244,250,0.6)", fontSize: 13, cursor: "pointer",
                  flexShrink: 0, marginTop: 4,
                }}
              >
                ← Back
              </button>
              <div>
                <div style={{ fontSize: 11, color: "rgba(240,244,250,0.35)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6 }}>
                  Step 2 of 2
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>{selectedRole.icon}</span>
                  <h2 style={{ fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
                    {selectedRole.label} Agents
                  </h2>
                  <span style={{
                    fontSize: 10, color: roleColor, fontFamily: "monospace",
                    background: `${roleColor}15`, border: `1px solid ${roleColor}30`,
                    borderRadius: 4, padding: "2px 8px", fontWeight: 700,
                  }}>
                    {selectedRole.domain}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "rgba(240,244,250,0.4)", margin: 0 }}>
                  Click any agent to run it instantly in the Mesh
                </p>
              </div>
            </div>

            {/* Agent grid */}
            {agentsQuery.isLoading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
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
                padding: "48px 24px", textAlign: "center",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16,
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <p style={{ fontSize: 14, color: "rgba(240,244,250,0.4)", lineHeight: 1.7 }}>
                  No agents found for this domain yet.<br />
                  <a href="/ask" style={{ color: roleColor, textDecoration: "none", fontWeight: 600 }}>
                    Go to the Mesh →
                  </a>
                </p>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 12,
              }}>
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    roleColor={roleColor}
                    onSelect={() => handleAgentClick(agent)}
                  />
                ))}
              </div>
            )}

            {/* Loading state while navigating */}
            {classifyPersona.isPending && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0", marginTop: 16 }}>
                <svg style={{ animation: "spin 1s linear infinite", width: 28, height: 28, color: roleColor }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 13, color: roleColor, fontWeight: 600 }}>
                  Launching agent…
                </span>
              </div>
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
