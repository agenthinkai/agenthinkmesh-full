import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";

const NAVY_950 = "#0B1629";
const NAVY_900 = "#0F1E38";
const NAVY_800 = "#152340";
const CYAN = "#00D4FF";
const BLUE = "#0080FF";
const SKY = "#40B8FF";
const INDIGO = "#4060FF";
const WHITE = "#F0F4FA";
const MUTED = "#8BA3C4";

// ── Agent-specific example prompts ──────────────────────────────────────────
const AGENT_EXAMPLES: Record<string, { icon: string; text: string }[]> = {
  "Research Assistant": [
    { icon: "📚", text: "Summarise the latest research on transformer architectures for NLP" },
    { icon: "📝", text: "Write an annotated bibliography on climate change mitigation strategies" },
    { icon: "🔍", text: "Find and compare 5 peer-reviewed studies on intermittent fasting and cognitive performance" },
    { icon: "✏️", text: "Outline a 3,000-word essay on the ethical implications of AI in healthcare" },
    { icon: "📖", text: "Explain the concept of quantum entanglement in simple terms with examples" },
    { icon: "🎓", text: "Generate 20 practice exam questions on macroeconomics with answers" },
  ],
  "Citation Manager": [
    { icon: "📑", text: "Format these 10 sources in APA 7th edition style" },
    { icon: "🔗", text: "Find the DOI and full citation for a paper on CRISPR gene editing" },
    { icon: "📚", text: "Check my bibliography for duplicate or missing citations" },
    { icon: "✅", text: "Convert my Harvard-style references to Chicago author-date format" },
    { icon: "🗂️", text: "Organise my 30 sources by topic and create a literature map" },
    { icon: "📋", text: "Generate an in-text citation list for my thesis introduction" },
  ],
  "Pricing Intelligence Agent": [
    { icon: "💰", text: "Analyse competitor pricing for SKU X across 5 major online retailers" },
    { icon: "📊", text: "Recommend dynamic pricing rules for our top 20 products based on last quarter's elasticity" },
    { icon: "🏷️", text: "Alert me when any competitor drops price below AED 49 on product category Y" },
    { icon: "📈", text: "Model the revenue impact of a 10% price increase on our premium tier" },
    { icon: "🔍", text: "Identify which of our products are priced above market median and by how much" },
    { icon: "⚡", text: "Suggest promotional discount thresholds that protect margin while beating competitor prices" },
  ],
  "Demand Forecaster": [
    { icon: "📦", text: "Forecast demand for SKU-1042 over the next 30 days using last 12 months of sales" },
    { icon: "📅", text: "Predict peak demand periods for our winter collection in UAE and KSA" },
    { icon: "🔄", text: "Identify which SKUs are at risk of stockout in the next 2 weeks" },
    { icon: "📉", text: "Analyse the demand impact of Ramadan on our food category" },
    { icon: "🌍", text: "Compare demand trends across Dubai, Riyadh, and Cairo for our electronics range" },
    { icon: "⚙️", text: "Generate a 90-day demand plan for our top 50 SKUs with safety stock recommendations" },
  ],
  "Promotion Planner": [
    { icon: "🎯", text: "Plan a Ramadan promotion campaign with expected uplift and margin impact" },
    { icon: "📣", text: "Design a 2-week flash sale strategy for our electronics category" },
    { icon: "💡", text: "Recommend the optimal discount depth for clearing excess winter inventory" },
    { icon: "📊", text: "Analyse which past promotions delivered the best ROI in the last 6 months" },
    { icon: "🗓️", text: "Create a promotional calendar for Q3 aligned with UAE public holidays" },
    { icon: "🛒", text: "Suggest bundle promotions for our top 10 slow-moving SKUs" },
  ],
  "Customer Sentiment Analyzer": [
    { icon: "⭐", text: "Analyse 500 recent customer reviews and surface the top 5 product complaints" },
    { icon: "😊", text: "What is the sentiment trend for our brand on social media over the last 30 days?" },
    { icon: "📉", text: "Identify which product categories have the lowest customer satisfaction scores" },
    { icon: "💬", text: "Summarise customer feedback themes from our last NPS survey" },
    { icon: "🔍", text: "Compare sentiment for our brand vs top 3 competitors on Google Reviews" },
    { icon: "📋", text: "Generate a monthly customer sentiment report with actionable recommendations" },
  ],
  "Deal Screener": [
    { icon: "📊", text: "Screen this Series A deal: SaaS, $2M ARR, 180% NRR, Dubai-based, seeking $8M" },
    { icon: "🔍", text: "Run a quick due diligence checklist on a fintech startup in the GCC" },
    { icon: "📈", text: "Compare this deal's metrics against our portfolio benchmarks" },
    { icon: "⚠️", text: "Flag the top 5 red flags in this pitch deck" },
    { icon: "💼", text: "Estimate the post-money valuation range for a $3M ARR B2B SaaS at 5x revenue" },
    { icon: "📋", text: "Generate an investment memo summary for this deal" },
  ],
  "Contract Reviewer": [
    { icon: "⚖️", text: "Review this NDA and flag any non-standard clauses" },
    { icon: "📄", text: "Summarise the key obligations and risks in this service agreement" },
    { icon: "🔍", text: "Identify any missing standard clauses in this employment contract" },
    { icon: "⚠️", text: "What are the termination conditions in this SaaS subscription agreement?" },
    { icon: "📝", text: "Redline this vendor contract to protect our IP and limit liability" },
    { icon: "✅", text: "Check this contract for compliance with UAE Commercial Transactions Law" },
  ],
  "Clinical Summary Agent": [
    { icon: "🩺", text: "Summarise this patient's discharge notes into a structured clinical brief" },
    { icon: "💊", text: "Check for drug interactions between metformin, lisinopril, and atorvastatin" },
    { icon: "📋", text: "Generate an ICD-10 coding suggestion for this clinical encounter" },
    { icon: "🔬", text: "Summarise the latest clinical guidelines for managing Type 2 diabetes in the GCC" },
    { icon: "📊", text: "Analyse this lab report and flag any values outside normal range" },
    { icon: "📖", text: "Find recent literature on minimally invasive treatment for lumbar disc herniation" },
  ],
  "KPI Tracker": [
    { icon: "📊", text: "Build a KPI dashboard for our sales team with targets and actuals" },
    { icon: "🎯", text: "Which KPIs are we at risk of missing this quarter?" },
    { icon: "📈", text: "Analyse the correlation between employee engagement scores and productivity KPIs" },
    { icon: "⚠️", text: "Alert me when any team KPI drops below 80% of target" },
    { icon: "📋", text: "Generate a monthly KPI report for the operations department" },
    { icon: "🔍", text: "Benchmark our NPS score against industry average for B2B SaaS" },
  ],
  "Email Drafter": [
    { icon: "✉️", text: "Draft a professional follow-up email after a client meeting about our Q2 proposal" },
    { icon: "📝", text: "Write an internal announcement email for our new remote work policy" },
    { icon: "🤝", text: "Compose a partnership introduction email to a potential distributor in Saudi Arabia" },
    { icon: "⚠️", text: "Draft a polite but firm overdue payment reminder to a client" },
    { icon: "🎉", text: "Write a congratulations email to a team member on their promotion" },
    { icon: "📋", text: "Create a meeting agenda email for our quarterly business review" },
  ],
  "Portfolio Analyst": [
    { icon: "📊", text: "Analyse the risk-adjusted returns of my current portfolio vs S&P 500" },
    { icon: "📈", text: "Identify the top 3 underperforming holdings and suggest rebalancing options" },
    { icon: "🔍", text: "Run a stress test on my portfolio for a 20% market correction scenario" },
    { icon: "💰", text: "Calculate the Sharpe ratio and max drawdown for my equity portfolio" },
    { icon: "🌍", text: "Assess my portfolio's exposure to GCC market risk" },
    { icon: "📋", text: "Generate a monthly portfolio performance report with attribution analysis" },
  ],
  "Regulatory Compliance Agent": [
    { icon: "⚖️", text: "What are the DFSA compliance requirements for launching a robo-advisory in Dubai?" },
    { icon: "📋", text: "Summarise the key AML/KYC obligations for a UAE-licensed fintech" },
    { icon: "🔍", text: "Check our data privacy policy for PDPL compliance in Saudi Arabia" },
    { icon: "⚠️", text: "What are the regulatory risks of offering crypto trading to GCC retail investors?" },
    { icon: "📄", text: "Generate a compliance checklist for launching a new financial product in the UAE" },
    { icon: "🌍", text: "Compare ADGM and DIFC regulatory frameworks for a new fund manager" },
  ],
  "DEFAULT": [
    { icon: "🔬", text: "Simulate 500 GCC consumers' reaction to a new fintech product at AED 99/month" },
    { icon: "📊", text: "Screen this Series A deal: SaaS, $2M ARR, 180% NRR, Dubai-based, seeking $8M" },
    { icon: "🏥", text: "Analyse pricing sensitivity for a telehealth subscription across UAE, KSA, and Qatar" },
    { icon: "⚖️", text: "What are the regulatory risks of launching a crypto lending product in the GCC?" },
    { icon: "📈", text: "Identify the top 3 underserved customer segments for Islamic wealth management in 2025" },
    { icon: "🤖", text: "Competitive intelligence: who are the top 5 AI agent platforms targeting MENA enterprises?" },
  ],
};

function getExamplesForAgent(agentName: string | null | undefined): { icon: string; text: string }[] {
  if (!agentName) return AGENT_EXAMPLES["DEFAULT"];
  if (AGENT_EXAMPLES[agentName]) return AGENT_EXAMPLES[agentName];
  // Partial match — find the closest key
  const lower = agentName.toLowerCase();
  const match = Object.keys(AGENT_EXAMPLES).find(k =>
    k !== "DEFAULT" && (lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower.split(" ")[0]))
  );
  return match ? AGENT_EXAMPLES[match] : AGENT_EXAMPLES["DEFAULT"];
}

const EXAMPLE_PROMPTS = AGENT_EXAMPLES["DEFAULT"];

const AGENT_STEPS = [
  { color: CYAN, name: "Intent Classifier", desc: "Understands your query and selects the right agent mix" },
  { color: BLUE, name: "Research Analyst", desc: "Gathers relevant data and key findings" },
  { color: SKY, name: "Risk Analyst", desc: "Identifies risks and sentiment signals" },
  { color: INDIGO, name: "Segment Analyst", desc: "Maps insights to customer segments" },
  { color: "#A040FF", name: "Report Writer", desc: "Synthesises everything into an executive brief" },
];

export default function AskScreen() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const search = useSearch();
  const { isAuthenticated } = useAuth();

  // ── Mesh Identity Layer hooks ──────────────────────────────────────────────
  const identityProfile = trpc.identity.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const inferFromFirstQuery = trpc.identity.inferFromFirstQuery.useMutation();
  const refineSession = trpc.identity.refineSession.useMutation();
  const recordSession = trpc.identity.recordSession.useMutation();
  const dismissNudge = trpc.identity.dismissNudge.useMutation();
  const utils = trpc.useUtils();

  // Redirect to persona setup if user has no profile yet.
  // Guard against isFetching so a cache invalidation refetch doesn't trigger the redirect.
  useEffect(() => {
    if (
      isAuthenticated &&
      identityProfile.data === null &&
      !identityProfile.isLoading &&
      !identityProfile.isFetching
    ) {
      navigate("/persona-setup");
    }
  }, [isAuthenticated, identityProfile.data, identityProfile.isLoading, identityProfile.isFetching, navigate]);

  // Nudge banner state
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const nudgeMessage = identityProfile.data?.nudgeMessage ?? null;

  const handleDismissNudge = () => {
    setNudgeDismissed(true);
    dismissNudge.mutate(undefined, {
      onSuccess: () => utils.identity.getProfile.invalidate(),
    });
  };

  // File attachment state
  const [attachedFile, setAttachedFile] = useState<{ name: string; url: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-selected agent from persona-setup (?agent=id&agentName=...)
  const [preSelectedAgent, setPreSelectedAgent] = useState<{ id: string; name: string } | null>(null);

  // Pre-fill from ?refine= param and read ?agent= from persona-setup
  useEffect(() => {
    const params = new URLSearchParams(search);
    const refine = params.get("refine");
    if (refine) setQuery(decodeURIComponent(refine));
    const agentId = params.get("agent");
    const agentName = params.get("agentName");
    if (agentId && agentName) {
      setPreSelectedAgent({ id: agentId, name: decodeURIComponent(agentName) });
    }
  }, [search]);

  const uploadFile = trpc.mesh.uploadAttachment.useMutation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 16 * 1024 * 1024; // 16MB
    if (file.size > maxSize) {
      alert("File too large. Maximum size is 16MB.");
      return;
    }
    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);
      const result = await uploadFile.mutateAsync({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Data: base64,
      });
      setAttachedFile({ name: file.name, url: result.url, size: file.size });
    } catch (err) {
      console.error("Upload failed", err);
      alert("File upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const analyze = trpc.mesh.analyze.useMutation({
    onSuccess: (data) => {
      navigate(`/result/${data.taskId}`);
    },
  });

  const handleSubmit = () => {
    if (!query.trim()) return;
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    const currentSessionCount = identityProfile.data?.sessionCount ?? -1;

    // Stage 2: fire silently on the very first query (sessionCount === 0)
    if (currentSessionCount === 0) {
      inferFromFirstQuery.mutate(
        { firstQuery: query.trim() },
        { onSuccess: () => utils.identity.getProfile.invalidate() }
      );
    }

    // Stage 3: fire silently every 5 completed sessions
    if (currentSessionCount > 0 && currentSessionCount % 5 === 0) {
      refineSession.mutate(undefined, {
        onSuccess: () => utils.identity.getProfile.invalidate(),
      });
    }

    // Record the session (increment count, append agents)
    recordSession.mutate({ agentsUsed: ["Intent Classifier", "Research Analyst", "Risk Analyst", "Segment Analyst", "Report Writer"] });

    analyze.mutate({
      query: query.trim(),
      fileUrl: attachedFile?.url ?? null,
      fileName: attachedFile?.name ?? null,
    });
  };

  const handleExample = (text: string) => {
    setQuery(text);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${NAVY_950} 0%, ${NAVY_900} 50%, ${NAVY_800} 100%)`,
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      overflowX: "hidden",
    }}>
      {/* Ambient background glows */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "10%", left: "15%", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${CYAN}12 0%, transparent 70%)`, filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "15%", right: "10%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${INDIGO}12 0%, transparent 70%)`, filter: "blur(60px)" }} />
      </div>

      {/* Navbar */}
      <nav style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: `1px solid ${CYAN}20`,
        background: `${NAVY_950}CC`,
        backdropFilter: "blur(12px)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <Logo />
        </a>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/portfolio" style={{ color: MUTED, fontSize: 14, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
            Portfolio
          </a>
          <a href="/turnaround" style={{ color: MUTED, fontSize: 14, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
            Turnaround
          </a>
          <a href="/history" style={{ color: MUTED, fontSize: 14, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
            History
          </a>
          <a href="/mesh" style={{ color: MUTED, fontSize: 14, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
            Advanced
          </a>
          {isAuthenticated ? (
            <a href="/mesh" style={{
              color: WHITE, fontSize: 14, textDecoration: "none",
              padding: "7px 18px", borderRadius: 8,
              background: `linear-gradient(135deg, ${CYAN}30, ${BLUE}30)`,
              border: `1px solid ${CYAN}50`,
            }}>Dashboard</a>
          ) : (
            <a href={getLoginUrl()} style={{
              color: WHITE, fontSize: 14, textDecoration: "none",
              padding: "7px 18px", borderRadius: 8,
              background: `linear-gradient(135deg, ${CYAN}30, ${BLUE}30)`,
              border: `1px solid ${CYAN}50`,
            }}>Sign in</a>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main style={{
        position: "relative", zIndex: 1,
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 24px",
        maxWidth: 760, margin: "0 auto", width: "100%",
      }}>
        {/* Pre-selected agent banner (from persona-setup) */}
        {preSelectedAgent && (
          <div style={{
            width: "100%",
            background: `${CYAN}08`,
            border: `1px solid ${CYAN}30`,
            borderRadius: 12,
            padding: "12px 18px",
            marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${CYAN}18`,
                border: `1px solid ${CYAN}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
              }}>🤖</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>
                  {preSelectedAgent.name} is ready
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                  This agent has been pre-loaded based on your domain selection
                </div>
              </div>
            </div>
            <button
              onClick={() => setPreSelectedAgent(null)}
              style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
              aria-label="Dismiss"
            >×</button>
          </div>
        )}

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 16px", borderRadius: 100,
          background: `${CYAN}12`, border: `1px solid ${CYAN}30`,
          marginBottom: 28,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: CYAN, boxShadow: `0 0 8px ${CYAN}`, display: "inline-block" }} />
          <span style={{ color: CYAN, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
            {identityProfile.data?.activePersona
              ? `${identityProfile.data.activePersona.replace(/_/g, " ")} MESH · Online`
              : "112 specialist agents · Mesh Online"}
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(32px, 6vw, 52px)",
          fontWeight: 800,
          color: WHITE,
          textAlign: "center",
          lineHeight: 1.15,
          marginBottom: 14,
          fontFamily: "'Playfair Display', serif",
        }}>
          Describe any business task.
          <br />
          <span style={{ background: `linear-gradient(90deg, ${CYAN}, ${BLUE}, ${SKY})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            The Mesh handles the rest.
          </span>
        </h1>

        <p style={{ color: MUTED, fontSize: 16, textAlign: "center", marginBottom: 36, lineHeight: 1.6, maxWidth: 560 }}>
          {identityProfile.data?.activePersona
            ? `Your Mesh is configured for ${identityProfile.data.activePersona.replace(/_/g, " ").toLowerCase()} workflows. The right agents are ready.`
            : "AgenThinkMesh activates the right specialist agents across Finance, Legal, Healthcare, and GCC Wealth — delivering institutional-grade results in seconds."}
        </p>

        {/* Input area */}
        <div style={{
          width: "100%",
          background: `${NAVY_800}CC`,
          border: `1px solid ${CYAN}30`,
          borderRadius: 16,
          padding: 20,
          backdropFilter: "blur(12px)",
          boxShadow: `0 0 40px ${CYAN}10`,
          marginBottom: 24,
        }}>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
            placeholder="Describe your task — e.g. Screen a Series A deal, Simulate consumer reactions, Analyse pricing sensitivity..."
            style={{
              width: "100%",
              minHeight: 120,
              background: "transparent",
              border: "none",
              outline: "none",
              color: WHITE,
              fontSize: 16,
              lineHeight: 1.6,
              resize: "none",
              fontFamily: "'Inter', sans-serif",
              boxSizing: "border-box",
            }}
            disabled={analyze.isPending}
          />

          {/* Attached file chip */}
          {attachedFile && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 12px",
              background: `${CYAN}15`, border: `1px solid ${CYAN}40`,
              borderRadius: 8, marginBottom: 10,
              maxWidth: "100%",
            }}>
              <span style={{ fontSize: 14 }}>📎</span>
              <span style={{ color: CYAN, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                {attachedFile.name}
              </span>
              <span style={{ color: MUTED, fontSize: 11 }}>
                ({(attachedFile.size / 1024).toFixed(0)} KB)
              </span>
              <button
                onClick={() => setAttachedFile(null)}
                style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
                title="Remove attachment"
              >✕</button>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={analyze.isPending || uploading}
                title="Attach a document (PDF, DOCX, XLSX, PPTX)"
                style={{
                  background: "none", border: `1px solid ${CYAN}30`,
                  borderRadius: 8, padding: "6px 10px",
                  cursor: analyze.isPending || uploading ? "not-allowed" : "pointer",
                  color: uploading ? CYAN : MUTED,
                  fontSize: 16, lineHeight: 1,
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
                onMouseEnter={e => { if (!analyze.isPending && !uploading) e.currentTarget.style.borderColor = `${CYAN}80`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${CYAN}30`; }}
              >
                {uploading ? (
                  <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${MUTED}`, borderTopColor: CYAN, display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <span>📎</span>
                )}
                <span style={{ fontSize: 12 }}>{uploading ? "Uploading…" : "Attach"}</span>
              </button>
              <span style={{ color: MUTED, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                {analyze.isPending ? "Activating mesh…" : "⌘ + Enter to analyse"}
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={analyze.isPending || !query.trim()}
              style={{
                padding: "10px 28px",
                borderRadius: 10,
                border: "none",
                cursor: analyze.isPending || !query.trim() ? "not-allowed" : "pointer",
                background: analyze.isPending || !query.trim()
                  ? `${NAVY_800}`
                  : `linear-gradient(135deg, ${CYAN}, ${BLUE})`,
                color: analyze.isPending || !query.trim() ? MUTED : NAVY_950,
                fontWeight: 700,
                fontSize: 15,
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {analyze.isPending ? (
                <>
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: `2px solid ${MUTED}`, borderTopColor: CYAN,
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  Analysing…
                </>
              ) : (
                <>⚡ Analyse via Mesh</>
              )}
            </button>
          </div>
        </div>

        {/* Agent pipeline visual */}
        {analyze.isPending && (
          <div style={{
            width: "100%",
            background: `${NAVY_800}80`,
            border: `1px solid ${CYAN}20`,
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 24,
          }}>
            <div style={{ color: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 12, letterSpacing: "0.08em" }}>
              MESH ROUTING
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {AGENT_STEPS.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: step.color,
                    boxShadow: `0 0 8px ${step.color}`,
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${i * 0.3}s`,
                    flexShrink: 0,
                  }} />
                  <span style={{ color: step.color, fontSize: 13, fontWeight: 600, minWidth: 160 }}>{step.name}</span>
                  <span style={{ color: MUTED, fontSize: 12 }}>{step.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {/* Stage 3 nudge banner — shown when persona drift detected */}
        {nudgeMessage && !nudgeDismissed && (
          <div style={{
            width: "100%",
            background: "#00D4FF08",
            border: "1px solid #00D4FF30",
            borderRadius: 10,
            padding: "12px 16px",
            color: "#7DD3FC",
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}>
            <span>✦ {nudgeMessage}</span>
            <button
              onClick={handleDismissNudge}
              style={{ background: "none", border: "none", color: "#7DD3FC", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}
              aria-label="Dismiss"
            >×</button>
          </div>
        )}

        {analyze.isError && (
          <div style={{
            width: "100%",
            background: "#FF404010",
            border: "1px solid #FF404040",
            borderRadius: 10,
            padding: "12px 16px",
            color: "#FF8080",
            fontSize: 14,
            marginBottom: 16,
          }}>
            ⚠ {typeof analyze.error?.message === "string" ? analyze.error.message : analyze.error ? JSON.stringify(analyze.error) : "Something went wrong. Please try again."}
          </div>
        )}

        {/* Example prompts */}
        {!analyze.isPending && (
          <>
            <div style={{ color: MUTED, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 14 }}>
              TRY AN EXAMPLE
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 10,
              width: "100%",
            }}>
              {getExamplesForAgent(preSelectedAgent?.name).map((ex, i) => (
                <button
                  key={i}
                  onClick={() => handleExample(ex.text)}
                  style={{
                    background: `${NAVY_800}80`,
                    border: `1px solid ${CYAN}20`,
                    borderRadius: 10,
                    padding: "12px 16px",
                    color: MUTED,
                    fontSize: 13,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    lineHeight: 1.5,
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${CYAN}50`;
                    e.currentTarget.style.color = WHITE;
                    e.currentTarget.style.background = `${NAVY_800}`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = `${CYAN}20`;
                    e.currentTarget.style.color = MUTED;
                    e.currentTarget.style.background = `${NAVY_800}80`;
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{ex.icon}</span>
                  <span>{ex.text}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
