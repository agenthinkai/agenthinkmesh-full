/**
 * DealComparison.tsx — Deal Comparison Mode V2.1
 * Bloomberg Terminal-style dark UI matching DealScreener design tokens.
 * Three views: INPUT → LOADING → REPORT
 * Uses browser window.print() for PDF export (consistent with single-deal report).
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ── Design tokens (mirrors DealScreener.tsx) ──────────────────────────────────
const BG = "#070b12";
const BG2 = "#0d1421";
const BG3 = "#111827";
const BORDER = "#1e2d3d";
const ACCENT = "#4a9eff";
const GREEN = "#00ff87";
const AMBER = "#ff9f43";
const RED = "#ff4757";
const PURPLE = "#a855f7";
const MUTED = "#4a5568";
const TEXT = "#e2e8f0";
const TEXT2 = "#94a3b8";
const MONO = "'IBM Plex Mono', 'Fira Code', 'JetBrains Mono', monospace";

// ── Types ─────────────────────────────────────────────────────────────────────
type VerdictType = "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED";
type PriorityType = "HIGH" | "MEDIUM" | "LOW";

interface DealDimensions {
  marketAttractiveness: number;
  regulatoryReadiness: number;
  financialQuality: number;
  executionFeasibility: number;
  strategicFit: number;
  riskLevel: number;
}

interface RankedDeal {
  dealName: string;
  overallRank: number;
  overallScore: number;
  recommendedPriority: PriorityType;
  whyItRanksHere: string;
  dimensions: DealDimensions;
  finalDecision: VerdictType;
  consensusPercentage: number;
  confidenceLevel: string;
}

interface ComparisonSummary {
  rankedDeals: RankedDeal[];
  bestOverall: string;
  lowestRisk: string;
  highestUpside: string;
  mostIcReady: string;
  keyTradeoffs: string[];
}

interface DealAnalysisResult {
  dealName: string;
  status: "success" | "analysis_failed";
  failureReason: "timeout" | "error" | "invalid_input" | null;
  data: {
    finalDecision: VerdictType;
    consensusPercentage: number;
    confidenceLevel: string;
    keyAgreements: string[];
    keyDisagreements: string[];
    riskFlags: string[];
    thirtyDayChecklist: string[];
    marketContext: string[];
  } | null;
}

interface ComparisonResult {
  comparisonId: string;
  dealAnalyses: DealAnalysisResult[];
  comparisonSummary: ComparisonSummary;
  totalAmountUsd: number;
  timestamp: string;
}

interface DealEntry {
  id: string;
  name: string;
  summary: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function verdictColor(v: VerdictType): string {
  if (v === "APPROVED") return GREEN;
  if (v === "APPROVED_WITH_CONDITIONS") return AMBER;
  if (v === "VETOED") return PURPLE;
  return RED;
}

function priorityColor(p: PriorityType): string {
  if (p === "HIGH") return GREEN;
  if (p === "MEDIUM") return AMBER;
  return RED;
}

function rankMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function ScoreBar({ value, max = 10, color }: { value: number; max?: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 6, background: BG3, borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: color,
          borderRadius: 3, transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, minWidth: 24 }}>{value}</span>
    </div>
  );
}

// ── Deal Input Form ───────────────────────────────────────────────────────────
function DealInputCard({
  deal,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  deal: DealEntry;
  index: number;
  onUpdate: (id: string, field: "name" | "summary", value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  return (
    <div style={{
      background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8,
      padding: "20px 24px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, letterSpacing: "0.1em" }}>
          DEAL {index + 1}
        </span>
        {canRemove && (
          <button
            onClick={() => onRemove(deal.id)}
            style={{
              background: "none", border: "none", color: MUTED, cursor: "pointer",
              fontFamily: MONO, fontSize: 11, padding: "2px 8px",
              borderRadius: 4, transition: "color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = RED)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
          >
            × REMOVE
          </button>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontFamily: MONO, fontSize: 10, color: TEXT2, marginBottom: 6, letterSpacing: "0.08em" }}>
          DEAL NAME *
        </label>
        <input
          type="text"
          value={deal.name}
          onChange={e => onUpdate(deal.id, "name", e.target.value)}
          placeholder="e.g. Tamara Series B"
          maxLength={255}
          style={{
            width: "100%", background: BG3, border: `1px solid ${BORDER}`,
            borderRadius: 6, padding: "10px 14px", color: TEXT,
            fontFamily: MONO, fontSize: 13, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      <div>
        <label style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, color: TEXT2, marginBottom: 6, letterSpacing: "0.08em" }}>
          <span>DEAL MEMO / DESCRIPTION *</span>
          <span style={{ color: deal.summary.length > 2800 ? AMBER : MUTED }}>{deal.summary.length}/3000</span>
        </label>
        <textarea
          value={deal.summary}
          onChange={e => onUpdate(deal.id, "summary", e.target.value)}
          placeholder="Paste the deal memo, investment thesis, or key deal details..."
          maxLength={3000}
          rows={5}
          style={{
            width: "100%", background: BG3, border: `1px solid ${BORDER}`,
            borderRadius: 6, padding: "10px 14px", color: TEXT,
            fontFamily: MONO, fontSize: 12, outline: "none", resize: "vertical",
            boxSizing: "border-box", lineHeight: 1.6,
          }}
        />
      </div>
    </div>
  );
}

// ── Ranked Deal Card ──────────────────────────────────────────────────────────
function RankedDealCard({ deal, analysis }: { deal: RankedDeal; analysis?: DealAnalysisResult }) {
  const [expanded, setExpanded] = useState(deal.overallRank === 1);

  const dimLabels: Array<[keyof DealDimensions, string]> = [
    ["marketAttractiveness", "Market Attractiveness"],
    ["regulatoryReadiness", "Regulatory Readiness"],
    ["financialQuality", "Financial Quality"],
    ["executionFeasibility", "Execution Feasibility"],
    ["strategicFit", "Strategic Fit"],
    ["riskLevel", "Risk Level (Safety)"],
  ];

  const dimColor = (val: number) => val >= 7 ? GREEN : val >= 5 ? AMBER : RED;

  return (
    <div style={{
      background: deal.overallRank === 1 ? `${BG2}` : BG2,
      border: `1px solid ${deal.overallRank === 1 ? ACCENT : BORDER}`,
      borderRadius: 10, marginBottom: 16, overflow: "hidden",
      boxShadow: deal.overallRank === 1 ? `0 0 20px ${ACCENT}22` : "none",
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "18px 24px", cursor: "pointer", display: "flex",
          alignItems: "center", gap: 16, userSelect: "none",
        }}
      >
        <span style={{ fontSize: 24, minWidth: 36 }}>{rankMedal(deal.overallRank)}</span>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 15, color: TEXT, fontWeight: 600 }}>
              {deal.dealName}
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 10, padding: "2px 8px",
              borderRadius: 3, background: `${priorityColor(deal.recommendedPriority)}22`,
              color: priorityColor(deal.recommendedPriority), letterSpacing: "0.08em",
            }}>
              {deal.recommendedPriority} PRIORITY
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 10, padding: "2px 8px",
              borderRadius: 3, background: `${verdictColor(deal.finalDecision)}22`,
              color: verdictColor(deal.finalDecision), letterSpacing: "0.06em",
            }}>
              {deal.finalDecision.replace(/_/g, " ")}
            </span>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT2 }}>
              Score: <span style={{ color: ACCENT }}>{deal.overallScore}/10</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT2 }}>
              Consensus: <span style={{ color: TEXT }}>{deal.consensusPercentage}%</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT2 }}>
              Confidence: <span style={{ color: TEXT }}>{deal.confidenceLevel}</span>
            </span>
          </div>
        </div>

        <span style={{ color: MUTED, fontFamily: MONO, fontSize: 12 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 24px 24px", borderTop: `1px solid ${BORDER}` }}>
          {/* Why it ranks here */}
          <div style={{ margin: "16px 0 20px" }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.1em", marginBottom: 8 }}>
              RANKING RATIONALE
            </div>
            <p style={{ fontFamily: MONO, fontSize: 12, color: TEXT2, lineHeight: 1.7, margin: 0 }}>
              {deal.whyItRanksHere}
            </p>
          </div>

          {/* Dimension scores */}
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.1em", marginBottom: 12 }}>
            DIMENSION SCORES
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 32px", marginBottom: 20 }}>
            {dimLabels.map(([key, label]) => (
              <div key={key}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, marginBottom: 4 }}>{label}</div>
                <ScoreBar value={deal.dimensions[key]} color={dimColor(deal.dimensions[key])} />
              </div>
            ))}
          </div>

          {/* Analysis detail */}
          {analysis?.data && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {analysis.data.keyAgreements.length > 0 && (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: GREEN, letterSpacing: "0.1em", marginBottom: 8 }}>
                    KEY AGREEMENTS
                  </div>
                  {analysis.data.keyAgreements.map((a, i) => (
                    <div key={i} style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, marginBottom: 4, paddingLeft: 12, borderLeft: `2px solid ${GREEN}44` }}>
                      {a}
                    </div>
                  ))}
                </div>
              )}
              {analysis.data.riskFlags.length > 0 && (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: RED, letterSpacing: "0.1em", marginBottom: 8 }}>
                    RISK FLAGS
                  </div>
                  {analysis.data.riskFlags.map((f, i) => (
                    <div key={i} style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, marginBottom: 4, paddingLeft: 12, borderLeft: `2px solid ${RED}44` }}>
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {analysis?.status === "analysis_failed" && (
            <div style={{
              background: `${RED}11`, border: `1px solid ${RED}44`,
              borderRadius: 6, padding: "12px 16px", marginTop: 12,
              fontFamily: MONO, fontSize: 11, color: RED,
            }}>
              ⚠ Council analysis failed ({analysis.failureReason ?? "unknown"}) — this deal was excluded from comparison scoring.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DealComparison() {
  const { user, loading: authLoading } = useAuth();
  const [deals, setDeals] = useState<DealEntry[]>([
    { id: crypto.randomUUID(), name: "", summary: "" },
    { id: crypto.randomUUID(), name: "", summary: "" },
  ]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [view, setView] = useState<"input" | "loading" | "report">("input");
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const compareMutation = trpc.dealScreener.compare.useMutation({
    onSuccess: (data) => {
      setResult(data as ComparisonResult);
      setView("report");
    },
    onError: (err) => {
      setError(err.message);
      setView("input");
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  const addDeal = () => {
    if (deals.length >= 5) return;
    setDeals(prev => [...prev, { id: crypto.randomUUID(), name: "", summary: "" }]);
  };

  const removeDeal = (id: string) => {
    if (deals.length <= 2) return;
    setDeals(prev => prev.filter(d => d.id !== id));
  };

  const updateDeal = (id: string, field: "name" | "summary", value: string) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const handleSubmit = () => {
    if (!user) {
      window.location.href = getLoginUrl("/deals/compare");
      return;
    }
    const valid = deals.filter(d => d.name.trim() && d.summary.trim().length >= 10);
    if (valid.length < 2) {
      setError("Please fill in at least 2 deals with a name and description (min 10 characters).");
      return;
    }
    setError(null);
    setView("loading");
    compareMutation.mutate({ deals: valid.map(d => ({ name: d.name.trim(), summary: d.summary.trim() })) });
  };

  const handlePrint = () => window.print();

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!result) return;
    const { comparisonSummary, dealAnalyses, timestamp } = result;
    const { rankedDeals, bestOverall, lowestRisk, highestUpside, mostIcReady, keyTradeoffs } = comparisonSummary;

    const lines: string[] = [];
    lines.push("=" .repeat(60));
    lines.push("DEAL COMPARISON REPORT V2.1 — COUNCIL OF 10");
    lines.push(`Generated: ${new Date(timestamp).toLocaleString()}`);
    lines.push(`Deals Analysed: ${rankedDeals.length}  |  Total Cost: $${result.totalAmountUsd.toFixed(2)} USD`);
    lines.push("=" .repeat(60));
    lines.push("");
    lines.push("IC SUMMARY");
    lines.push("-" .repeat(40));
    lines.push(`Best Overall:    ${bestOverall}`);
    lines.push(`Lowest Risk:     ${lowestRisk}`);
    lines.push(`Highest Upside:  ${highestUpside}`);
    lines.push(`Most IC-Ready:   ${mostIcReady}`);
    lines.push("");
    if (keyTradeoffs.length > 0) {
      lines.push("KEY TRADEOFFS");
      lines.push("-" .repeat(40));
      keyTradeoffs.forEach(t => lines.push(`• ${t}`));
      lines.push("");
    }
    lines.push("RANKED DEALS");
    lines.push("-" .repeat(40));
    rankedDeals.forEach(deal => {
      lines.push("");
      lines.push(`#${deal.overallRank}  ${deal.dealName}`);
      lines.push(`    Verdict:    ${deal.finalDecision.replace(/_/g, " ")}`);
      lines.push(`    Score:      ${deal.overallScore}/10`);
      lines.push(`    Consensus:  ${deal.consensusPercentage}%`);
      lines.push(`    Confidence: ${deal.confidenceLevel}`);
      lines.push(`    Priority:   ${deal.recommendedPriority}`);
      lines.push(`    Rationale:  ${deal.whyItRanksHere}`);
      lines.push("    Dimensions:");
      lines.push(`      Market Attractiveness:  ${deal.dimensions.marketAttractiveness}/10`);
      lines.push(`      Regulatory Readiness:   ${deal.dimensions.regulatoryReadiness}/10`);
      lines.push(`      Financial Quality:      ${deal.dimensions.financialQuality}/10`);
      lines.push(`      Execution Feasibility:  ${deal.dimensions.executionFeasibility}/10`);
      lines.push(`      Strategic Fit:          ${deal.dimensions.strategicFit}/10`);
      lines.push(`      Risk Level (Safety):    ${deal.dimensions.riskLevel}/10`);
      const analysis = dealAnalyses.find(a => a.dealName === deal.dealName);
      if (analysis?.data) {
        if (analysis.data.keyAgreements.length > 0) {
          lines.push("    Key Agreements:");
          analysis.data.keyAgreements.forEach(a => lines.push(`      + ${a}`));
        }
        if (analysis.data.riskFlags.length > 0) {
          lines.push("    Risk Flags:");
          analysis.data.riskFlags.forEach(f => lines.push(`      ! ${f}`));
        }
        if (analysis.data.thirtyDayChecklist?.length > 0) {
          lines.push("    30-Day Checklist:");
          analysis.data.thirtyDayChecklist.forEach((c: string) => lines.push(`      → ${c}`));
        }
      }
    });
    lines.push("");
    lines.push("=" .repeat(60));
    lines.push("Generated by AgenThinkMesh — Council of 10");
    lines.push("https://agenthink-7enctkan.manus.space/deals/compare");

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // Fallback for browsers that block clipboard
      const ta = document.createElement("textarea");
      ta.value = lines.join("\n");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleReset = () => {
    setResult(null);
    setView("input");
    setError(null);
    setDeals([
      { id: crypto.randomUUID(), name: "", summary: "" },
      { id: crypto.randomUUID(), name: "", summary: "" },
    ]);
  };

  const totalCost = (deals.filter(d => d.name.trim() && d.summary.trim().length >= 10).length * 32.5).toFixed(2);

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: MONO, color: TEXT2, fontSize: 13 }}>AUTHENTICATING...</span>
      </div>
    );
  }

  // ── Loading view ─────────────────────────────────────────────────────────────
  if (view === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, letterSpacing: "0.15em" }}>
          DEAL COMPARISON V2.1 · COUNCIL OF 10
        </div>
        <div style={{ fontFamily: MONO, fontSize: 22, color: TEXT, fontWeight: 700 }}>
          Convening {deals.length} Parallel Councils...
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          {deals.map((d, i) => (
            <div key={d.id} style={{
              background: BG2, border: `1px solid ${BORDER}`, borderRadius: 6,
              padding: "8px 16px", fontFamily: MONO, fontSize: 11, color: TEXT2,
            }}>
              <span style={{ color: ACCENT }}>DEAL {i + 1}</span> · {d.name || "Unnamed"}
            </div>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: TEXT2, marginTop: 8 }}>
          10 specialist AI advisors voting in parallel per deal · Comparison Agent synthesising results
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: "50%", background: ACCENT,
              animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
            }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
      </div>
    );
  }

  // ── Report view ──────────────────────────────────────────────────────────────
  if (view === "report" && result) {
    const { comparisonSummary, dealAnalyses } = result;
    const { rankedDeals, bestOverall, lowestRisk, highestUpside, mostIcReady, keyTradeoffs } = comparisonSummary;

    return (
      <div style={{ minHeight: "100vh", background: BG, padding: "40px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }} ref={reportRef}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, letterSpacing: "0.15em", marginBottom: 8 }}>
              DEAL COMPARISON REPORT V2.1 · COUNCIL OF 10
            </div>
            <h1 style={{ fontFamily: MONO, fontSize: 28, color: TEXT, margin: "0 0 8px", fontWeight: 700 }}>
              {rankedDeals.length}-Deal Investment Comparison
            </h1>
            <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2 }}>
              {new Date(result.timestamp).toLocaleString()} · {rankedDeals.length} deals analysed · ${result.totalAmountUsd.toFixed(2)} USD
            </div>
          </div>

          {/* IC Summary Badges */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32,
          }}>
            {[
              { label: "BEST OVERALL", value: bestOverall, color: ACCENT },
              { label: "LOWEST RISK", value: lowestRisk, color: GREEN },
              { label: "HIGHEST UPSIDE", value: highestUpside, color: AMBER },
              { label: "MOST IC-READY", value: mostIcReady, color: PURPLE },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: BG2, border: `1px solid ${color}44`,
                borderRadius: 8, padding: "14px 16px", textAlign: "center",
              }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: color, letterSpacing: "0.12em", marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT, fontWeight: 600 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Key Tradeoffs */}
          {keyTradeoffs.length > 0 && (
            <div style={{
              background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8,
              padding: "20px 24px", marginBottom: 32,
            }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: AMBER, letterSpacing: "0.12em", marginBottom: 14 }}>
                KEY TRADEOFFS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
                {keyTradeoffs.map((t, i) => (
                  <div key={i} style={{
                    fontFamily: MONO, fontSize: 12, color: TEXT2, paddingLeft: 14,
                    borderLeft: `2px solid ${AMBER}55`, lineHeight: 1.6,
                  }}>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ranked Deals */}
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 16 }}>
            RANKED DEALS — {rankedDeals.length} ANALYSED
          </div>
          {rankedDeals.map((deal) => {
            const analysis = dealAnalyses.find(a => a.dealName === deal.dealName);
            return <RankedDealCard key={deal.dealName} deal={deal} analysis={analysis} />;
          })}

          {/* Failed deals */}
          {dealAnalyses.filter(a => a.status === "analysis_failed").map(a => (
            <div key={a.dealName} style={{
              background: `${RED}08`, border: `1px solid ${RED}33`,
              borderRadius: 8, padding: "14px 20px", marginBottom: 12,
              fontFamily: MONO, fontSize: 12, color: RED,
            }}>
              ⚠ {a.dealName} — Analysis failed ({a.failureReason ?? "unknown"}). Excluded from comparison.
            </div>
          ))}

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 32, justifyContent: "center", flexWrap: "wrap" }} className="no-print">
            <button
              onClick={handleCopy}
              style={{
                background: copied ? `${GREEN}22` : "none",
                border: `1px solid ${copied ? GREEN : ACCENT}`,
                color: copied ? GREEN : ACCENT,
                fontFamily: MONO, fontSize: 12, padding: "10px 24px",
                borderRadius: 6, cursor: "pointer", letterSpacing: "0.08em",
                transition: "all 0.2s",
              }}
            >
              {copied ? "✓ COPIED!" : "⎘ COPY RESULTS"}
            </button>
            <button
              onClick={handlePrint}
              style={{
                background: "none", border: `1px solid ${BORDER}`, color: TEXT2,
                fontFamily: MONO, fontSize: 12, padding: "10px 24px",
                borderRadius: 6, cursor: "pointer", letterSpacing: "0.08em",
              }}
            >
              ⬇ DOWNLOAD PDF
            </button>
            <button
              onClick={handleReset}
              style={{
                background: BG2, border: `1px solid ${BORDER}`, color: TEXT2,
                fontFamily: MONO, fontSize: 12, padding: "10px 24px",
                borderRadius: 6, cursor: "pointer", letterSpacing: "0.08em",
              }}
            >
              ← NEW COMPARISON
            </button>
          </div>
        </div>

        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: #070b12 !important; }
          }
        `}</style>
      </div>
    );
  }

  // ── Input view ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: BG, padding: "40px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, letterSpacing: "0.15em", marginBottom: 10 }}>
            DEAL COMPARISON V2.1 · COUNCIL OF 10
          </div>
          <h1 style={{ fontFamily: MONO, fontSize: 28, color: TEXT, margin: "0 0 10px", fontWeight: 700 }}>
            Compare Investment Deals
          </h1>
          <p style={{ fontFamily: MONO, fontSize: 12, color: TEXT2, margin: 0, lineHeight: 1.7 }}>
            Submit 2–5 deals. 10 specialist AI advisors vote on each in parallel.<br />
            A Comparison Agent synthesises results into a ranked IC-ready report.
          </p>
        </div>

        {/* Pricing badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16, background: BG2,
          border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: "14px 20px", marginBottom: 28,
        }}>
          <span style={{ fontSize: 18 }}>💳</span>
          <div>
            <span style={{ fontFamily: MONO, fontSize: 16, color: ACCENT, fontWeight: 700 }}>
              $32.50 USD
            </span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: TEXT2, marginLeft: 8 }}>
              per deal · {deals.filter(d => d.name && d.summary.length >= 10).length} deal{deals.filter(d => d.name && d.summary.length >= 10).length !== 1 ? "s" : ""} = <strong style={{ color: TEXT }}>${totalCost}</strong>
            </span>
          </div>
          <div style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: MUTED }}>
            One-time · No subscription required
          </div>
        </div>

        {/* Deal input cards */}
        {deals.map((deal, i) => (
          <DealInputCard
            key={deal.id}
            deal={deal}
            index={i}
            onUpdate={updateDeal}
            onRemove={removeDeal}
            canRemove={deals.length > 2}
          />
        ))}

        {/* Add deal button */}
        {deals.length < 5 && (
          <button
            onClick={addDeal}
            style={{
              width: "100%", background: "none", border: `1px dashed ${BORDER}`,
              borderRadius: 8, padding: "14px", color: TEXT2, fontFamily: MONO,
              fontSize: 12, cursor: "pointer", marginBottom: 20,
              transition: "border-color 0.2s, color 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT2; }}
          >
            + ADD DEAL ({deals.length}/5)
          </button>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: `${RED}11`, border: `1px solid ${RED}44`,
            borderRadius: 6, padding: "12px 16px", marginBottom: 16,
            fontFamily: MONO, fontSize: 12, color: RED,
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={compareMutation.isPending}
          style={{
            width: "100%", background: ACCENT, border: "none", color: "#000",
            fontFamily: MONO, fontSize: 13, fontWeight: 700, padding: "16px",
            borderRadius: 8, cursor: "pointer", letterSpacing: "0.1em",
            opacity: compareMutation.isPending ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {!user
            ? "LOGIN TO COMPARE DEALS →"
            : compareMutation.isPending
            ? "RUNNING COUNCILS..."
            : `RUN COMPARISON · ${deals.filter(d => d.name && d.summary.length >= 10).length} DEALS · $${totalCost} →`}
        </button>
        <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 10 }}>
          Each deal is screened by 10 specialist AI advisors. Results are delivered in a single ranked report.
        </div>
      </div>
    </div>
  );
}
