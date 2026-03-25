/**
 * IntelligenceHome — Rebuilt with gold/teal design system
 * Fonts: Syne (headings) · DM Mono (labels/code) · Cormorant Garamond (quotes)
 * Tokens: --intel-* CSS variables defined in index.css
 */
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import SiteNav from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Fonts ─────────────────────────────────────────────────────────────────────
const SYNE = "'Syne', 'Inter', sans-serif";
const MONO = "'DM Mono', 'JetBrains Mono', monospace";
const SERIF = "'Cormorant Garamond', Georgia, serif";

// ── 6-step progress labels ────────────────────────────────────────────────────
const STEPS = [
  "Parsing institution, domain, and context",
  "Extracting AI use cases and quantified metrics",
  "Mapping technology stack — build vs buy classification",
  "Generating GCC-specific GTM signals",
  "Cross-referencing AgenThinkMesh coverage gaps",
  "Composing intelligence brief",
];

// ── Example data ──────────────────────────────────────────────────────────────
const EXAMPLES = [
  {
    flag: "🇳🇴",
    institution: "Norges Bank Investment Management",
    shortName: "NBIM",
    domain: "Sovereign Wealth Fund",
    aum: "$2.2T",
    tags: ["Compliance AI", "Trade Optimization", "ESG Screening"],
    text: `Norges Bank Investment Management (NBIM) shared a detailed look at their AI strategy and production deployments today. Managing $2.2 trillion across 700 employees, they have made AI a non-negotiable part of operations — CEO Nicolai Tangen has told staff "this ship is sailing, get on board or find a new place to work."

Their production AI agents include:
- Investing: AI agents that analyze block trades combining data from web, text, and databases to provide better analysis in under an hour
- Communication: AI-powered sentiment analysis platform that automates media monitoring for 50,000 articles annually  
- Cybersecurity: Agents investigating security threats in 5 minutes instead of 30 minutes manually
- Compliance: "EVA" — Enhanced Vigilant Agent who assesses trade alerts to catch insider trading and market manipulation
- ESG screening: AI screens 7,000 companies across 60 countries for labour, environmental and corruption risks
- Negotiations: Simulator that predicts 80%+ of opposing party arguments and provides strategic plans
- Trade optimization: Saved NOK 4-6 billion by reducing market impact through predictive models

Their primary AI model is Anthropic's Claude, integrated across all devices. Infrastructure is cloud-based with a strong bias toward internally built solutions. They have saved 213,000 hours through AI — equivalent to 100+ full-time employees. Trading cost savings are already at $100M/year with a $400M target. 20% efficiency target across the organisation.`,
  },
  {
    flag: "🇦🇪",
    institution: "Mubadala Investment Company",
    shortName: "Mubadala",
    domain: "Sovereign Wealth Fund",
    aum: "$302B",
    tags: ["Portfolio Intelligence", "Deal Screening", "Risk Analytics"],
    text: `Mubadala Investment Company, Abu Dhabi's $302 billion sovereign wealth fund, has been accelerating its AI integration across investment operations as part of its 2030 strategy. The fund, which spans technology, healthcare, real estate, aerospace, and energy, has deployed AI across several key areas.

Portfolio monitoring now uses machine learning models to flag ESG and governance risks across 200+ portfolio companies in real time. Deal screening agents pre-process inbound opportunities, reducing analyst triage time by an estimated 60%. Their technology vertical — which includes significant stakes in AI infrastructure companies — provides internal access to compute and model capabilities ahead of market.

Mubadala has partnered with G42 (their portfolio company) for AI infrastructure, giving them a build-and-buy hybrid approach. Microsoft Azure is their primary cloud. They are piloting LLM-based due diligence summarization tools for cross-sector deal teams. Governance AI tools flag related-party transaction risks and compliance issues under ADIA/Mubadala separation requirements.

CEO Khaldoon Al Mubarak has positioned AI as central to Mubadala's evolution from capital allocator to active value creator. The fund is reportedly exploring AI-native fund structures for their technology portfolio arm.`,
  },
  {
    flag: "🇦🇪",
    institution: "ADQ (Abu Dhabi Developmental Holding)",
    shortName: "ADQ",
    domain: "Sovereign Holding Company",
    aum: "$110B+",
    tags: ["Asset Monitoring", "AI Governance", "Sector Intelligence"],
    text: `ADQ, Abu Dhabi's $110 billion+ developmental holding company, is integrating AI across its 90+ portfolio companies spanning food security, healthcare, utilities, and financial services. At an investment forum in Abu Dhabi, ADQ's CTO outlined their AI governance framework and sector intelligence platform.

Key deployments include a cross-portfolio data platform that aggregates operational KPIs from all subsidiaries into a unified intelligence layer, enabling board-level AI-generated briefings. Sector agents monitor global supply chain disruptions relevant to ADQ's food and logistics assets. A compliance and sanctions screening agent runs across all new counterparties and investment targets.

ADQ has adopted Microsoft Azure OpenAI as primary infrastructure, with a clear buy-first strategy for foundational models and internal build for sector-specific agents. Their healthcare arm (Cleveland Clinic Abu Dhabi, Rafid) is piloting clinical AI tools. Energy and utilities assets (TAQA, Emirates Water and Electricity) are using predictive maintenance AI.

ADQ is targeting 30% operational efficiency improvement across portfolio companies by 2027 through AI. They are building a shared services AI layer accessible to all subsidiaries, positioned as a competitive advantage for attracting private sector partnerships into Abu Dhabi.`,
  },
];

// ── Inline styles helper ──────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "var(--intel-ink)",
    color: "var(--intel-text)",
    fontFamily: "'Inter', sans-serif",
  } as React.CSSProperties,
  wrap: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "40px 24px 80px",
  } as React.CSSProperties,
  // topbar
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 40,
    flexWrap: "wrap" as const,
    gap: 12,
  } as React.CSSProperties,
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } as React.CSSProperties,
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: "linear-gradient(135deg, var(--intel-gold) 0%, var(--intel-teal) 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 800,
    color: "var(--intel-ink)",
    fontFamily: SYNE,
  } as React.CSSProperties,
  brandName: {
    fontFamily: SYNE,
    fontWeight: 700,
    fontSize: 15,
    color: "var(--intel-text)",
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  liveBadge: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: 500,
    color: "var(--intel-teal)",
    background: "rgba(0,196,160,0.12)",
    border: "1px solid rgba(0,196,160,0.3)",
    borderRadius: 4,
    padding: "2px 7px",
    letterSpacing: "0.1em",
  } as React.CSSProperties,
  // hero
  eyebrow: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: 500,
    color: "var(--intel-gold)",
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    marginBottom: 14,
  } as React.CSSProperties,
  heroTitle: {
    fontFamily: SYNE,
    fontWeight: 800,
    fontSize: "clamp(28px,4vw,44px)",
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    color: "var(--intel-text)",
    margin: "0 0 16px",
  } as React.CSSProperties,
  heroSub: {
    fontSize: 15,
    color: "var(--intel-muted)",
    lineHeight: 1.75,
    maxWidth: 580,
    margin: "0 0 36px",
  } as React.CSSProperties,
  // example cards
  exGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
    marginBottom: 32,
  } as React.CSSProperties,
  exCard: {
    background: "var(--intel-ink2)",
    border: "1px solid var(--intel-border)",
    borderRadius: 10,
    padding: "14px 16px",
    cursor: "pointer",
    transition: "border-color 0.2s, background 0.2s",
    position: "relative" as const,
  } as React.CSSProperties,
  exCardHover: {
    borderColor: "var(--intel-gold)",
    background: "var(--intel-ink3)",
  } as React.CSSProperties,
  exFlag: {
    fontSize: 22,
    marginBottom: 8,
    display: "block",
  } as React.CSSProperties,
  exName: {
    fontFamily: SYNE,
    fontWeight: 700,
    fontSize: 13,
    color: "var(--intel-text)",
    marginBottom: 2,
    lineHeight: 1.3,
  } as React.CSSProperties,
  exType: {
    fontFamily: MONO,
    fontSize: 10,
    color: "var(--intel-muted)",
    marginBottom: 10,
  } as React.CSSProperties,
  exTagRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
  } as React.CSSProperties,
  exTag: {
    fontFamily: MONO,
    fontSize: 9,
    color: "var(--intel-teal)",
    background: "rgba(0,196,160,0.1)",
    border: "1px solid rgba(0,196,160,0.2)",
    borderRadius: 3,
    padding: "2px 6px",
  } as React.CSSProperties,
  exLoadBtn: {
    position: "absolute" as const,
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 4,
    background: "rgba(201,168,76,0.15)",
    border: "1px solid rgba(201,168,76,0.3)",
    color: "var(--intel-gold)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  // input panel
  inputPanel: {
    background: "var(--intel-ink2)",
    border: "1px solid var(--intel-border)",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  } as React.CSSProperties,
  inputHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid var(--intel-border)",
    flexWrap: "wrap" as const,
    gap: 8,
  } as React.CSSProperties,
  panelTitle: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: 500,
    color: "var(--intel-muted)",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--intel-text)",
    fontSize: 13,
    lineHeight: 1.7,
    fontFamily: "'Inter', sans-serif",
    resize: "vertical" as const,
    padding: "16px 18px",
    minHeight: 200,
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  inputFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 18px",
    borderTop: "1px solid var(--intel-border)",
  } as React.CSSProperties,
  charCount: {
    fontFamily: MONO,
    fontSize: 10,
    color: "var(--intel-muted)",
  } as React.CSSProperties,
  // config row
  configRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 16,
  } as React.CSSProperties,
  configPanel: {
    background: "var(--intel-ink2)",
    border: "1px solid var(--intel-border)",
    borderRadius: 10,
    padding: "14px 16px",
  } as React.CSSProperties,
  configLabel: {
    fontFamily: MONO,
    fontSize: 9,
    color: "var(--intel-muted)",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    marginBottom: 10,
  } as React.CSSProperties,
  toggleGroup: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
  } as React.CSSProperties,
  // run button
  runBtn: (loading: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "14px 24px",
    background: loading
      ? "var(--intel-ink3)"
      : "linear-gradient(135deg, var(--intel-gold) 0%, #e8a020 100%)",
    border: loading ? "1px solid var(--intel-border)" : "none",
    borderRadius: 10,
    color: loading ? "var(--intel-muted)" : "var(--intel-ink)",
    fontSize: 14,
    fontWeight: 800,
    fontFamily: SYNE,
    letterSpacing: "0.02em",
    cursor: loading ? "not-allowed" : "pointer",
    transition: "all 0.2s",
    boxShadow: loading ? "none" : "0 4px 24px rgba(201,168,76,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  }),
  // progress
  progressPanel: {
    background: "var(--intel-ink2)",
    border: "1px solid var(--intel-border)",
    borderRadius: 10,
    padding: "16px 18px",
    marginBottom: 16,
  } as React.CSSProperties,
  stepLine: (active: boolean, done: boolean): React.CSSProperties => ({
    fontFamily: MONO,
    fontSize: 11,
    color: done ? "var(--intel-teal)" : active ? "var(--intel-text)" : "var(--intel-dim)",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
    transition: "color 0.3s",
  }),
  progBarWrap: {
    height: 3,
    background: "var(--intel-border)",
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden",
  } as React.CSSProperties,
  progBar: (pct: number): React.CSSProperties => ({
    height: "100%",
    width: `${pct}%`,
    background: "linear-gradient(90deg, var(--intel-gold), var(--intel-teal))",
    borderRadius: 2,
    transition: "width 0.4s ease",
  }),
  // output topbar
  outputTopbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    flexWrap: "wrap" as const,
    gap: 10,
  } as React.CSSProperties,
  outputLabel: {
    fontFamily: SYNE,
    fontWeight: 700,
    fontSize: 18,
    color: "var(--intel-text)",
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  actionBtn: (variant: "outline" | "gold"): React.CSSProperties => ({
    padding: "7px 14px",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: MONO,
    cursor: "pointer",
    letterSpacing: "0.04em",
    transition: "all 0.2s",
    ...(variant === "gold"
      ? {
          background: "rgba(201,168,76,0.15)",
          border: "1px solid rgba(201,168,76,0.35)",
          color: "var(--intel-gold)",
        }
      : {
          background: "transparent",
          border: "1px solid var(--intel-border)",
          color: "var(--intel-muted)",
        }),
  }),
  // output card
  card: {
    background: "var(--intel-ink2)",
    border: "1px solid var(--intel-border)",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    animation: "intel-fade-in 0.4s ease forwards",
    opacity: 0,
  } as React.CSSProperties,
  cardHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 18px",
    borderBottom: "1px solid var(--intel-border)",
  } as React.CSSProperties,
  cardBody: {
    padding: "16px 18px",
  } as React.CSSProperties,
  // footer CTA
  footerCta: {
    background: "linear-gradient(135deg, var(--intel-ink2) 0%, rgba(201,168,76,0.06) 100%)",
    border: "1px solid rgba(201,168,76,0.2)",
    borderRadius: 16,
    padding: "40px 36px",
    textAlign: "center" as const,
    marginTop: 40,
  } as React.CSSProperties,
};

// ── Toggle button ─────────────────────────────────────────────────────────────
function TogBtn({ label, active, gold, onClick }: { label: string; active: boolean; gold?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 11px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: MONO,
        cursor: "pointer",
        transition: "all 0.15s",
        letterSpacing: "0.04em",
        background: active
          ? gold ? "rgba(201,168,76,0.18)" : "rgba(0,196,160,0.12)"
          : "transparent",
        border: active
          ? gold ? "1px solid rgba(201,168,76,0.4)" : "1px solid rgba(0,196,160,0.3)"
          : "1px solid var(--intel-border)",
        color: active
          ? gold ? "var(--intel-gold)" : "var(--intel-teal)"
          : "var(--intel-muted)",
      }}
    >
      {label}
    </button>
  );
}

// ── Output cards ──────────────────────────────────────────────────────────────

function CardIcon({ color, children }: { color: string; children: React.ReactNode }) {
  const bg: Record<string, string> = {
    gold: "rgba(201,168,76,0.15)",
    teal: "rgba(0,196,160,0.12)",
    blue: "rgba(74,158,255,0.12)",
    red: "rgba(255,90,90,0.12)",
  };
  const fg: Record<string, string> = {
    gold: "var(--intel-gold)",
    teal: "var(--intel-teal)",
    blue: "var(--intel-blue)",
    red: "var(--intel-red)",
  };
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 6,
      background: bg[color] ?? bg.teal,
      color: fg[color] ?? fg.teal,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: SYNE, fontWeight: 700, fontSize: 14, color: "var(--intel-text)", flex: 1 }}>
      {children}
    </div>
  );
}

function CardCount({ n }: { n: number }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--intel-muted)", marginLeft: "auto" }}>
      {n} identified
    </div>
  );
}

function MaturityBadge({ level }: { level: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    production: { bg: "rgba(74,222,128,0.12)", fg: "#4ade80" },
    pilot: { bg: "rgba(201,168,76,0.12)", fg: "var(--intel-gold)" },
    exploring: { bg: "rgba(74,158,255,0.12)", fg: "var(--intel-blue)" },
    unknown: { bg: "rgba(107,117,133,0.12)", fg: "var(--intel-muted)" },
  };
  const key = level?.toLowerCase() ?? "unknown";
  const { bg, fg } = map[key] ?? map.unknown;
  return (
    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 500, background: bg, color: fg, border: `1px solid ${fg}35`, borderRadius: 3, padding: "2px 6px", letterSpacing: "0.06em" }}>
      {level ?? "Unknown"}
    </span>
  );
}

function SummaryOutputCard({ r, animDelay }: { r: AnalysisResult; animDelay: number }) {
  return (
    <div style={{ ...S.card, animationDelay: `${animDelay}s` }}>
      <div style={S.cardHead}>
        <CardIcon color="gold">🏛</CardIcon>
        <CardTitle>
          {r.institution}
          {r.domain && <span style={{ fontWeight: 400, color: "var(--intel-muted)" }}> · {r.domain}</span>}
          {r.aum && <span style={{ fontWeight: 400, color: "var(--intel-muted)" }}> · {r.aum}</span>}
        </CardTitle>
      </div>
      <div style={S.cardBody}>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--intel-text)", margin: 0 }}>
          {r.executive_summary}
        </p>
        {r.gcc_lens && (
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--intel-muted)", background: "var(--intel-ink3)", border: "1px solid var(--intel-border)", borderRadius: 4, padding: "3px 8px" }}>
              {r.gcc_lens.regulatory_alignment}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--intel-teal)", background: "rgba(0,196,160,0.08)", border: "1px solid rgba(0,196,160,0.2)", borderRadius: 4, padding: "3px 8px" }}>
              Localisation {r.gcc_lens.localisation_score}/10
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--intel-muted)", background: "var(--intel-ink3)", border: "1px solid var(--intel-border)", borderRadius: 4, padding: "3px 8px" }}>
              {r.build_buy_stance?.stance ?? "—"} stance
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function UseCasesOutputCard({ useCases, animDelay }: { useCases: AnalysisResult["use_cases"]; animDelay: number }) {
  if (!useCases?.length) return null;
  return (
    <div style={{ ...S.card, animationDelay: `${animDelay}s` }}>
      <div style={S.cardHead}>
        <CardIcon color="teal">⚡</CardIcon>
        <CardTitle>AI Use Cases</CardTitle>
        <CardCount n={useCases.length} />
      </div>
      <div style={S.cardBody}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          {useCases.map((u, i) => (
            <div key={i} style={{ background: "var(--intel-ink3)", border: "1px solid var(--intel-border2)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 6 }}>
                <span style={{ fontFamily: SYNE, fontWeight: 700, fontSize: 13, color: "var(--intel-text)" }}>{u.title}</span>
                <MaturityBadge level={u.maturity} />
              </div>
              <p style={{ fontSize: 12, color: "var(--intel-muted)", lineHeight: 1.6, margin: 0 }}>{u.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TechStackOutputCard({ techStack, buildBuy, animDelay }: { techStack: AnalysisResult["tech_stack"]; buildBuy: AnalysisResult["build_buy_stance"]; animDelay: number }) {
  if (!techStack?.length) return null;
  return (
    <div style={{ ...S.card, animationDelay: `${animDelay}s` }}>
      <div style={S.cardHead}>
        <CardIcon color="blue">⬡</CardIcon>
        <CardTitle>Tech Stack &amp; Build/Buy</CardTitle>
        {buildBuy && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--intel-blue)", background: "rgba(74,158,255,0.1)", border: "1px solid rgba(74,158,255,0.25)", borderRadius: 4, padding: "2px 8px", marginLeft: "auto" }}>
            {buildBuy.stance} · {buildBuy.confidence}
          </span>
        )}
      </div>
      <div style={S.cardBody}>
        {buildBuy?.rationale && (
          <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: "var(--intel-muted)", lineHeight: 1.7, margin: "0 0 14px", borderLeft: "2px solid var(--intel-gold)", paddingLeft: 12 }}>
            "{buildBuy.rationale}"
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {techStack.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px", background: "var(--intel-ink3)", borderRadius: 7, border: "1px solid var(--intel-border2)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: SYNE, fontWeight: 700, fontSize: 13, color: "var(--intel-teal)" }}>{t.vendor}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--intel-muted)", background: "var(--intel-border)", borderRadius: 3, padding: "2px 6px" }}>{t.category}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--intel-muted)", margin: 0, fontStyle: "italic" }}>{t.evidence}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GTMOutputCard({ signals, animDelay }: { signals: AnalysisResult["gtm_signals"]; animDelay: number }) {
  if (!signals?.length) return null;
  return (
    <div style={{ ...S.card, animationDelay: `${animDelay}s` }}>
      <div style={S.cardHead}>
        <CardIcon color="gold">◎</CardIcon>
        <CardTitle>GTM Signals for AgenThinkMesh</CardTitle>
      </div>
      <div style={S.cardBody}>
        {signals.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--intel-gold)", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 4, padding: "3px 7px", flexShrink: 0, alignSelf: "flex-start", marginTop: 2 }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div>
              <div style={{ fontFamily: SYNE, fontWeight: 700, fontSize: 13, color: "var(--intel-text)", marginBottom: 4 }}>{s.signal}</div>
              <div style={{ fontSize: 12, color: "var(--intel-muted)", lineHeight: 1.6 }}>{s.implication}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverageGapsOutputCard({ gaps, nextMoves, animDelay }: { gaps: AnalysisResult["coverage_gaps"]; nextMoves: AnalysisResult["recommended_next_moves"]; animDelay: number }) {
  if (!gaps?.length) return null;
  return (
    <div style={{ ...S.card, animationDelay: `${animDelay}s` }}>
      <div style={S.cardHead}>
        <CardIcon color="red">△</CardIcon>
        <CardTitle>AgenThinkMesh Coverage Gaps</CardTitle>
        <CardCount n={gaps.length} />
      </div>
      <div style={S.cardBody}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: nextMoves?.length ? 16 : 0 }}>
          {gaps.map((g, i) => (
            <span key={i} style={{ fontFamily: MONO, fontSize: 11, color: "var(--intel-red)", background: "rgba(255,90,90,0.08)", border: "1px solid rgba(255,90,90,0.2)", borderRadius: 5, padding: "4px 10px" }}>{g}</span>
          ))}
        </div>
        {nextMoves && nextMoves.length > 0 && (
          <>
            <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--intel-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, marginTop: 4 }}>Recommended Next Moves</div>
            {nextMoves.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(74,158,255,0.12)", border: "1px solid rgba(74,158,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--intel-blue)", fontFamily: MONO, flexShrink: 0 }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--intel-text)", marginBottom: 2 }}>{m.action}</div>
                  <div style={{ fontSize: 12, color: "var(--intel-muted)" }}>{m.rationale}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalysisResult {
  institution?: string;
  domain?: string;
  aum?: string;
  executive_summary?: string;
  use_cases?: Array<{ title: string; description: string; maturity: string }>;
  tech_stack?: Array<{ vendor: string; category: string; evidence: string }>;
  build_buy_stance?: { stance: string; confidence: string; rationale: string };
  gtm_signals?: Array<{ signal: string; implication: string }>;
  coverage_gaps?: string[];
  recommended_next_moves?: Array<{ action: string; priority: string; rationale: string }>;
  gcc_lens?: { regulatory_alignment: string; sovereign_ai_stance: string; localisation_score: number };
}

// ── Module & lens config ──────────────────────────────────────────────────────
const MODULES = [
  { id: "use_cases", label: "Use Cases" },
  { id: "tech_stack", label: "Tech Stack" },
  { id: "build_buy", label: "Build/Buy" },
  { id: "gtm_signals", label: "GTM Signals" },
  { id: "coverage_gaps", label: "Coverage Gaps", gold: true },
  { id: "next_moves", label: "Next Moves" },
];

const LENSES = [
  { id: "swf", label: "Sovereign" },
  { id: "fm", label: "Fund Managers" },
  { id: "corp", label: "Corporate" },
  { id: "bank", label: "Banking" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function IntelligenceHome() {
  const { isAuthenticated, loading } = useAuth();
  const loginUrl = getLoginUrl("/intelligence");

  const [institution, setInstitution] = useState("");
  const [domain, setDomain] = useState("");
  const [aum, setAum] = useState("");
  const [text, setText] = useState("");
  const [modules, setModules] = useState<string[]>(MODULES.map(m => m.id));
  const [lens, setLens] = useState<string[]>(["swf", "fm"]);
  const [isInternal, setIsInternal] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [lastAnalysisId, setLastAnalysisId] = useState<number | null>(null);
  const [view, setView] = useState<"input" | "progress" | "output">("input");
  const [stepIdx, setStepIdx] = useState(-1);
  const [hoveredEx, setHoveredEx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const analyseMutation = trpc.intelligence.analyse.useMutation({
    onSuccess: (data) => {
      if (stepTimer.current) clearInterval(stepTimer.current);
      setStepIdx(STEPS.length - 1);
      setTimeout(() => {
        setResult(data.result as AnalysisResult);
        setLastAnalysisId(data.id ?? null);
        setView("output");
        toast.success("Analysis complete");
      }, 600);
    },
    onError: (err) => {
      if (stepTimer.current) clearInterval(stepTimer.current);
      setView("input");
      toast.error(err.message);
    },
  });

  const trackMutation = trpc.intelligence.trackInstitution.useMutation({
    onSuccess: (data) => {
      if (data.alreadyTracked) toast.info("Already tracking this institution");
      else toast.success(`Now tracking ${institution}`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Animate steps while loading
  useEffect(() => {
    if (view === "progress") {
      setStepIdx(0);
      let i = 0;
      stepTimer.current = setInterval(() => {
        i++;
        if (i < STEPS.length - 1) setStepIdx(i);
        else if (stepTimer.current) clearInterval(stepTimer.current);
      }, 320);
    }
    return () => { if (stepTimer.current) clearInterval(stepTimer.current); };
  }, [view]);

  const handleExample = (ex: typeof EXAMPLES[0]) => {
    setInstitution(ex.institution);
    setDomain(ex.domain);
    setAum(ex.aum);
    setText(ex.text);
    setResult(null);
    setView("input");
  };

  const handleAnalyse = () => {
    if (!institution.trim()) { toast.error("Enter an institution name"); return; }
    if (!text.trim()) { toast.error("Paste some text to analyse"); return; }
    setView("progress");
    setStepIdx(0);
    analyseMutation.mutate({ institution: institution.trim(), domain, aum, text, modules, lens, isInternal });
  };

  const handleTrack = () => {
    if (!institution.trim()) return;
    trackMutation.mutate({ institution: institution.trim(), domain, aum, initialAnalysisId: lastAnalysisId ?? undefined });
  };

  const handleReset = () => {
    setInstitution(""); setDomain(""); setAum(""); setText("");
    setResult(null); setView("input"); setStepIdx(-1); setIsInternal(false);
  };

  const handleExportPDF = () => {
    if (!result) return;
    const content = `
      <html><head><style>
        body { font-family: 'Inter', sans-serif; background: #0b0d10; color: #e2e6ef; padding: 40px; }
        h1 { font-size: 28px; font-weight: 800; color: #c9a84c; margin-bottom: 8px; }
        h2 { font-size: 14px; font-weight: 700; color: #00c4a0; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.1em; }
        p { font-size: 13px; line-height: 1.7; color: #e2e6ef; }
        .tag { display: inline-block; font-size: 10px; background: rgba(201,168,76,0.15); color: #c9a84c; border: 1px solid rgba(201,168,76,0.3); border-radius: 4px; padding: 2px 8px; margin: 2px; }
        .item { margin-bottom: 12px; padding: 10px 14px; background: #13161c; border-radius: 8px; border: 1px solid #252b36; }
        .label { font-size: 10px; color: #6b7585; font-family: monospace; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
      </style></head><body>
        <h1>${result.institution ?? "Intelligence Brief"}</h1>
        <p style="color:#6b7585; font-size:12px;">${result.domain ?? ""} ${result.aum ? "· " + result.aum : ""} · Generated ${new Date().toLocaleDateString()}</p>
        <h2>Executive Summary</h2><p>${result.executive_summary ?? ""}</p>
        ${result.use_cases?.length ? `<h2>AI Use Cases</h2>${result.use_cases.map(u => `<div class="item"><strong>${u.title}</strong> <span class="tag">${u.maturity}</span><p>${u.description}</p></div>`).join("")}` : ""}
        ${result.tech_stack?.length ? `<h2>Tech Stack</h2>${result.tech_stack.map(t => `<div class="item"><strong>${t.vendor}</strong> <span class="tag">${t.category}</span><p>${t.evidence}</p></div>`).join("")}` : ""}
        ${result.gtm_signals?.length ? `<h2>GTM Signals</h2>${result.gtm_signals.map(s => `<div class="item"><strong>${s.signal}</strong><p>${s.implication}</p></div>`).join("")}` : ""}
        ${result.coverage_gaps?.length ? `<h2>Coverage Gaps</h2><p>${result.coverage_gaps.map(g => `<span class="tag">${g}</span>`).join(" ")}</p>` : ""}
        <div style="margin-top:40px; padding:20px; background:#13161c; border:1px solid rgba(201,168,76,0.2); border-radius:10px; text-align:center;">
          <p style="color:#c9a84c; font-weight:700; margin-bottom:4px;">AgenThinkMesh Intelligence Agent</p>
          <p style="color:#6b7585; font-size:11px;">farouq@agenthinkmesh.com</p>
        </div>
      </body></html>
    `;
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AgenThinkMesh-Intel-${result.institution?.replace(/\s+/g, "-") ?? "Brief"}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Intelligence brief exported");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/parse-document", { method: "POST", body: formData });
      const data = await res.json() as { text?: string; error?: string };
      if (data.text) {
        setText(data.text.slice(0, 12000));
        setIsInternal(true);
        toast.success(`Extracted ${data.text.length.toLocaleString()} characters from ${file.name}`);
      } else {
        toast.error(data.error ?? "Failed to parse document");
      }
    } catch {
      toast.error("Failed to upload document");
    }
  };

  return (
    <div style={S.page}>
      {/* CSS animation keyframe */}
      <style>{`
        @keyframes intel-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <SiteNav />

      <div style={S.wrap}>
        {/* Topbar brand */}
        <div style={S.topbar}>
          <div style={S.brand}>
            <div style={S.brandMark}>AT</div>
            <div>
              <div style={S.brandName}>Intelligence Agent</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--intel-muted)" }}>GCC Institutional AI Programme Analysis</div>
            </div>
            <div style={S.liveBadge}>LIVE</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a href="/intelligence/tracking" style={{ fontFamily: MONO, fontSize: 11, color: "var(--intel-muted)", textDecoration: "none" }}>Track →</a>
            <a href="/intelligence/briefs" style={{ fontFamily: MONO, fontSize: 11, color: "var(--intel-muted)", textDecoration: "none" }}>Briefs →</a>
            <a href="/intelligence/history" style={{ fontFamily: MONO, fontSize: 11, color: "var(--intel-muted)", textDecoration: "none" }}>History →</a>
          </div>
        </div>

        {/* Hero */}
        <div style={S.eyebrow}>AI Programme Intelligence · GCC Sovereign &amp; Institutional</div>
        <h1 style={S.heroTitle}>
          Extract structured intelligence<br />
          <span style={{ background: "linear-gradient(90deg, var(--intel-gold), var(--intel-teal))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            from any institutional text
          </span>
        </h1>
        <p style={S.heroSub}>
          Identify AI use cases, tech stack, build/buy stance, GTM signals, and coverage gaps — with a GCC sovereign wealth fund lens. Powered by 6 specialist analysis agents.
        </p>

        {/* Auth gate */}
        {!loading && !isAuthenticated && (
          <div style={{ background: "var(--intel-ink2)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 12, padding: "24px 28px", marginBottom: 32, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--intel-muted)", marginBottom: 14 }}>Sign in to run analyses and save your history</div>
            <a href={loginUrl} style={{ display: "inline-block", padding: "10px 28px", background: "linear-gradient(135deg, var(--intel-gold) 0%, #e8a020 100%)", color: "var(--intel-ink)", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none", fontFamily: SYNE }}>
              Sign In to Continue
            </a>
          </div>
        )}

        {/* Example cards */}
        <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--intel-muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
          Pre-loaded examples — click to load
        </div>
        <div style={S.exGrid}>
          {EXAMPLES.map((ex, i) => (
            <div
              key={ex.shortName}
              style={{ ...S.exCard, ...(hoveredEx === i ? S.exCardHover : {}) }}
              onClick={() => handleExample(ex)}
              onMouseEnter={() => setHoveredEx(i)}
              onMouseLeave={() => setHoveredEx(null)}
            >
              <button style={S.exLoadBtn} onClick={e => { e.stopPropagation(); handleExample(ex); }}>→</button>
              <span style={S.exFlag}>{ex.flag}</span>
              <div style={S.exName}>{ex.institution}</div>
              <div style={S.exType}>{ex.domain} · {ex.aum}</div>
              <div style={S.exTagRow}>
                {ex.tags.map(t => <span key={t} style={S.exTag}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>

        {/* Input / Progress / Output */}
        {view === "input" && (
          <>
            {/* Institution row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 10, marginBottom: 10 }}>
              {[
                { label: "Institution *", val: institution, set: setInstitution, ph: "e.g. Mubadala" },
                { label: "Domain", val: domain, set: setDomain, ph: "e.g. Sovereign Wealth Fund" },
                { label: "AUM", val: aum, set: setAum, ph: "e.g. $302B" },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--intel-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>{f.label}</div>
                  <input
                    value={f.val}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.ph}
                    style={{ width: "100%", background: "var(--intel-ink2)", border: "1px solid var(--intel-border)", borderRadius: 7, padding: "9px 12px", color: "var(--intel-text)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              ))}
            </div>

            {/* Text input */}
            <div style={S.inputPanel}>
              <div style={S.inputHeader}>
                <div style={S.panelTitle}>Source Text *</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {isInternal && <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--intel-gold)", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 3, padding: "2px 6px" }}>INTERNAL DOC</span>}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: "4px 10px", background: "transparent", border: "1px solid var(--intel-border)", borderRadius: 5, color: "var(--intel-muted)", fontSize: 11, fontFamily: MONO, cursor: "pointer" }}
                  >
                    📄 Upload Doc
                  </button>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={handleFileUpload} />
                </div>
              </div>
              <textarea
                value={text}
                onChange={e => { setText(e.target.value); setIsInternal(false); }}
                placeholder="Paste LinkedIn posts, articles, conference notes, press releases, or upload a PDF/DOCX document…&#10;&#10;Or click one of the pre-loaded examples above to see the agent in action."
                rows={10}
                style={S.textarea}
              />
              <div style={S.inputFooter}>
                <span style={S.charCount}>{text.length.toLocaleString()} characters</span>
                <button onClick={handleReset} style={{ background: "transparent", border: "none", color: "var(--intel-muted)", fontSize: 11, fontFamily: MONO, cursor: "pointer" }}>↺ Clear</button>
              </div>
            </div>

            {/* Config */}
            <div style={S.configRow}>
              <div style={S.configPanel}>
                <div style={S.configLabel}>Analysis Modules</div>
                <div style={S.toggleGroup}>
                  {MODULES.map(m => (
                    <TogBtn key={m.id} label={m.label} active={modules.includes(m.id)} gold={m.gold} onClick={() => setModules(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])} />
                  ))}
                </div>
              </div>
              <div style={S.configPanel}>
                <div style={S.configLabel}>GCC Lens</div>
                <div style={S.toggleGroup}>
                  {LENSES.map(l => (
                    <TogBtn key={l.id} label={l.label} active={lens.includes(l.id)} onClick={() => setLens(prev => prev.includes(l.id) ? prev.filter(x => x !== l.id) : [...prev, l.id])} />
                  ))}
                </div>
              </div>
            </div>

            {/* Run button */}
            <button
              onClick={handleAnalyse}
              disabled={analyseMutation.isPending || !isAuthenticated}
              style={S.runBtn(analyseMutation.isPending)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 2L13 8L3 14V2Z" fill="currentColor" /></svg>
              Run Intelligence Analysis
            </button>
          </>
        )}

        {view === "progress" && (
          <div style={S.progressPanel}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--intel-muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
              Analysing · {institution}
            </div>
            {STEPS.map((step, i) => (
              <div key={i} style={S.stepLine(i === stepIdx, i < stepIdx)}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: i <= stepIdx ? "var(--intel-teal)" : "var(--intel-dim)" }}>
                  {i < stepIdx ? "✓" : i === stepIdx ? "▶" : "○"}
                </span>
                {step}
              </div>
            ))}
            <div style={S.progBarWrap}>
              <div style={S.progBar(Math.round(((stepIdx + 1) / STEPS.length) * 100))} />
            </div>
          </div>
        )}

        {view === "output" && result && (
          <>
            <div style={S.outputTopbar}>
              <div style={S.outputLabel}>Intelligence Brief</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleReset} style={S.actionBtn("outline")}>↺ New Analysis</button>
                <button onClick={handleTrack} style={S.actionBtn("outline")}>+ Track</button>
                <button onClick={handleExportPDF} style={S.actionBtn("gold")}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}><path d="M2 9h8M6 1v6M3.5 4.5L6 7l2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Export PDF
                </button>
              </div>
            </div>

            <SummaryOutputCard r={result} animDelay={0.05} />
            <UseCasesOutputCard useCases={result.use_cases} animDelay={0.1} />
            <TechStackOutputCard techStack={result.tech_stack} buildBuy={result.build_buy_stance} animDelay={0.15} />
            <GTMOutputCard signals={result.gtm_signals} animDelay={0.2} />
            <CoverageGapsOutputCard gaps={result.coverage_gaps} nextMoves={result.recommended_next_moves} animDelay={0.25} />

            {/* Footer CTA */}
            <div style={S.footerCta}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--intel-gold)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>
                Built for GCC Institutional Investors
              </div>
              <h2 style={{ fontFamily: SYNE, fontWeight: 800, fontSize: "clamp(22px,3vw,32px)", letterSpacing: "-0.02em", color: "var(--intel-text)", margin: "0 0 12px" }}>
                See AgenThinkMesh deployed<br />
                <em style={{ fontFamily: SERIF, fontWeight: 400, fontStyle: "italic", color: "var(--intel-gold)" }}>for your institution</em>
              </h2>
              <p style={{ fontSize: 14, color: "var(--intel-muted)", lineHeight: 1.75, maxWidth: 480, margin: "0 auto 24px" }}>
                160+ specialist agents across finance, compliance, ESG, and risk — pre-configured for GCC sovereign and institutional mandates. Custom deployment in under 2 weeks.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <a
                  href={`mailto:farouq@agenthinkmesh.com?subject=Book Demo${result.institution ? ` — ${result.institution}` : ""}&body=I'd like to book a demo of AgenThinkMesh Intelligence Agent.`}
                  style={{ padding: "12px 28px", background: "linear-gradient(135deg, var(--intel-gold) 0%, #e8a020 100%)", color: "var(--intel-ink)", borderRadius: 8, fontSize: 13, fontWeight: 800, textDecoration: "none", fontFamily: SYNE }}
                >
                  Request a Live Demo
                </a>
                <a
                  href="mailto:farouq@agenthinkmesh.com"
                  style={{ padding: "12px 28px", background: "transparent", border: "1px solid rgba(201,168,76,0.3)", color: "var(--intel-gold)", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none", fontFamily: SYNE }}
                >
                  Contact Sales
                </a>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--intel-muted)", marginTop: 16 }}>
                Direct enquiries: <a href="mailto:farouq@agenthinkmesh.com" style={{ color: "var(--intel-gold)", textDecoration: "none" }}>farouq@agenthinkmesh.com</a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
