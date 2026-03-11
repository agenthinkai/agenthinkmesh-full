import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import Logo from "@/components/Logo";

const NAVY_950 = "#080F1E";
const NAVY_900 = "#0C1628";
const NAVY_800 = "#111E35";
const STEEL = "#1E2D47";
const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const SILVER_50 = "#F0F4FA";
const SILVER_200 = "#C8D4E8";
const SILVER_400 = "#8494AA";
const SILVER_600 = "#4A5A72";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const STEPS = [
  { id: 1, label: "Extracting portfolio disclosures", desc: "Reading fund documents and identifying key data points" },
  { id: 2, label: "Comparing mandate vs. portfolio", desc: "Assessing alignment between stated strategy and actual construction" },
  { id: 3, label: "Analysing sector allocation", desc: "Mapping concentration risk and diversification across sectors" },
  { id: 4, label: "Identifying risk signals", desc: "Flagging emerging risks, leverage concerns, and liquidity factors" },
  { id: 5, label: "Drafting IC-ready report", desc: "Synthesising findings into a structured investment committee report" },
];

export default function PortfolioAnalyzing() {
  const params = useParams<{ id: string }>();
  const reviewId = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const analyzeRef = useRef(false);

  const analyze = trpc.portfolio.analyze.useMutation();
  const { data: review, refetch } = trpc.portfolio.get.useQuery(
    { id: reviewId },
    { enabled: !!reviewId, refetchInterval: 3000 }
  );

  // Start analysis once on mount
  useEffect(() => {
    if (analyzeRef.current || !reviewId) return;
    analyzeRef.current = true;
    setAnalysisStarted(true);
    analyze.mutate({ id: reviewId });
  }, [reviewId]);

  // Animate step progression
  useEffect(() => {
    if (!analysisStarted) return;
    const timings = [0, 8000, 18000, 30000, 44000];
    const timers = timings.map((delay, idx) =>
      setTimeout(() => setCurrentStep(idx + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [analysisStarted]);

  // Navigate when complete
  useEffect(() => {
    if (review?.status === "complete") {
      setTimeout(() => navigate(`/portfolio-review/report/${reviewId}`), 800);
    }
    if (review?.status === "error") {
      navigate(`/portfolio-review/upload?error=${encodeURIComponent(review.errorMessage ?? "Analysis failed")}`);
    }
  }, [review?.status]);

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, fontFamily: FONT, color: SILVER_50, display: "flex", flexDirection: "column" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "20%", left: "30%", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}08 0%, transparent 65%)`, filter: "blur(100px)" }} />
      </div>

      {/* Navbar */}
      <nav style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 40px",
        borderBottom: `1px solid ${STEEL}`,
        background: `${NAVY_900}F0`,
        backdropFilter: "blur(16px)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}><Logo /></a>
        <div style={{ fontFamily: MONO, fontSize: 11, color: GOLD, letterSpacing: "0.06em" }}>
          PORTFOLIO REVIEW · ANALYSING
        </div>
      </nav>

      {/* Main */}
      <main style={{
        position: "relative", zIndex: 1,
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 32px",
        maxWidth: 640, margin: "0 auto", width: "100%", boxSizing: "border-box",
      }}>
        {/* Spinner */}
        <div style={{ position: "relative", width: 80, height: 80, marginBottom: 40 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            border: `3px solid ${STEEL}`,
            borderTopColor: GOLD,
            animation: "portfolioSpin 1.2s linear infinite",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28,
          }}>📋</div>
        </div>

        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "clamp(22px, 4vw, 32px)",
          fontWeight: 800,
          color: SILVER_50,
          textAlign: "center",
          marginBottom: 10,
        }}>
          Analysing your portfolio
        </h1>
        <p style={{ fontSize: 14, color: SILVER_400, textAlign: "center", marginBottom: 48, lineHeight: 1.6 }}>
          Our specialist analysts are reviewing your documents. This typically takes 2–3 minutes.
        </p>

        {/* Steps */}
        <div style={{ width: "100%" }}>
          {STEPS.map((step, idx) => {
            const isComplete = currentStep > step.id;
            const isActive = currentStep === step.id;
            const isPending = currentStep < step.id;
            return (
              <div key={step.id} style={{
                display: "flex", alignItems: "flex-start", gap: 16,
                padding: "14px 0",
                borderBottom: idx < STEPS.length - 1 ? `1px solid ${STEEL}` : "none",
                opacity: isPending ? 0.35 : 1,
                transition: "opacity 0.4s",
              }}>
                {/* Status icon */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isComplete ? `${GOLD}20` : isActive ? `${GOLD}12` : NAVY_800,
                  border: `1.5px solid ${isComplete ? GOLD : isActive ? GOLD + "60" : STEEL}`,
                  transition: "all 0.3s",
                  fontSize: 12,
                }}>
                  {isComplete ? (
                    <span style={{ color: GOLD }}>✓</span>
                  ) : isActive ? (
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: GOLD,
                      animation: "portfolioPulse 1.2s ease-in-out infinite",
                    }} />
                  ) : (
                    <span style={{ color: SILVER_600, fontFamily: MONO, fontSize: 10 }}>{step.id}</span>
                  )}
                </div>

                <div style={{ flex: 1, paddingTop: 2 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: isComplete ? SILVER_200 : isActive ? SILVER_50 : SILVER_600,
                    marginBottom: 2,
                    transition: "color 0.3s",
                  }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 12, color: SILVER_600, lineHeight: 1.5 }}>
                    {step.desc}
                  </div>
                </div>

                {isActive && (
                  <div style={{ fontFamily: MONO, fontSize: 10, color: GOLD, paddingTop: 4, whiteSpace: "nowrap" }}>
                    In progress…
                  </div>
                )}
                {isComplete && (
                  <div style={{ fontFamily: MONO, fontSize: 10, color: GOLD + "80", paddingTop: 4, whiteSpace: "nowrap" }}>
                    Done
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Disclaimer */}
        <p style={{ fontSize: 11, color: SILVER_600, textAlign: "center", marginTop: 40, fontFamily: MONO, lineHeight: 1.6 }}>
          Do not close this tab. You will be redirected automatically when the report is ready.
        </p>
      </main>

      <style>{`
        @keyframes portfolioSpin { to { transform: rotate(360deg); } }
        @keyframes portfolioPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.7); } }
      `}</style>
    </div>
  );
}
