/**
 * KnowledgeVault — Browse and search 460 GCC synthetic scenarios across 8 domains.
 * Used as the RAG grounding layer for all AgenThinkMesh agents.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import SiteNav from "@/components/SiteNav";

const NAVY = "#080D1A";
const AMBER = "#F59E0B";
const WHITE = "#F0F4FA";
const MUTED = "rgba(240,244,250,0.55)";
const CARD_BG = "rgba(15,25,50,0.85)";

const DOMAIN_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  deal_screening: { label: "Deal Screening", color: "#60A5FA", icon: "🏦" },
  wealth_management: { label: "Wealth Management", color: "#A78BFA", icon: "💎" },
  insurance_underwriting: { label: "Insurance Underwriting", color: "#0EA5E9", icon: "🏛️" },
  mvno_intelligence: { label: "MVNO Intelligence", color: "#d4a843", icon: "📡" },
  legal_review: { label: "Legal Review", color: "#F97316", icon: "⚖️" },
  budget_forecasting: { label: "Budget Forecasting", color: "#34D399", icon: "📊" },
  social_media: { label: "Social Media", color: "#EC4899", icon: "📲" },
  ic_reports: { label: "IC Reports", color: "#7BA3D4", icon: "📋" },
};

type DomainKey = "deal_screening" | "wealth_management" | "insurance_underwriting" | "mvno_intelligence" | "legal_review" | "budget_forecasting" | "social_media" | "ic_reports";
const DOMAINS: DomainKey[] = ["deal_screening", "wealth_management", "insurance_underwriting", "mvno_intelligence", "legal_review", "budget_forecasting", "social_media", "ic_reports"];

interface ScenarioContent {
  executive_summary?: string;
  investment_thesis?: string[];
  key_risks?: string[];
  recommended_action?: string;
  ic_recommendation?: string;
  key_financials?: Record<string, unknown>;
  [key: string]: unknown;
}

function ScenarioDetailPanel({ scenarioId, onClose }: { scenarioId: string; onClose: () => void }) {
  const { data: scenario } = trpc.knowledgeVault.getById.useQuery({ scenarioId });
  if (!scenario) return null;

  const cfg = DOMAIN_CONFIG[scenario.domain] ?? { color: AMBER, icon: "📄", label: scenario.domain };
  const content = scenario.parsedContent as ScenarioContent | null;
  const risks: string[] = content?.key_risks ?? [];
  const thesis: string[] = content?.investment_thesis ?? [];

  return (
    <div style={{
      width: 400, flexShrink: 0,
      background: CARD_BG, border: "1px solid rgba(245,158,11,0.2)",
      borderRadius: 12, padding: 20, height: "fit-content",
      position: "sticky", top: 80,
      maxHeight: "calc(100vh - 120px)", overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>{cfg.icon}</span>
        <div>
          <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700, letterSpacing: 0.5 }}>
            {scenario.scenarioId} · {cfg.label}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: WHITE }}>{scenario.title}</div>
        </div>
        <button
          onClick={onClose}
          style={{ marginLeft: "auto", background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 18, padding: 4 }}
        >×</button>
      </div>

      {scenario.geography && (
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
          📍 {scenario.geography}{scenario.sector ? ` · ${scenario.sector}` : ""}
        </div>
      )}

      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.7, marginBottom: 16 }}>
        {scenario.summary}
      </div>

      {content && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Executive Summary */}
          {content.executive_summary && (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12, borderLeft: `3px solid ${cfg.color}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, marginBottom: 6, letterSpacing: 0.5 }}>EXECUTIVE SUMMARY</div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                {content.executive_summary.substring(0, 300)}{content.executive_summary.length > 300 ? "..." : ""}
              </div>
            </div>
          )}

          {/* Investment Thesis */}
          {thesis.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, marginBottom: 6, letterSpacing: 0.5 }}>INVESTMENT THESIS</div>
              {thesis.slice(0, 2).map((point, i) => (
                <div key={i} style={{ fontSize: 12, color: MUTED, marginBottom: 6, paddingLeft: 12, borderLeft: "2px solid rgba(255,255,255,0.1)", lineHeight: 1.5 }}>
                  {point}
                </div>
              ))}
            </div>
          )}

          {/* Key Risks */}
          {risks.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#F87171", marginBottom: 6, letterSpacing: 0.5 }}>KEY RISKS</div>
              {risks.slice(0, 2).map((risk, i) => (
                <div key={i} style={{ fontSize: 12, color: MUTED, marginBottom: 6, paddingLeft: 12, borderLeft: "2px solid rgba(248,113,113,0.3)", lineHeight: 1.5 }}>
                  {risk}
                </div>
              ))}
            </div>
          )}

          {/* Recommended Action */}
          {content.recommended_action && (
            <div style={{ background: `${cfg.color}10`, borderRadius: 8, padding: 12, border: `1px solid ${cfg.color}25` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, marginBottom: 6, letterSpacing: 0.5 }}>RECOMMENDED ACTION</div>
              <div style={{ fontSize: 12, color: WHITE, lineHeight: 1.6 }}>{content.recommended_action}</div>
            </div>
          )}

          {/* IC Recommendation */}
          {content.ic_recommendation && (
            <div style={{ background: "rgba(52,211,153,0.08)", borderRadius: 8, padding: 10, border: "1px solid rgba(52,211,153,0.2)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#34D399", marginBottom: 4, letterSpacing: 0.5 }}>IC RECOMMENDATION</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#34D399" }}>{content.ic_recommendation}</div>
            </div>
          )}

          {/* Key Financials */}
          {content.key_financials && typeof content.key_financials === "object" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, marginBottom: 8, letterSpacing: 0.5 }}>KEY FINANCIALS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {Object.entries(content.key_financials).slice(0, 4).map(([k, v]) => (
                  <div key={k} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>{k.replace(/_/g, " ").toUpperCase()}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>
                      {typeof v === "number" ? v.toLocaleString() : String(v)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeVault() {
  const [selectedDomain, setSelectedDomain] = useState<DomainKey | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as unknown as { _kvTimer?: ReturnType<typeof setTimeout> })._kvTimer);
    (window as unknown as { _kvTimer?: ReturnType<typeof setTimeout> })._kvTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  };

  const { data: stats } = trpc.knowledgeVault.stats.useQuery();
  const { data: listData, isLoading } = trpc.knowledgeVault.list.useQuery({
    domain: selectedDomain,
    search: debouncedSearch || undefined,
    page,
    pageSize: 20,
  });

  const totalPages = listData ? Math.ceil(listData.total / 20) : 1;

  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: WHITE, fontFamily: "'Inter', sans-serif" }}>
      <SiteNav />

      {/* Header */}
      <div style={{
        padding: "48px 32px 32px",
        borderBottom: "1px solid rgba(245,158,11,0.15)",
        background: "linear-gradient(180deg, rgba(245,158,11,0.06) 0%, transparent 100%)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 32 }}>🧠</span>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: AMBER, margin: 0, letterSpacing: "-0.5px" }}>
              Knowledge Vault
            </h1>
            <span style={{
              fontSize: 11, fontWeight: 700, color: AMBER,
              background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 20, padding: "3px 10px", letterSpacing: 1,
            }}>RAG LAYER</span>
          </div>
          <p style={{ color: MUTED, fontSize: 14, margin: "0 0 24px", maxWidth: 600 }}>
            {stats?.total ?? 460} GCC enterprise scenarios across {stats?.byDomain.length ?? 8} domains.
            Agents retrieve relevant context from this vault before generating analysis outputs.
          </p>

          {/* Domain filter pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => { setSelectedDomain(undefined); setPage(1); }}
              style={{
                padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                background: !selectedDomain ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                border: !selectedDomain ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.1)",
                color: !selectedDomain ? AMBER : MUTED,
              }}
            >
              All ({stats?.total ?? 460})
            </button>
            {DOMAINS.map(domain => {
              const cfg = DOMAIN_CONFIG[domain];
              const count = stats?.byDomain.find(d => d.domain === domain)?.count ?? 0;
              const isActive = selectedDomain === domain;
              return (
                <button
                  key={domain}
                  onClick={() => { setSelectedDomain(domain); setPage(1); }}
                  style={{
                    padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                    background: isActive ? `${cfg.color}22` : "rgba(255,255,255,0.04)",
                    border: isActive ? `1px solid ${cfg.color}60` : "1px solid rgba(255,255,255,0.1)",
                    color: isActive ? cfg.color : MUTED,
                  }}
                >
                  {cfg.icon} {cfg.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px", display: "flex", gap: 24 }}>
        {/* Left: list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search */}
          <div style={{ marginBottom: 20, position: "relative" }}>
            <input
              type="text"
              placeholder="Search by company, sector, geography, keyword..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              style={{
                width: "100%", padding: "10px 16px 10px 40px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, color: WHITE, fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 16 }}>🔍</span>
          </div>

          {listData && (
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
              {listData.total} scenario{listData.total !== 1 ? "s" : ""} found
              {debouncedSearch ? ` for "${debouncedSearch}"` : ""}
              {selectedDomain ? ` in ${DOMAIN_CONFIG[selectedDomain]?.label}` : ""}
            </div>
          )}

          {isLoading ? (
            <div style={{ color: MUTED, textAlign: "center", padding: 48 }}>Loading scenarios...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {listData?.scenarios.map(scenario => {
                const cfg = DOMAIN_CONFIG[scenario.domain] ?? { color: AMBER, icon: "📄", label: scenario.domain };
                const isSelected = selectedScenario === scenario.scenarioId;
                return (
                  <div
                    key={scenario.scenarioId}
                    onClick={() => setSelectedScenario(isSelected ? null : scenario.scenarioId)}
                    style={{
                      background: isSelected ? `${cfg.color}12` : CARD_BG,
                      border: isSelected ? `1px solid ${cfg.color}50` : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: cfg.color,
                            background: `${cfg.color}18`, border: `1px solid ${cfg.color}35`,
                            borderRadius: 4, padding: "1px 6px", letterSpacing: 0.5,
                          }}>{scenario.scenarioId}</span>
                          {scenario.geography && <span style={{ fontSize: 11, color: MUTED }}>📍 {scenario.geography}</span>}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: WHITE, marginBottom: 4 }}>{scenario.title}</div>
                        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
                          {scenario.summary.length > 140 ? scenario.summary.substring(0, 140) + "..." : scenario.summary}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {listData?.scenarios.length === 0 && (
                <div style={{ textAlign: "center", padding: 48, color: MUTED }}>
                  No scenarios match your search. Try different keywords.
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: "6px 16px", borderRadius: 8, fontSize: 13, cursor: page === 1 ? "not-allowed" : "pointer",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: page === 1 ? MUTED : WHITE, opacity: page === 1 ? 0.5 : 1,
                }}
              >← Prev</button>
              <span style={{ padding: "6px 16px", fontSize: 13, color: MUTED }}>Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: "6px 16px", borderRadius: 8, fontSize: 13, cursor: page === totalPages ? "not-allowed" : "pointer",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: page === totalPages ? MUTED : WHITE, opacity: page === totalPages ? 0.5 : 1,
                }}
              >Next →</button>
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        {selectedScenario && (
          <ScenarioDetailPanel
            scenarioId={selectedScenario}
            onClose={() => setSelectedScenario(null)}
          />
        )}
      </div>
    </div>
  );
}
