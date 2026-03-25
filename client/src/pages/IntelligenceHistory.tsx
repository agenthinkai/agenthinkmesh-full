/**
 * IntelligenceHistory — Protected page showing all past analyses
 */
import { useState } from "react";
import SiteNav from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const NAVY_950 = "#080D1A";
const NAVY_800 = "#0F1E38";
const NAVY_700 = "#162847";
const SILVER_50 = "#F0F4FA";
const SILVER_100 = "#E2E8F0";
const SILVER_300 = "#94A3B8";
const SILVER_400 = "#64748B";
const BLUE = "#7BA3D4";
const CYAN = "#38BDF8";
const GOLD = "#F59E0B";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', sans-serif";

function TagBadge({ label, color = BLUE }: { label: string; color?: string }) {
  return (
    <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600, letterSpacing: "0.08em", color, background: `${color}18`, border: `1px solid ${color}35`, borderRadius: 4, padding: "2px 8px", display: "inline-block" }}>
      {label}
    </span>
  );
}

export default function IntelligenceHistory() {
  const { isAuthenticated } = useAuth();
  const loginUrl = getLoginUrl("/intelligence/history");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: analyses = [], isLoading } = trpc.intelligence.listAnalyses.useQuery(
    { limit: 50, offset: 0 },
    { enabled: isAuthenticated }
  );

  const filtered = analyses.filter(a =>
    a.institution.toLowerCase().includes(search.toLowerCase()) ||
    (a.domain ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_950, color: SILVER_50, fontFamily: FONT }}>
        <SiteNav />
        <div style={{ maxWidth: 800, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: SILVER_300, marginBottom: 20 }}>Sign in to view your analysis history</div>
          <a href={loginUrl} style={{ padding: "10px 28px", background: `linear-gradient(135deg, ${BLUE} 0%, #4A90D4 100%)`, color: NAVY_950, borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, color: SILVER_50, fontFamily: FONT }}>
      <SiteNav />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: BLUE, textTransform: "uppercase", letterSpacing: "0.14em", fontFamily: MONO, fontWeight: 600, marginBottom: 8 }}>Intelligence Agent</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: SILVER_50, margin: "0 0 8px" }}>Analysis History</h1>
          <p style={{ fontSize: 14, color: SILVER_300, margin: 0 }}>All your past intelligence analyses — searchable, filterable, and exportable.</p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 24 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by institution or domain…"
            style={{
              width: "100%", background: NAVY_800, border: `1px solid rgba(123,163,212,0.2)`,
              borderRadius: 8, padding: "10px 16px", color: SILVER_50, fontSize: 14,
              fontFamily: FONT, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 60, color: SILVER_400, fontFamily: MONO, fontSize: 13 }}>Loading analyses…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", background: NAVY_800, borderRadius: 12, border: `1px solid rgba(123,163,212,0.12)` }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: SILVER_50, marginBottom: 8 }}>
              {search ? "No analyses match your search" : "No analyses yet"}
            </div>
            <div style={{ fontSize: 14, color: SILVER_300, marginBottom: 24 }}>
              {search ? "Try a different search term" : "Run your first analysis to see it here"}
            </div>
            {!search && (
              <a href="/intelligence" style={{ padding: "10px 24px", background: `linear-gradient(135deg, ${BLUE} 0%, #4A90D4 100%)`, color: NAVY_950, borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                Run First Analysis →
              </a>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: SILVER_400, fontFamily: MONO, marginBottom: 4 }}>
              {filtered.length} analysis{filtered.length !== 1 ? "es" : ""}
            </div>
            {filtered.map((a) => {
              let result: Record<string, unknown> = {};
              try { result = JSON.parse(a.result ?? "{}"); } catch { /* ignore */ }
              const isExpanded = expandedId === a.id;
              const useCases = (result.use_cases as Array<{ title: string; maturity: string }> | undefined) ?? [];
              const techStack = (result.tech_stack as Array<{ vendor: string }> | undefined) ?? [];

              return (
                <div key={a.id} style={{ background: NAVY_800, border: `1px solid rgba(123,163,212,0.15)`, borderRadius: 10, overflow: "hidden" }}>
                  <div
                    style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: SILVER_50 }}>{a.institution}</span>
                        {a.domain && <TagBadge label={a.domain} color={BLUE} />}
                        {a.aum && <TagBadge label={a.aum} color={GOLD} />}
                        {a.isInternal && <TagBadge label="INTERNAL" color="#F59E0B" />}
                      </div>
                      {(result.executive_summary as string) && (
                        <p style={{ fontSize: 13, color: SILVER_300, margin: "0 0 8px", lineHeight: 1.6, maxWidth: 700 }}>
                          {(result.executive_summary as string).slice(0, 160)}…
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO }}>
                          {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {useCases.length > 0 && <span style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO }}>{useCases.length} use case{useCases.length !== 1 ? "s" : ""}</span>}
                        {techStack.length > 0 && <span style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO }}>{techStack.length} vendor{techStack.length !== 1 ? "s" : ""}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      <a
                        href="/intelligence"
                        onClick={e => {
                          e.stopPropagation();
                          toast.info("Open a new analysis and paste the same text to re-run");
                        }}
                        style={{ padding: "6px 12px", background: `rgba(123,163,212,0.1)`, border: `1px solid rgba(123,163,212,0.25)`, borderRadius: 6, color: BLUE, fontSize: 11, fontWeight: 600, textDecoration: "none", fontFamily: MONO }}
                      >
                        Re-run
                      </a>
                      <span style={{ fontSize: 14, color: SILVER_400 }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: `1px solid rgba(123,163,212,0.1)`, padding: "16px 20px" }}>
                      {/* Use Cases */}
                      {useCases.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, color: BLUE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Use Cases</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {useCases.map((uc, i) => (
                              <span key={i} style={{ fontSize: 12, color: SILVER_100, background: NAVY_700, border: `1px solid rgba(123,163,212,0.15)`, borderRadius: 6, padding: "4px 10px" }}>
                                {uc.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Tech Stack */}
                      {techStack.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, color: BLUE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Tech Stack</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {techStack.map((t, i) => (
                              <span key={i} style={{ fontSize: 12, color: CYAN, background: `rgba(56,189,248,0.08)`, border: `1px solid rgba(56,189,248,0.2)`, borderRadius: 6, padding: "4px 10px" }}>
                                {t.vendor}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Build/Buy */}
                      {(result.build_buy_stance as Record<string, string> | undefined) && (
                        <div>
                          <div style={{ fontSize: 11, color: BLUE, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Build/Buy Stance</div>
                          <div style={{ fontSize: 13, color: SILVER_300 }}>
                            <strong style={{ color: SILVER_50 }}>{(result.build_buy_stance as Record<string, string>).stance}</strong>
                            {" — "}{(result.build_buy_stance as Record<string, string>).rationale}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
