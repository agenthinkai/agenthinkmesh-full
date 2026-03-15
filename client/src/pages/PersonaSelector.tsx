/**
 * Persona Selector — 2-step flow:
 *  Step 1: Choose a domain/role from DB (sorted A–Z, with live agent counts)
 *  Step 2: Browse agents for that domain, click one to run it
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import SiteNav from "@/components/SiteNav";

// ── Domain metadata (icon + colour + description) ─────────────────────────────
// Keyed by domain name (case-insensitive match attempted)
const DOMAIN_META: Record<string, { icon: string; color: string; desc: string; persona: string }> = {
  "Education":    { icon: "🎓", color: "#818CF8", desc: "Research assistance, citations, essay outlining, study planning", persona: "STUDENT" },
  "Enterprise":   { icon: "🏢", color: "#E879F9", desc: "HR, procurement, SLA management, workflow automation", persona: "ENTERPRISE" },
  "Finance":      { icon: "📈", color: "#4ADE80", desc: "Deal screening, DCF models, comps, macro monitoring, KYC/AML", persona: "FUND_MANAGER" },
  "GCC Wealth":   { icon: "💎", color: "#C9A84C", desc: "Private wealth, HNWI profiling, Shariah compliance, family office", persona: "INVESTMENT_MANAGER" },
  "Healthcare":   { icon: "🩺", color: "#22D3EE", desc: "Clinical summaries, drug interactions, ICD coding, patient records", persona: "DOCTOR" },
  "Legal":        { icon: "⚖️", color: "#94A3B8", desc: "Contract review, clause extraction, GCC compliance, risk scoring", persona: "LAWYER" },
};

// Fallback for any domain not in the map above
function domainMeta(domain: string) {
  // Try exact match first, then case-insensitive
  if (DOMAIN_META[domain]) return DOMAIN_META[domain];
  const key = Object.keys(DOMAIN_META).find(k => k.toLowerCase() === domain.toLowerCase());
  if (key) return DOMAIN_META[key];
  return { icon: "🤖", color: "#7BA3D4", desc: `Specialist agents for ${domain}`, persona: "ENTERPRISE" };
}

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
  const [selectedDomain, setSelectedDomain] = useState<{ domain: string; count: number } | null>(null);
  const [, navigate] = useLocation();

  const utils = trpc.useUtils();

  // Fetch all roles sorted A-Z from DB with live agent counts
  const rolesQuery = trpc.agent.listRoles.useQuery(undefined, { staleTime: 60_000 });
  const dbRoles = rolesQuery.data ?? [];

  // Fetch agents for selected domain
  const agentsQuery = trpc.agent.listByDomain.useQuery(
    { domain: selectedDomain?.domain ?? "" },
    { enabled: !!selectedDomain, staleTime: 60_000 }
  );

  const classifyPersona = trpc.identity.classifyPersona.useMutation({
    onSuccess: async () => {
      await utils.identity.getProfile.invalidate();
      navigate("/ask");
    },
    onError: () => {
      navigate("/ask");
    },
  });

  const handleRoleClick = (r: typeof dbRoles[0]) => {
    setSelectedDomain({ domain: r.domain, count: r.agentCount });
    setStep(2);
  };

  const handleAgentClick = (agent: DomainAgent) => {
    if (!selectedDomain) return;
    const meta = domainMeta(selectedDomain.domain);
    classifyPersona.mutate({ selectedPersona: meta.persona });
    navigate(`/ask?agent=${agent.id}&agentName=${encodeURIComponent(agent.agentName)}`);
  };

  const handleBack = () => {
    setStep(1);
    setSelectedDomain(null);
  };

  const meta = selectedDomain ? domainMeta(selectedDomain.domain) : null;
  const roleColor = meta?.color ?? "#7BA3D4";
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
        maxWidth: 1000,
        width: "100%",
        margin: "0 auto",
        padding: "40px 24px 60px",
      }}>

        {/* ── STEP 1: Role selection (A–Z from DB) ── */}
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
              {rolesQuery.isLoading && (
                <p style={{ fontSize: 12, color: "rgba(240,244,250,0.3)", marginTop: 12, fontFamily: "monospace" }}>
                  Loading roles…
                </p>
              )}
              {!rolesQuery.isLoading && dbRoles.length > 0 && (
                <p style={{ fontSize: 12, color: "rgba(240,244,250,0.3)", marginTop: 12, fontFamily: "monospace" }}>
                  {dbRoles.length} roles · {dbRoles.reduce((sum, r) => sum + r.agentCount, 0)} specialist agents
                </p>
              )}
            </div>

            {rolesQuery.isLoading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} style={{
                    height: 140, borderRadius: 16,
                    background: "rgba(255,255,255,0.03)",
                    border: "1.5px solid rgba(255,255,255,0.06)",
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${i * 0.1}s`,
                  }} />
                ))}
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 14,
              }}>
                {dbRoles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleRoleClick(r)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      padding: "20px",
                      borderRadius: 16,
                      border: `1.5px solid ${r.color}40`,
                      background: `${r.color}0A`,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.18s ease",
                      outline: "none",
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.boxShadow = `0 0 0 2px ${r.color}30, 0 8px 32px ${r.color}20`;
                      el.style.transform = "translateY(-2px)";
                      el.style.borderColor = `${r.color}70`;
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.boxShadow = "none";
                      el.style.transform = "none";
                      el.style.borderColor = `${r.color}40`;
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: `${r.color}18`,
                        border: `1px solid ${r.color}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, flexShrink: 0,
                      }}>
                        {r.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#F0F4FA" }}>{r.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <span style={{
                            fontSize: 9, fontFamily: "monospace", fontWeight: 700,
                            background: `${r.color}20`,
                            border: `1px solid ${r.color}40`,
                            color: r.color,
                            borderRadius: 10,
                            padding: "1px 7px",
                          }}>
                            {r.domain}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: "rgba(240,244,250,0.45)", lineHeight: 1.6, margin: 0, flex: 1 }}>
                      {r.description}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{
                        fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(240,244,250,0.45)",
                        borderRadius: 8,
                        padding: "3px 9px",
                      }}>
                        {r.agentCount} agents
                      </span>
                      <span style={{ fontSize: 12, color: r.color, fontWeight: 600 }}>
                        Select →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── STEP 2: Agent list ── */}
        {step === 2 && selectedDomain && meta && (
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
                  <span style={{ fontSize: 22 }}>{meta.icon}</span>
                  <h2 style={{ fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
                    {selectedDomain.domain} Agents
                  </h2>
                  <span style={{
                    fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                    background: `${roleColor}20`, border: `1px solid ${roleColor}40`,
                    color: roleColor, borderRadius: 10, padding: "2px 9px",
                  }}>
                    {selectedDomain.count} agents
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "rgba(240,244,250,0.45)", margin: 0 }}>
                  Click any agent to launch it in the Mesh.
                </p>
              </div>
            </div>

            {agentsQuery.isLoading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{
                    height: 120, borderRadius: 14,
                    background: "rgba(255,255,255,0.03)",
                    border: "1.5px solid rgba(255,255,255,0.06)",
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${i * 0.1}s`,
                  }} />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(240,244,250,0.35)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 14 }}>No agents found for this domain yet.</div>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
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
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
