/**
 * Telco.tsx — Kuwait MVNO Intelligence Dashboard
 * Dark enterprise design consistent with AgenThinkMesh design system.
 * 6 mock subscriber cards → 5-agent loading animation → full IC report → history table.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = "#0a0e1a";
const BG2 = "#111827";
const BG3 = "#1a2235";
const BORDER = "#1e2d45";
const TEXT = "#e8f0fe";
const TEXT2 = "#8899bb";
const MUTED = "#4a5a7a";
const ACCENT = "#00c4a0";   // teal
const GOLD = "#d4a843";     // gold
const RED = "#ff5a5a";
const AMBER = "#f59e0b";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'Inter', system-ui, sans-serif";

// ── Agent definitions ─────────────────────────────────────────────────────────
const AGENTS = [
  { key: "onboarding", label: "KYC & Onboarding", icon: "🪪", color: ACCENT },
  { key: "billing",    label: "Billing & Support", icon: "💳", color: GOLD },
  { key: "plan",       label: "Plan Optimisation", icon: "📶", color: "#7c6af7" },
  { key: "remittance", label: "Remittance Intel",  icon: "💸", color: "#00b4d8" },
  { key: "fraud",      label: "Fraud Detection",   icon: "🛡️", color: RED },
];

// ── Recommendation badge colours ──────────────────────────────────────────────
const RECO_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  SUSPEND_SUBSCRIBER: { bg: "#ff5a5a22", color: RED,   label: "⛔ SUSPEND SUBSCRIBER" },
  KYC_FAILED:         { bg: "#ff5a5a22", color: RED,   label: "🚫 KYC FAILED" },
  URGENT_RETENTION:   { bg: "#f59e0b22", color: AMBER, label: "⚠️ URGENT RETENTION" },
  HEALTHY_SUBSCRIBER: { bg: "#00c4a022", color: ACCENT,label: "✅ HEALTHY SUBSCRIBER" },
  REVIEW_REQUIRED:    { bg: "#7c6af722", color: "#7c6af7", label: "🔍 REVIEW REQUIRED" },
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface SubscriberCtx {
  name: string; nationality: string; msisdn: string;
  plan: string; simStatus: string; kycStatus: string;
  monthlyArpu: number; notes?: string;
}

interface AgentResults {
  onboarding: { status: string; flags: string[]; action: string };
  billing: { healthScore: number; issues: string[]; recommendation: string };
  plan: { currentPlanFit: string; churnRisk: string; action: string };
  remittance: { primaryCorridor: string; monthlyVolume: string; bundleMatch: string; saving: string };
  fraud: { riskLevel: string; flags: string[]; action: string };
}

interface RunResult {
  runId: string;
  subscriber: SubscriberCtx;
  agentResults: AgentResults;
  overallRecommendation: string;
}

// ── Nationality flags ─────────────────────────────────────────────────────────
const FLAG: Record<string, string> = {
  Filipino: "🇵🇭", Indian: "🇮🇳", Bangladeshi: "🇧🇩",
  Egyptian: "🇪🇬", Pakistani: "🇵🇰", Nepali: "🇳🇵",
};

// ── Sub-components ────────────────────────────────────────────────────────────

// PDF Export Button — calls trpc.mvno.exportPdf and triggers browser download
function PdfExportButton({ runId, subscriberName }: { runId: string; subscriberName: string }) {
  const exportMutation = trpc.mvno.exportPdf.useMutation({
    onSuccess: (data) => {
      const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
  return (
    <button
      onClick={() => exportMutation.mutate({ runId })}
      disabled={exportMutation.isPending}
      style={{
        padding: "10px 24px",
        background: exportMutation.isPending ? `${GOLD}44` : `${GOLD}22`,
        border: `1px solid ${GOLD}44`, color: GOLD,
        borderRadius: 4, fontFamily: MONO, fontSize: 11,
        cursor: exportMutation.isPending ? "not-allowed" : "pointer",
        letterSpacing: "0.08em", opacity: exportMutation.isPending ? 0.7 : 1,
      }}
    >
      {exportMutation.isPending ? "⟳ GENERATING PDF…" : "↓ EXPORT PDF REPORT"}
    </button>
  );
}

function AgentCard({ agentKey, label, icon, color, result }: {
  agentKey: string; label: string; icon: string; color: string;
  result: AgentResults | null;
}) {
  const r = result;
  return (
    <div style={{
      background: BG3, border: `1px solid ${color}33`,
      borderRadius: 8, padding: "20px 22px",
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color, letterSpacing: "0.1em", fontWeight: 600 }}>
          {label.toUpperCase()}
        </span>
      </div>

      {!r ? (
        <div style={{ color: MUTED, fontFamily: MONO, fontSize: 11 }}>Awaiting analysis…</div>
      ) : agentKey === "onboarding" ? (
        <>
          <StatusPill value={r.onboarding.status} map={{ approved: ACCENT, pending: AMBER, rejected: RED }} />
          <FlagList flags={r.onboarding.flags} />
          <ActionText text={r.onboarding.action} />
        </>
      ) : agentKey === "billing" ? (
        <>
          <HealthBar score={r.billing.healthScore} />
          <FlagList flags={r.billing.issues} />
          <ActionText text={r.billing.recommendation} />
        </>
      ) : agentKey === "plan" ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <StatusPill value={r.plan.currentPlanFit} map={{ good: ACCENT, upgrade: GOLD, downgrade: AMBER }} />
            <StatusPill value={`churn: ${r.plan.churnRisk}`} map={{ "churn: low": ACCENT, "churn: medium": AMBER, "churn: high": RED }} />
          </div>
          <ActionText text={r.plan.action} />
        </>
      ) : agentKey === "remittance" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <MetricItem label="Corridor" value={r.remittance.primaryCorridor} />
            <MetricItem label="Monthly Vol" value={r.remittance.monthlyVolume} />
            <MetricItem label="Saving" value={r.remittance.saving} />
          </div>
          <ActionText text={r.remittance.bundleMatch} />
        </>
      ) : agentKey === "fraud" ? (
        <>
          <StatusPill value={r.fraud.riskLevel} map={{ clean: ACCENT, monitor: AMBER, suspend: RED }} />
          <FlagList flags={r.fraud.flags} />
          <ActionText text={r.fraud.action} />
        </>
      ) : null}
    </div>
  );
}

function StatusPill({ value, map }: { value: string; map: Record<string, string> }) {
  const color = map[value] ?? TEXT2;
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px",
      borderRadius: 4, border: `1px solid ${color}44`,
      background: `${color}11`, color,
      fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em",
      fontWeight: 600, marginBottom: 8,
    }}>
      {value.toUpperCase()}
    </span>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? ACCENT : score >= 40 ? AMBER : RED;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT2 }}>BILLING HEALTH</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color }}>{score}/100</span>
      </div>
      <div style={{ height: 4, background: BORDER, borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 2, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

function FlagList({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;
  return (
    <ul style={{ margin: "0 0 10px", padding: "0 0 0 14px" }}>
      {flags.map((f, i) => (
        <li key={i} style={{ fontFamily: SANS, fontSize: 12, color: TEXT2, lineHeight: 1.6 }}>{f}</li>
      ))}
    </ul>
  );
}

function ActionText({ text }: { text: string }) {
  return (
    <p style={{ margin: 0, fontFamily: SANS, fontSize: 12, color: TEXT, lineHeight: 1.6, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
      {text}
    </p>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>{value}</div>
    </div>
  );
}

// ── Loading grid ──────────────────────────────────────────────────────────────

function AgentLoadingGrid({ activeIndex }: { activeIndex: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
      {AGENTS.map((a, i) => (
        <div key={a.key} style={{
          background: BG3, border: `1px solid ${i <= activeIndex ? a.color + "55" : BORDER}`,
          borderRadius: 8, padding: "16px 18px",
          borderTop: `3px solid ${i <= activeIndex ? a.color : BORDER}`,
          transition: "all 0.4s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>{a.icon}</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: i <= activeIndex ? a.color : MUTED, letterSpacing: "0.1em" }}>
              {a.label.toUpperCase()}
            </span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: i < activeIndex ? ACCENT : i === activeIndex ? AMBER : MUTED }}>
            {i < activeIndex ? "✓ COMPLETE" : i === activeIndex ? "⟳ ANALYSING…" : "QUEUED"}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Subscriber card ───────────────────────────────────────────────────────────

function SubscriberCard({ sub, onSelect, loading }: {
  sub: SubscriberCtx; onSelect: () => void; loading: boolean;
}) {
  const flag = FLAG[sub.nationality] ?? "🌍";
  return (
    <div
      onClick={onSelect}
      style={{
        background: BG2, border: `1px solid ${BORDER}`,
        borderRadius: 8, padding: "18px 20px", cursor: "pointer",
        transition: "border-color 0.2s, transform 0.15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = ACCENT; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = BORDER; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 2 }}>
            {flag} {sub.name}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>{sub.msisdn}</div>
        </div>
        <span style={{
          padding: "2px 8px", borderRadius: 3,
          background: sub.kycStatus === "verified" ? `${ACCENT}22` : `${AMBER}22`,
          color: sub.kycStatus === "verified" ? ACCENT : AMBER,
          fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em",
        }}>
          {sub.kycStatus.toUpperCase()}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <Tag label={sub.plan.replace("_", " ").toUpperCase()} color={GOLD} />
        <Tag label={`KWD ${sub.monthlyArpu}/mo`} color={TEXT2} />
        <Tag label={sub.nationality} color={TEXT2} />
      </div>
      {sub.notes && (
        <p style={{ margin: 0, fontFamily: SANS, fontSize: 11, color: TEXT2, lineHeight: 1.5 }}>
          {sub.notes.slice(0, 100)}{sub.notes.length > 100 ? "…" : ""}
        </p>
      )}
      <div style={{ marginTop: 12, textAlign: "center" }}>
        <button
          disabled={loading}
          style={{
            width: "100%", padding: "8px 0",
            background: loading ? BG3 : `${ACCENT}22`,
            border: `1px solid ${ACCENT}44`, color: ACCENT,
            borderRadius: 4, fontFamily: MONO, fontSize: 10,
            letterSpacing: "0.08em", cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "ANALYSING…" : "▶ RUN INTELLIGENCE"}
        </button>
      </div>
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: "2px 7px", borderRadius: 3,
      background: `${color}18`, color,
      fontFamily: MONO, fontSize: 9, letterSpacing: "0.06em",
    }}>
      {label}
    </span>
  );
}

// ── History table ─────────────────────────────────────────────────────────────

function HistoryTable({ onSelect }: { onSelect: (runId: string) => void }) {
  const { data: history } = trpc.mvno.subscriberHistory.useQuery();
  if (!history || history.length === 0) return null;

  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.12em", marginBottom: 16 }}>
        ANALYSIS HISTORY — {history.length} RUNS
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {["Subscriber", "Plan", "Recommendation", "Date", ""].map(h => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.08em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(row => {
              const reco = RECO_STYLES[row.overallRecommendation] ?? { bg: BG3, color: TEXT2, label: row.overallRecommendation };
              return (
                <tr key={row.id} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                  <td style={{ padding: "10px 12px", color: TEXT }}>
                    {FLAG[row.subscriberContext.nationality] ?? "🌍"} {row.subscriberContext.name}
                  </td>
                  <td style={{ padding: "10px 12px", color: TEXT2, fontFamily: MONO, fontSize: 11 }}>
                    {row.subscriberContext.plan.replace("_", " ")}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 3,
                      background: reco.bg, color: reco.color,
                      fontFamily: MONO, fontSize: 9, letterSpacing: "0.06em",
                    }}>
                      {reco.label}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: MUTED, fontFamily: MONO, fontSize: 10 }}>
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      onClick={() => onSelect(row.id)}
                      style={{
                        padding: "4px 10px", background: "transparent",
                        border: `1px solid ${BORDER}`, color: TEXT2,
                        borderRadius: 3, fontFamily: MONO, fontSize: 9,
                        cursor: "pointer", letterSpacing: "0.06em",
                      }}
                    >
                      VIEW REPORT
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Telco() {
  const { user } = useAuth();
  const [view, setView] = useState<"home" | "loading" | "report">("home");
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: mockSubs } = trpc.mvno.mockSubscribers.useQuery();
  const { data: historyRun } = trpc.mvno.getById.useQuery(
    { runId: selectedRunId! },
    { enabled: !!selectedRunId }
  );

  const analyseMutation = trpc.mvno.analyseSubscriber.useMutation({
    onSuccess: (data) => {
      setResult(data as RunResult);
      setView("report");
    },
    onError: () => {
      setView("home");
    },
  });

  const handleAnalyse = (sub: SubscriberCtx) => {
    setView("loading");
    setLoadingIndex(0);
    // Animate agent cards sequentially
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setLoadingIndex(idx);
      if (idx >= AGENTS.length - 1) clearInterval(interval);
    }, 2200);

    analyseMutation.mutate(sub as { name: string; nationality: string; msisdn: string; plan: "basic" | "worker" | "remittance_plus"; simStatus: "active" | "suspended" | "ported_out"; kycStatus: "pending" | "verified" | "rejected"; monthlyArpu: number; notes?: string });
  };

  const displayResult: RunResult | null = selectedRunId && historyRun
    ? (historyRun as unknown as RunResult)
    : result;

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED, marginBottom: 16 }}>AUTHENTICATION REQUIRED</div>
          <p style={{ color: TEXT2, fontFamily: SANS }}>Please log in to access the MVNO Intelligence module.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: SANS }}>
      {/* ── Top nav ── */}
      <nav style={{
        borderBottom: `1px solid ${BORDER}`, padding: "14px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: BG2, position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.1em" }}>← AGENTHINK</span>
          </Link>
          <span style={{ color: BORDER }}>|</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: GOLD, letterSpacing: "0.12em", fontWeight: 600 }}>
            📡 MVNO INTELLIGENCE
          </span>
          <span style={{
            padding: "2px 8px", borderRadius: 3,
            background: `${GOLD}22`, color: GOLD,
            fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em",
          }}>
            KUWAIT · BETA
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {view !== "home" && (
            <button
              onClick={() => { setView("home"); setSelectedRunId(null); }}
              style={{
                padding: "8px 16px", background: "transparent",
                border: `1px solid ${BORDER}`, color: TEXT2,
                borderRadius: 4, fontFamily: MONO, fontSize: 10,
                cursor: "pointer", letterSpacing: "0.06em",
              }}
            >
              ← NEW ANALYSIS
            </button>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>

        {/* ── HOME VIEW ── */}
        {view === "home" && (
          <>
            {/* Hero */}
            <div style={{ marginBottom: 48, textAlign: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: GOLD, letterSpacing: "0.16em", marginBottom: 12 }}>
                KUWAIT MVNO · 5-AGENT INTELLIGENCE PLATFORM
              </div>
              <h1 style={{
                fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800,
                margin: "0 0 16px", lineHeight: 1.15,
                background: `linear-gradient(135deg, ${GOLD}, ${ACCENT})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Subscriber Intelligence<br />in 60 Seconds
              </h1>
              <p style={{ color: TEXT2, fontSize: 15, maxWidth: 560, margin: "0 auto 32px", lineHeight: 1.7 }}>
                Five specialist AI agents analyse KYC, billing, plan fit, remittance corridors, and fraud signals in parallel.
                Select a subscriber profile below to run a full intelligence report.
              </p>
              <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
                {[
                  { label: "5 AGENTS", sub: "parallel execution" },
                  { label: "15s TIMEOUT", sub: "per agent with fallback" },
                  { label: "6 PROFILES", sub: "Kuwait MVNO scenarios" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: ACCENT }}>{s.label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.08em" }}>{s.sub.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subscriber grid */}
            <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.12em", marginBottom: 20 }}>
              SELECT SUBSCRIBER PROFILE — {mockSubs?.length ?? 6} DEMO PROFILES
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {(mockSubs ?? []).map((sub, i) => (
                <SubscriberCard
                  key={i}
                  sub={sub}
                  loading={analyseMutation.isPending}
                  onSelect={() => handleAnalyse(sub)}
                />
              ))}
            </div>

            {/* History */}
            <HistoryTable onSelect={(id) => { setSelectedRunId(id); setView("report"); }} />
          </>
        )}

        {/* ── LOADING VIEW ── */}
        {view === "loading" && (
          <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: GOLD, letterSpacing: "0.16em", marginBottom: 16 }}>
              RUNNING 5-AGENT INTELLIGENCE ANALYSIS
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: TEXT, margin: "0 0 8px" }}>
              Agents firing in parallel…
            </h2>
            <p style={{ color: TEXT2, fontSize: 13, marginBottom: 32 }}>
              Each agent has a 15-second timeout with graceful fallback.
            </p>
            <AgentLoadingGrid activeIndex={loadingIndex} />
            <div style={{ marginTop: 32, height: 2, background: BORDER, borderRadius: 1 }}>
              <div style={{
                height: "100%", background: `linear-gradient(90deg, ${GOLD}, ${ACCENT})`,
                borderRadius: 1, transition: "width 2s ease",
                width: `${Math.min(100, ((loadingIndex + 1) / AGENTS.length) * 100)}%`,
              }} />
            </div>
          </div>
        )}

        {/* ── REPORT VIEW ── */}
        {view === "report" && displayResult && (
          <div>
            {/* Report header */}
            <div style={{
              background: BG2, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: "24px 28px", marginBottom: 28,
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              flexWrap: "wrap", gap: 16,
            }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 6 }}>
                  MVNO INTELLIGENCE REPORT · {new Date().toLocaleDateString("en-KW", { timeZone: "Asia/Kuwait" })}
                </div>
                <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: TEXT }}>
                  {FLAG[displayResult.subscriber.nationality] ?? "🌍"} {displayResult.subscriber.name}
                </h2>
                <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2 }}>
                  {displayResult.subscriber.msisdn} · {displayResult.subscriber.nationality} · {displayResult.subscriber.plan.replace("_", " ").toUpperCase()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {(() => {
                  const reco = RECO_STYLES[displayResult.overallRecommendation] ?? { bg: BG3, color: TEXT2, label: displayResult.overallRecommendation };
                  return (
                    <div style={{
                      padding: "10px 20px", borderRadius: 6,
                      background: reco.bg, color: reco.color,
                      fontFamily: MONO, fontSize: 13, fontWeight: 700,
                      letterSpacing: "0.08em", border: `1px solid ${reco.color}44`,
                    }}>
                      {reco.label}
                    </div>
                  );
                })()}
                <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginTop: 6 }}>
                  RUN ID: {displayResult.runId?.slice(0, 8).toUpperCase()}
                </div>
              </div>
            </div>

            {/* 5 agent cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {AGENTS.map(a => (
                <AgentCard
                  key={a.key}
                  agentKey={a.key}
                  label={a.label}
                  icon={a.icon}
                  color={a.color}
                  result={displayResult.agentResults}
                />
              ))}
            </div>

            {/* PDF export + CTA */}
            <div style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <PdfExportButton runId={displayResult.runId} subscriberName={displayResult.subscriber.name} />
              </div>
              {/* Deploy CTA */}
              <div style={{
                background: `linear-gradient(135deg, ${BG2} 0%, rgba(212,168,67,0.06) 100%)`,
                border: `1px solid ${GOLD}33`,
                borderRadius: 10, padding: "32px 36px",
                textAlign: "center", maxWidth: 560, width: "100%",
              }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.14em", marginBottom: 10 }}>
                  POWERED BY AGENTHINK MESH
                </div>
                <h3 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700, color: TEXT }}>
                  Deploy this intelligence layer
                </h3>
                <p style={{ color: TEXT2, fontSize: 13, lineHeight: 1.7, margin: "0 0 20px" }}>
                  Institutional-grade MVNO subscriber intelligence for GCC telecom operators.
                  5 parallel AI agents. Real-time KYC, billing, fraud, and remittance signals.
                </p>
                <a
                  href="mailto:farouq@agenthinkmesh.com?subject=Deploy%20MVNO%20Intelligence%20for%20our%20institution"
                  style={{
                    display: "inline-block", padding: "11px 28px",
                    background: `linear-gradient(135deg, ${GOLD}, #a8742a)`,
                    color: "#000", borderRadius: 6,
                    fontFamily: MONO, fontSize: 11, fontWeight: 700,
                    textDecoration: "none", letterSpacing: "0.06em",
                  }}
                >
                  Deploy for your institution →
                </a>
                <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginTop: 12 }}>
                  farouq@agenthinkmesh.com · kishore@agenthinkmesh.com
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
